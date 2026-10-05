import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useAction, useForm, rules } from '../../hooks/useForm';
import { fmtDate, fmtDateTime, fullName, humanize } from '../../lib/format';
import { TASK_ASSIGNEE_TRANSITIONS, TASK_STAFF_TRANSITIONS, TASK_SUBMITTABLE_STATUSES, TASK_REVIEWABLE_STATUSES } from '@shared/lifecycle.js';
import { Button, DetailList, FormError, Modal, SelectField, StateView, StatusBadge, TextAreaField } from '../ui';

const idOf = (x) => String(x?._id || x);

function SubmitForm({ task, onDone }) {
  const toast = useToast();
  const form = useForm({ description: '', links: [{ label: 'Pull request', url: '' }] });
  const links = form.values.links;
  const setLink = (i, patch) => form.set('links', links.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const onSubmit = (e) => {
    e.preventDefault();
    form.submit({
      description: [rules.required('Description'), rules.min(5, 'Description')],
      links: (list) => {
        for (const l of list) { const err = l.url.trim() ? rules.url('Link')(l.url.trim()) : null; if (err) return err; }
        return null;
      }
    }, async (v) => {
      const clean = v.links.filter((l) => l.url.trim());
      await api.post(`/tasks/${task._id}/submit`, { description: v.description.trim(), links: clean.map((l) => ({ label: l.label.trim() || 'Link', url: l.url.trim() })) });
      toast.success('Deliverable submitted for review');
      onDone();
    });
  };
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="submit-form">
      <h3 className="text-sm font-semibold text-slate-900">Submit your work</h3>
      <FormError error={form.formError} />
      <TextAreaField {...form.field('description')} label="What did you deliver?" rows={4} required hint="Summarise the work, how to review it and anything the reviewer should know." />
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-800">Links</p>
        {links.map((l, i) => (
          <div key={i} className="flex flex-col gap-2 sm:flex-row">
            <input aria-label={`Link ${i + 1} label`} value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} className="h-10 rounded-lg border border-slate-300 px-3 text-sm sm:w-40" placeholder="Label" />
            <input id={i === 0 ? 'field-links' : undefined} aria-label={`Link ${i + 1} URL`} data-testid={`submit-link-${i}`} value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm" placeholder="https://..." type="url" />
            {links.length > 1 && <Button variant="ghost" size="sm" onClick={() => form.set('links', links.filter((_, n) => n !== i))} aria-label={`Remove link ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>}
          </div>
        ))}
        {form.errors.links && <p role="alert" data-testid="error-links" className="text-xs font-medium text-rose-700">{form.errors.links}</p>}
        {links.length < 10 && <Button variant="ghost" size="sm" icon={Plus} onClick={() => form.set('links', [...links, { label: '', url: '' }])}>Add link</Button>}
      </div>
      <Button type="submit" loading={form.submitting} data-testid="submit-deliverable">Submit for review</Button>
    </form>
  );
}

function ReviewForm({ task, submission, onDone }) {
  const toast = useToast();
  const form = useForm({ decision: 'APPROVED', reviewNotes: '' });
  const f = form.field;
  const onSubmit = (e) => {
    e.preventDefault();
    form.submit({ reviewNotes: (v, all) => (all.decision !== 'APPROVED' && !String(v).trim() ? 'Explain what needs to change' : null) }, async (v) => {
      await api.post(`/tasks/${task._id}/review`, { submissionId: submission._id, decision: v.decision, ...(v.reviewNotes.trim() ? { reviewNotes: v.reviewNotes.trim() } : {}) });
      toast.success(`Review saved: ${humanize(v.decision)}`);
      onDone();
    });
  };
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="review-form">
      <h3 className="text-sm font-semibold text-slate-900">Review latest submission (v{submission.version})</h3>
      <FormError error={form.formError} />
      <SelectField {...f('decision')} label="Decision" options={[{ value: 'APPROVED', label: 'Approve' }, { value: 'REVISION_REQUIRED', label: 'Request revision' }, { value: 'REJECTED', label: 'Reject (back to In Progress)' }]} />
      <TextAreaField {...f('reviewNotes')} label="Review notes" rows={3} hint="Required unless approving." />
      <Button type="submit" loading={form.submitting} data-testid="submit-review">Save review</Button>
    </form>
  );
}

/** One task, seen by whoever opens it. Buttons appear only for actions this person can really take. */
export function TaskDetailModal({ taskId, onClose, onChanged, onEdit }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const state = useFetch(() => api.get(`/tasks/${taskId}`), [taskId]);
  const move = useAction();
  const refresh = () => { state.reload({ silent: true }); onChanged?.(); };

  const changeStatus = (task, status) => move.run(async () => {
    try { await api.post(`/tasks/${task._id}/status`, { status }); toast.success(`Task moved to ${humanize(status)}`); refresh(); }
    catch (e) { toast.error(e.message); refresh(); }
  });

  return (
    <Modal open onClose={onClose} size="lg" testId="task-modal" title={state.data?.task?.title || 'Task'}>
      <StateView state={state} loadingLabel="Loading task...">
        {({ task, submissions }) => {
          const isAssignee = (task.assignedTo || []).some((a) => idOf(a) === user._id);
          const staff = can('tasks.assign');
          const table = staff ? TASK_STAFF_TRANSITIONS : (isAssignee && can('tasks.progress') ? TASK_ASSIGNEE_TRANSITIONS : {});
          const next = table[task.status] || [];
          const latest = submissions[0];
          const canReview = can('tasks.review') && !isAssignee && TASK_REVIEWABLE_STATUSES.includes(task.status) && latest?.status === 'SUBMITTED';
          const canSubmit = isAssignee && can('tasks.submit') && TASK_SUBMITTABLE_STATUSES.includes(task.status);
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge status={task.status} testId="task-status" /><StatusBadge status={task.priority} testId="task-priority" /></div>
              <DetailList items={[
                { label: 'Project', value: task.projectId?.name || '-' }, { label: 'Assigned to', value: (task.assignedTo || []).map(fullName).join(', ') || 'Unassigned' },
                { label: 'Created by', value: fullName(task.createdBy) }, { label: 'Due', value: fmtDate(task.dueDate) }, { label: 'Estimated hours', value: task.estimatedHours || '-' },
                { label: 'Tags', value: (task.tags || []).join(', ') || '-' }
              ]} />
              {task.description && <p className="whitespace-pre-line text-sm text-slate-800">{task.description}</p>}
              {(task.links || []).length > 0 && <ul className="text-sm">{task.links.map((l, i) => <li key={i}><a className="text-brand-800 underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a></li>)}</ul>}

              {(next.length > 0 || (staff && onEdit && !['APPROVED', 'CANCELLED'].includes(task.status))) && (
                <div className="flex flex-wrap gap-2" data-testid="task-actions">
                  {next.map((s) => <Button key={s} size="sm" variant={s === 'CANCELLED' ? 'danger' : 'outline'} loading={move.pending} onClick={() => changeStatus(task, s)} data-testid={`task-move-${s}`}>{s === 'CANCELLED' ? 'Cancel task' : `Move to ${humanize(s)}`}</Button>)}
                  {staff && onEdit && !['APPROVED', 'CANCELLED'].includes(task.status) && <Button size="sm" variant="outline" onClick={() => onEdit(task)} data-testid="task-edit">Edit</Button>}
                </div>
              )}
              {canSubmit && <SubmitForm task={task} onDone={refresh} />}
              {canReview && <ReviewForm task={task} submission={latest} onDone={refresh} />}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Submissions</h3>
                {submissions.length === 0 ? <p className="text-sm text-slate-600">Nothing submitted yet.</p> : (
                  <ul className="space-y-3" data-testid="submissions">
                    {submissions.map((s) => (
                      <li key={s._id} className="rounded-lg border border-slate-200 p-3 text-sm" data-testid={`submission-${s.version}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900">Version {s.version} by {fullName(s.submittedBy)}</span><StatusBadge status={s.status} /></div>
                        <p className="mt-1 whitespace-pre-line text-slate-800">{s.description}</p>
                        {(s.links || []).map((l, i) => <p key={i}><a className="text-brand-800 underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a></p>)}
                        <p className="mt-1 text-xs text-slate-600">Submitted {fmtDateTime(s.createdAt)}</p>
                        {s.reviewNotes && <p className="mt-2 rounded bg-slate-50 p-2 text-slate-800"><strong>{fullName(s.reviewerId)}:</strong> {s.reviewNotes}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        }}
      </StateView>
    </Modal>
  );
}
