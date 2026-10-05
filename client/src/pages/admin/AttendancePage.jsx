import React, { useState } from 'react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { fmtTime, fullName, humanize, todayISO } from '../../lib/format';
import { ATTENDANCE_STATUS } from '@shared/constants.js';
import { Button, DataTable, FilterBar, FormModal, InlineAlert, PageHeader, SelectField, StatusBadge, TextAreaField, TextField } from '../../components/ui';

function CorrectModal({ record, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ status: record.status, totalHours: record.totalHours ?? '', reason: '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="sm" testId="correct-modal" title="Correct attendance" description={`${fullName(record.userId)} - ${record.internId?.internId}`} submitLabel="Save correction" form={form}
      rules={{ reason: [rules.required('Reason'), rules.min(5, 'Reason')], totalHours: rules.number('Hours', { min: 0, max: 24 }) }}
      onSubmit={(v) => api.patch(`/attendance/${record._id}`, { status: v.status, ...(v.totalHours !== '' ? { totalHours: Number(v.totalHours) } : {}), reason: v.reason.trim() })}
      onDone={() => { toast.success('Attendance corrected and logged in the audit trail'); onDone(); }}>
      <SelectField {...f('status')} label="Status" options={Object.values(ATTENDANCE_STATUS).map((s) => ({ value: s, label: humanize(s) }))} />
      <TextField {...f('totalHours')} label="Total hours" type="number" step="0.25" min="0" max="24" />
      <TextAreaField {...f('reason')} label="Reason for correction" required rows={2} hint="At least 5 characters. Kept in the audit log." />
    </FormModal>
  );
}

export function AttendancePage() {
  const { can } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState('');
  const [fix, setFix] = useState(null);
  const state = useFetch(() => api.get('/attendance/overview', { params: { date, ...(status ? { status } : {}) } }), [date, status]);
  const cols = [
    { key: 'intern', header: 'Intern', render: (r) => <div><p className="font-medium text-slate-900">{fullName(r.userId)}</p><p className="font-mono text-xs text-slate-600">{r.internId?.internId}</p></div> },
    { key: 'in', header: 'Check-in', render: (r) => fmtTime(r.checkIn) }, { key: 'out', header: 'Check-out', render: (r) => fmtTime(r.checkOut) },
    { key: 'hours', header: 'Hours', render: (r) => r.totalHours ?? '-' }, { key: 'mode', header: 'Mode', render: (r) => humanize(r.mode) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', align: 'right', render: (r) => can('attendance.manage') && <Button size="sm" variant="outline" onClick={() => setFix(r)} data-testid={`attendance-correct-${r._id}`}>Correct</Button> }
  ];
  return (
    <>
      <PageHeader title="Attendance" description="Attendance records for one day. Corrections need a reason and are audited." />
      <InlineAlert tone="info" className="mb-4">Interns who did not check in have no record for the day. Their absences count in the attendance percentage shown on each intern's profile.</InlineAlert>
      <FilterBar>
        <TextField name="date" label="Date" type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <SelectField name="status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All" options={Object.values(ATTENDANCE_STATUS).map((s) => ({ value: s, label: humanize(s) }))} />
      </FilterBar>
      <DataTable testId="attendance-table" columns={cols} rows={state.data || []} loading={state.loading} error={state.error} onRetry={state.reload} caption="Attendance records" emptyTitle="No attendance records for this day" emptyDescription="Pick another date or clear the status filter." />
      {fix && <CorrectModal record={fix} onClose={() => setFix(null)} onDone={() => { setFix(null); state.reload({ silent: true }); }} />}
    </>
  );
}
