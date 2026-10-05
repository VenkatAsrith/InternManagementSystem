import React, { useState } from 'react';
import { useList } from '../../hooks/useList';
import { fmtDate, humanize } from '../../lib/format';
import { TASK_STATUS } from '@shared/constants.js';
import { DataTable, FilterBar, PageHeader, Pagination, SelectField, StatusBadge } from '../../components/ui';
import { TaskDetailModal } from '../../components/domain/TaskDetailModal';

export function InternTasksPage() {
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(null);
  const list = useList('/tasks', { filters: { status } });
  const cols = [
    { key: 'title', header: 'Task', render: (t) => <button type="button" className="text-left font-medium text-brand-800 underline" onClick={() => setOpen(t._id)} data-testid={`task-open-${t._id}`}>{t.title}</button> },
    { key: 'project', header: 'Project', render: (t) => t.projectId?.name || '-' },
    { key: 'priority', header: 'Priority', render: (t) => <StatusBadge status={t.priority} /> },
    { key: 'due', header: 'Due', render: (t) => fmtDate(t.dueDate) },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> }
  ];
  return (
    <>
      <PageHeader title="My tasks" description="Start a task, then submit your work for review. Your mentor reviews each submission." />
      <FilterBar><SelectField name="status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={Object.values(TASK_STATUS).map((s) => ({ value: s, label: humanize(s) }))} /></FilterBar>
      <DataTable testId="my-tasks-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} caption="My tasks" emptyTitle="No tasks assigned yet" emptyDescription="Your mentor will assign tasks once your internship is active." />
      <Pagination pagination={list.pagination} onPage={list.setPage} />
      {open && <TaskDetailModal taskId={open} onClose={() => setOpen(null)} onChanged={() => list.reload({ silent: true })} />}
    </>
  );
}
