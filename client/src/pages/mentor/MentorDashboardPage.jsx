import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckSquare, NotebookPen, Users } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { fmtDate, fullName } from '../../lib/format';
import { DataTable, PageHeader, SectionCard, StatCard, StateView, StatusBadge } from '../../components/ui';

/** Every figure is a live query scoped by the API to this mentor's own mentees. */
export function MentorDashboardPage() {
  const { can, user } = useAuth();
  const state = useFetch(async () => {
    const calls = {
      mentees: can('interns.read') ? api.get('/interns', { params: { open: true, limit: 50 } }) : null,
      journals: can('journals.read') ? api.get('/journals', { params: { status: 'SUBMITTED', limit: 1 } }) : null,
      tasks: can('tasks.read') ? Promise.all([api.get('/tasks', { params: { status: 'SUBMITTED', limit: 1 } }), api.get('/tasks', { params: { status: 'IN_REVIEW', limit: 1 } })]) : null,
      leaves: can('leaves.read') ? api.get('/leaves', { params: { status: 'REQUESTED', limit: 1 } }) : null,
      meetings: can('meetings.read') ? api.get('/meetings') : null
    };
    const entries = await Promise.all(Object.entries(calls).map(async ([k, p]) => [k, p ? await p : null]));
    return { data: Object.fromEntries(entries) };
  }, []);

  return (
    <>
      <PageHeader title="My mentees" description={`Welcome, ${user.firstName}. Here is what needs your attention.`} />
      <StateView state={state} loadingLabel="Loading your workload...">
        {(d) => {
          const upcoming = (d.meetings?.data || []).filter((m) => ['SCHEDULED', 'RESCHEDULED'].includes(m.status)).slice(0, 5);
          const toReview = (d.tasks ? d.tasks[0].pagination.total + d.tasks[1].pagination.total : null);
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="mentor-kpis">
                <StatCard testId="kpi-mentees" label="Mentees" value={d.mentees ? d.mentees.pagination.total : null} icon={Users} tone="sky" to="/admin/interns" />
                <StatCard testId="kpi-journals" label="Journals to review" value={d.journals ? d.journals.pagination.total : null} icon={NotebookPen} tone="amber" to="/admin/journals" />
                <StatCard testId="kpi-tasks" label="Tasks to review" value={toReview} icon={CheckSquare} tone="purple" to="/admin/tasks" />
                <StatCard testId="kpi-leaves" label="Leave requests" value={d.leaves ? d.leaves.pagination.total : null} icon={CalendarDays} tone="rose" to="/admin/leaves" />
              </div>
              {d.mentees && (
                <SectionCard title="Mentees" testId="mentees-card">
                  <DataTable testId="mentees-table" rows={d.mentees.data} rowKey={(i) => i.internId} caption="Mentees" emptyTitle="No mentees assigned" emptyDescription="Interns appear here once HR assigns you as their mentor." columns={[
                    { key: 'name', header: 'Intern', render: (i) => <Link className="font-medium text-brand-800 underline" to={`/admin/interns/${i._id}`}>{fullName(i.userId)}</Link> }, { key: 'id', header: 'ID', render: (i) => <span className="font-mono text-xs">{i.internId}</span> },
                    { key: 'end', header: 'Ends', render: (i) => fmtDate(i.expectedEndDate) }, { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> }]} />
                </SectionCard>
              )}
              {d.meetings && (
                <SectionCard title="Upcoming meetings" testId="meetings-card">
                  {upcoming.length === 0 ? <p className="text-sm text-slate-600">No upcoming meetings.</p> : <ul className="divide-y divide-slate-100">{upcoming.map((m) => <li key={m._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span className="font-medium text-slate-900">{m.title}</span><span className="text-slate-700">{fmtDate(m.scheduledDate)}, {m.startTime}-{m.endTime}</span></li>)}</ul>}
                </SectionCard>
              )}
            </div>
          );
        }}
      </StateView>
    </>
  );
}
