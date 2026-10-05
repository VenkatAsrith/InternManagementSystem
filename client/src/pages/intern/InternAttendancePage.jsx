import React, { useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import api from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { useAction } from '../../hooks/useForm';
import { fmtDate, fmtPercent, fmtTime } from '../../lib/format';
import { Button, DataTable, InlineAlert, PageHeader, Pagination, ProgressBar, SectionCard, SelectField, StatCard, StatusBadge } from '../../components/ui';

export function InternAttendancePage() {
  const toast = useToast();
  const today = useFetch(() => api.get('/attendance/today'), []);
  const summary = useFetch(() => api.get('/attendance/summary'), []);
  const history = useList('/attendance/my-history', { limit: 30 });
  const action = useAction();
  const [mode, setMode] = useState('REMOTE');
  const refresh = () => { today.reload({ silent: true }); summary.reload({ silent: true }); history.reload({ silent: true }); };

  const run = (kind) => action.run(async () => {
    try {
      const res = kind === 'in' ? await api.post('/attendance/check-in', { mode }) : await api.post('/attendance/check-out');
      toast.success(res.message);
      refresh();
    } catch (e) { toast.error(e.message); refresh(); }
  });

  const rec = today.data;
  const s = summary.data;
  const belowTarget = s && s.percent != null && s.percent < s.requiredPercent;

  return (
    <>
      <PageHeader title="Attendance" description="Check in when you start work and check out when you finish. Times are recorded by the server." />
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Today" testId="attendance-today" className="lg:col-span-1">
          {today.loading ? <p className="text-sm text-slate-600">Loading...</p> : today.error ? <InlineAlert tone="error">{today.error.message}</InlineAlert> : (
            <div className="space-y-4">
              {rec ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs font-semibold uppercase text-slate-600">Status</dt><dd className="mt-1"><StatusBadge status={rec.status} /></dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-slate-600">Check-in</dt><dd data-testid="today-checkin" className="mt-1">{fmtTime(rec.checkIn)}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-slate-600">Check-out</dt><dd data-testid="today-checkout" className="mt-1">{rec.checkOut ? fmtTime(rec.checkOut) : '-'}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-slate-600">Hours</dt><dd className="mt-1">{rec.totalHours ?? '-'}</dd></div>
                </dl>
              ) : <p className="text-sm text-slate-700" data-testid="not-checked-in">You have not checked in today.</p>}
              {!rec && (
                <>
                  <SelectField name="mode" label="Where are you working?" value={mode} onChange={(e) => setMode(e.target.value)} options={[{ value: 'REMOTE', label: 'Remote' }, { value: 'ON_SITE', label: 'On site' }, { value: 'HYBRID', label: 'Hybrid' }]} />
                  <Button icon={LogIn} loading={action.pending} onClick={() => run('in')} className="w-full" data-testid="check-in">Check in</Button>
                </>
              )}
              {rec && !rec.checkOut && rec.checkIn && <Button icon={LogOut} variant="outline" loading={action.pending} onClick={() => run('out')} className="w-full" data-testid="check-out">Check out</Button>}
              {rec?.checkOut && <InlineAlert tone="success" testId="day-complete">You are done for today.</InlineAlert>}
            </div>
          )}
        </SectionCard>

        <div className="space-y-6 lg:col-span-2">
          {summary.error ? <InlineAlert tone="error">{summary.error.message}</InlineAlert> : s && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="attendance-summary">
                <StatCard testId="stat-percent" label="Attendance" value={s.percent == null ? '-' : fmtPercent(s.percent, 1)} hint={`Required ${s.requiredPercent}%`} tone={belowTarget ? 'rose' : 'emerald'} />
                <StatCard label="Days attended" value={s.attendedDays} hint={`of ${s.expectedDays} expected`} />
                <StatCard label="Late days" value={s.lateDays} />
                <StatCard label="Absent days" value={s.absentDays} hint={`${s.leaveDays} on approved leave`} />
              </div>
              {s.percent != null && <ProgressBar value={s.percent} label="Attendance" />}
              {belowTarget && <InlineAlert tone="warning" testId="below-target">Your attendance is below the {s.requiredPercent}% needed for the completion certificate.</InlineAlert>}
            </>
          )}
          <SectionCard title="History" testId="attendance-history">
            <DataTable testId="attendance-table" rows={history.rows} loading={history.loading} error={history.error} onRetry={history.reload} caption="Attendance history" emptyTitle="No attendance yet" emptyDescription="Your check-ins will be listed here." columns={[
              { key: 'date', header: 'Date', render: (r) => fmtDate(r.date) }, { key: 'in', header: 'In', render: (r) => fmtTime(r.checkIn) }, { key: 'out', header: 'Out', render: (r) => fmtTime(r.checkOut) },
              { key: 'hours', header: 'Hours', render: (r) => r.totalHours ?? '-' }, { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} />
            <Pagination pagination={history.pagination} onPage={history.setPage} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
