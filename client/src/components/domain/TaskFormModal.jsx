import React from 'react';
import api from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { fullName, todayISO } from '../../lib/format';
import { FormGrid, FormModal, InlineAlert, SelectField, TextAreaField, TextField } from '../ui';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => ({ value: p, label: p.charAt(0) + p.slice(1).toLowerCase() }));
const day = (d) => (d ? String(d).slice(0, 10) : '');

/** Create or edit a task. Only interns in a working status appear in the assignee list; the API enforces the same. */
export function TaskFormModal({ task, defaultProjectId, onClose, onDone }) {
  const toast = useToast();
  const edit = !!task;
  const interns = useFetch(() => api.get('/interns', { params: { open: true, limit: 200 } }), []);
  const projects = useFetch(() => api.get('/projects'), []);
  const form = useForm({
    title: task?.title || '', description: task?.description || '', projectId: task?.projectId?._id || task?.projectId || defaultProjectId || '',
    assignedTo: (task?.assignedTo || []).map((a) => a._id || a)[0] || '', priority: task?.priority || 'MEDIUM', startDate: day(task?.startDate), dueDate: day(task?.dueDate),
    estimatedHours: task?.estimatedHours || '', tags: (task?.tags || []).join(', ')
  });
  const f = form.field;
  const working = (interns.data || []).filter((i) => ['ACTIVE', 'PERFORMANCE_REVIEW', 'EXIT_INITIATED'].includes(i.status));

  return (
    <FormModal
      open onClose={onClose} size="lg" testId="task-form-modal" title={edit ? 'Edit task' : 'New task'} submitLabel={edit ? 'Save task' : 'Create task'} form={form}
      rules={{
        title: [rules.required('Title'), rules.max(200, 'Title')], description: rules.max(5000, 'Description'),
        dueDate: (v, all) => (v && all.startDate && v < all.startDate ? 'Due date cannot be before the start date' : null),
        estimatedHours: rules.number('Estimated hours', { min: 0, max: 1000 })
      }}
      onSubmit={(v) => {
        const body = { title: v.title.trim(), description: v.description.trim(), priority: v.priority, tags: v.tags, assignedTo: v.assignedTo ? [v.assignedTo] : [] };
        if (v.projectId) body.projectId = v.projectId;
        if (v.startDate) body.startDate = v.startDate;
        if (v.dueDate) body.dueDate = v.dueDate;
        if (v.estimatedHours !== '') body.estimatedHours = Number(v.estimatedHours);
        return edit ? api.patch(`/tasks/${task._id}`, body) : api.post('/tasks', body);
      }}
      onDone={() => { toast.success(edit ? 'Task updated' : 'Task created. The intern was notified.'); onDone(); }}
    >
      {!interns.loading && working.length === 0 && <InlineAlert tone="warning" testId="no-assignable-interns">There are no interns in a working status to assign this task to. You can still create it unassigned.</InlineAlert>}
      <FormGrid>
        <TextField {...f('title')} label="Title" required className="sm:col-span-2" />
        <SelectField {...f('projectId')} label="Project" placeholder="No project" options={(projects.data || []).map((p) => ({ value: p._id, label: p.name }))} />
        <SelectField {...f('assignedTo')} label="Assign to" placeholder="Unassigned" options={working.map((i) => ({ value: i.userId._id, label: `${fullName(i.userId)} (${i.internId})` }))} />
        <SelectField {...f('priority')} label="Priority" options={PRIORITIES} />
        <TextField {...f('estimatedHours')} label="Estimated hours" type="number" min="0" />
        <TextField {...f('startDate')} label="Start date" type="date" />
        <TextField {...f('dueDate')} label="Due date" type="date" min={f('startDate').value || todayISO()} />
        <TextAreaField {...f('description')} label="Description" rows={4} className="sm:col-span-2" />
        <TextField {...f('tags')} label="Tags" hint="Separate with commas." className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}
