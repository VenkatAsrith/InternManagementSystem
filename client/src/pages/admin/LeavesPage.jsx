import React, { useState } from 'react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useList } from '../../hooks/useList';
import { useAction } from '../../hooks/useForm';
import { fmtDate, fullName, humanize } from '../../lib/format';
import { LEAVE_STATUS } from '@shared/constants.js';
import { Button, DataTable, FilterBar, PageHeader, Pagination, SelectField, StatusBadge, useConfirm } from '../../components/ui';

export function LeavesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('REQUESTED');
  const list = useList('/leaves', { filters: { status } });
  const act = useAction();

  const review = (l, decision) => act.run(async () => {
    let reviewNotes;
    if (decision === 'REJECTED') {
      reviewNotes = await confirm({ title: 'Reject this leave request?', message: 'The intern sees your reason.', requireReason: true, reasonLabel: 'Reason', confirmLabel: 'Reject', tone: 'danger' });
      if (!reviewNotes) return;
    }
    try {
      await api.patch(`/leaves/${l._id}/review`, { status: decision, ...(reviewNotes ? { reviewNotes } : {}) });
      toast.success(`Leave ${decision.toLowerCase()}`);
    } catch (e) { toast.error(e.message); }
    list.reload({ silent: true });
  });

  const cols = [
    { key: 'intern', header: 'Intern', render: (l) => <div><p className="font-medium text-slate-900">{fullName(l.internId?.userId)}</p><p className="font-mono text-xs text-slate-600">{l.internId?.internId}</p></div> },
    { key: 'type', header: 'Type', render: (l) => humanize(l.leaveType) },
    { key: 'dates', header: 'Dates', render: (l) => `${fmtDate(l.startDate)}${l.endDate !== l.startDate ? ` to ${fmtDate(l.endDate)}` : ''}` },
    { key: 'days', header: 'Days', render: (l) => l.totalDays },
    { key: 'reason', header: 'Reason', render: (l) => <span className="line-clamp-2 max-w-xs">{l.reason}</span> },
    { key: 'status', header: 'Status', render: (l) => <StatusBadge status={l.status} /> },
    { key: 'reviewer', header: 'Reviewed by', render: (l) => (l.reviewedBy ? fullName(l.reviewedBy) : '-') },
    { key: 'actions', header: '', align: 'right', render: (l) => l.status === 'REQUESTED' && can('leaves.review') && (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="success" disabled={act.pending} onClick={() => review(l, 'APPROVED')} data-testid={`leave-approve-${l._id}`}>Approve</Button>
        <Button size="sm" variant="outline" disabled={act.pending} onClick={() => review(l, 'REJECTED')} data-testid={`leave-reject-${l._id}`}>Reject</Button>
      </div>
    ) }
  ];
  return (
    <>
      <PageHeader title="Leave requests" description="Approving leave marks those weekdays as leave in the intern's attendance." />
      <FilterBar><SelectField name="status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All" options={Object.values(LEAVE_STATUS).map((s) => ({ value: s, label: humanize(s) }))} /></FilterBar>
      <DataTable testId="leaves-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} caption="Leave requests" emptyTitle={status === 'REQUESTED' ? 'No pending requests' : 'No leave requests'} emptyDescription="Requests from your interns appear here." />
      <Pagination pagination={list.pagination} onPage={list.setPage} />
    </>
  );
}
