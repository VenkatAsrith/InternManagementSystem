import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { fmtDate, fullName, humanize } from '../../lib/format';
import { TASK_STATUS, TASK_PRIORITY } from '@shared/constants.js';
import { Button, DataTable, FilterBar, PageHeader, Pagination, SelectField, StatusBadge } from '../../components/ui';
import { TaskFormModal } from '../../components/domain/TaskFormModal';
import { TaskDetailModal } from '../../components/domain/TaskDetailModal';

/** Staff view of tasks. Mentors and team leads only receive their mentees' tasks from the API. */
export function TasksPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [projectId, setProjectId] = useState('');
  const [modal, setModal] = useState(null); // {type:'new'|'edit'|'view', task?, id?}
  const projects = useFetch(() => api.get('/projects'), []);
  const list = useList('/tasks', { filters: { status, priority, projectId } });
  const done = () => { setModal(null); list.reload({ silent: true }); };

  const cols = [
    { key: 'title', header: 'Task', render: (t) => <button type="button" className="text-left font-medium text-brand-800 underline" onClick={() => setModal({ type: 'view', id: t._id })} data-testid={`task-open-${t._id}`}>{t.title}</button> },
    { key: 'project', header: 'Project', render: (t) => t.projectId?.name || '-' },
    { key: 'assignee', header: 'Assigned to', render: (t) => (t.assignedTo || []).map(fullName).join(', ') || <span className="text-amber-800">Unassigned</span> },
    { key: 'priority', header: 'Priority', render: (t) => <StatusBadge status={t.priority} /> },
    { key: 'due', header: 'Due', render: (t) => fmtDate(t.dueDate) },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> }
  ];

  return (
    <>
      <PageHeader title="Tasks & reviews" description="Assign work, follow progress and review submitted deliverables." actions={can('tasks.assign') && <Button icon={Plus} onClick={() => setModal({ type: 'new' })} data-testid="new-task">New task</Button>} />
      <FilterBar>
        <SelectField name="status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={Object.values(TASK_STATUS).map((s) => ({ value: s, label: humanize(s) }))} />
        <SelectField name="priority" label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="All priorities" options={Object.values(TASK_PRIORITY).map((s) => ({ value: s, label: humanize(s) }))} />
        <SelectField name="projectId" label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="All projects" options={(projects.data || []).map((p) => ({ value: p._id, label: p.name }))} />
      </FilterBar>
      <DataTable testId="tasks-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} caption="Tasks" emptyTitle="No tasks" emptyDescription="Tasks you create or that belong to your interns appear here." />
      <Pagination pagination={list.pagination} onPage={list.setPage} />
      {modal?.type === 'new' && <TaskFormModal onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'edit' && <TaskFormModal task={modal.task} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'view' && <TaskDetailModal taskId={modal.id} onClose={() => setModal(null)} onChanged={() => list.reload({ silent: true })} onEdit={(task) => setModal({ type: 'edit', task })} />}
    </>
  );
}
