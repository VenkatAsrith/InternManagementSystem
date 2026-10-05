import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, humanize, todayISO } from '../../lib/format';
import { LEAVE_TYPE } from '@shared/constants.js';
import { Button, CheckboxField, DataTable, FormGrid, FormModal, PageHeader, SelectField, StatusBadge, TextAreaField, TextField, useConfirm } from '../../components/ui';

function RequestModal({ onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ leaveType: 'CASUAL', startDate: todayISO(), endDate: todayISO(), halfDay: false, reason: '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} testId="leave-modal" title="Request leave" submitLabel="Submit request" form={form}
      rules={{
        startDate: rules.required('Start date'), endDate: [rules.required('End date'), (v, a) => (v && a.startDate && v < a.startDate ? 'End date cannot be before the start date' : null)],
        halfDay: (v, a) => (v && a.startDate !== a.endDate ? 'A half day must be a single date' : null), reason: [rules.required('Reason'), rules.min(3, 'Reason')]
      }}
      onSubmit={(v) => api.post('/leaves/request', { leaveType: v.leaveType, startDate: v.startDate, endDate: v.endDate, halfDay: !!v.halfDay, reason: v.reason.trim() })}
      onDone={() => { toast.success('Leave requested. Your mentor was notified.'); onDone(); }}>
      <FormGrid>
        <SelectField {...f('leaveType')} label="Type" options={Object.values(LEAVE_TYPE).map((t) => ({ value: t, label: humanize(t) }))} />
        <div />
        <TextField {...f('startDate')} label="From" type="date" required />
        <TextField {...f('endDate')} label="To" type="date" required />
      </FormGrid>
      <CheckboxField name="halfDay" label="Half day" checked={form.values.halfDay} onChange={f('halfDay').onChange} error={form.errors.halfDay} />
      <TextAreaField {...f('reason')} label="Reason" required rows={3} />
    </FormModal>
  );
}

export function InternLeavesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const state = useFetch(() => api.get('/leaves/me'), []);
  const [open, setOpen] = useState(false);
  const cancel = async (l) => {
    if (!(await confirm({ title: 'Cancel this leave request?', message: 'Approved leave that has not started will be removed from your attendance.', confirmLabel: 'Cancel leave', tone: 'danger' }))) return;
    try { await api.post(`/leaves/${l._id}/cancel`); toast.success('Leave cancelled'); state.reload({ silent: true }); } catch (e) { toast.error(e.message); state.reload({ silent: true }); }
  };
  const cols = [
    { key: 'type', header: 'Type', render: (l) => humanize(l.leaveType) },
    { key: 'dates', header: 'Dates', render: (l) => `${fmtDate(l.startDate)}${l.endDate !== l.startDate ? ` to ${fmtDate(l.endDate)}` : ''}` },
    { key: 'days', header: 'Days', render: (l) => l.totalDays },
    { key: 'reason', header: 'Reason', render: (l) => <span className="line-clamp-2 max-w-xs">{l.reason}</span> },
    { key: 'status', header: 'Status', render: (l) => <StatusBadge status={l.status} /> },
    { key: 'note', header: 'Reviewer note', render: (l) => l.reviewNotes || '-' },
    { key: 'actions', header: '', align: 'right', render: (l) => ['REQUESTED', 'APPROVED'].includes(l.status) && <Button size="sm" variant="outline" onClick={() => cancel(l)} data-testid={`leave-cancel-${l._id}`}>Cancel</Button> }
  ];
  return (
    <>
      <PageHeader title="Leave" description="Leave counts weekdays only. Weekends are not deducted." actions={<Button icon={Plus} onClick={() => setOpen(true)} data-testid="request-leave">Request leave</Button>} />
      <DataTable testId="my-leaves-table" columns={cols} rows={state.data || []} loading={state.loading} error={state.error} onRetry={state.reload} caption="My leave requests" emptyTitle="No leave requests" emptyDescription="Requests you make will be listed here with their status." />
      {open && <RequestModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); state.reload({ silent: true }); }} />}
    </>
  );
}
