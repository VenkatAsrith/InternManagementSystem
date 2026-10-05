import React from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Clock, GraduationCap, NotebookPen, Star } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { fmtDate, fmtPercent, fullName, humanize } from '../../lib/format';
import { InlineAlert, PageHeader, ProgressBar, SectionCard, StatCard, StateView, StatusBadge } from '../../components/ui';

/** Every number on this page is computed by GET /interns/me from stored records. Nothing is hardcoded. */
export function InternDashboardPage() {
  const { user } = useAuth();
  const state = useFetch(() => api.get('/interns/me'), []);
  return (
    <>
      <PageHeader title={`Welcome, ${user.firstName}`} description="Your internship at a glance." />
      <StateView state={state} loadingLabel="Loading your workspace...">
        {({ intern, dashboard: d, viewingAsAdmin }) => (
          <div className="space-y-6">
            {(viewingAsAdmin || user?.role === 'SUPER_ADMIN') && (
              <InlineAlert tone="info" testId="admin-preview-banner" title="Global Admin Workspace View Mode" action={<Link to="/admin/global-command" className="text-sm font-semibold underline">Return to Global Command &rarr;</Link>}>
                You are viewing the live participant intern experience as a platform administrator.
              </InlineAlert>
            )}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <StatusBadge status={intern.status} testId="intern-status" />
              <span className="font-mono text-xs text-slate-700" data-testid="intern-code">{intern.internId}</span>
              <span className="text-sm text-slate-800">{intern.programId?.title}</span>
              <span className="text-sm text-slate-700">Mentor: {intern.mentorId ? fullName(intern.mentorId) : 'not assigned yet'}</span>
            </div>
            {['PRE_ONBOARDING', 'ONBOARDING'].includes(intern.status) && (
              <InlineAlert tone="warning" testId="onboarding-banner" title="Finish onboarding to activate your internship" action={<Link to="/intern/onboarding" className="text-sm font-semibold underline">Open checklist</Link>}>
                {d.onboarding ? `${d.onboarding.progress}% complete.` : 'Your checklist is being prepared.'}
              </InlineAlert>
            )}
            {['EXIT_INITIATED', 'ASSET_CLEARANCE', 'FINAL_SETTLEMENT', 'CERTIFICATION'].includes(intern.status) && (
              <InlineAlert tone="info" testId="exit-banner" title="Your internship is wrapping up" action={<Link to="/intern/exit" className="text-sm font-semibold underline">See progress</Link>}>Current stage: {humanize(intern.status)}.</InlineAlert>
            )}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="intern-kpis">
              <StatCard testId="kpi-day" label="Day" value={d.dayNumber > 0 ? `${d.dayNumber} of ${d.totalProgramDays}` : 'Not started'} icon={Clock} tone="sky" />
              <StatCard testId="kpi-progress" label="Overall progress" value={fmtPercent(d.overallProgress)} tone="emerald" hint="Tasks, time and learning" />
              <StatCard testId="kpi-attendance" label="Attendance" value={d.attendance.percent == null ? '-' : fmtPercent(d.attendance.percent, 1)} hint={`${d.attendance.attendedDays} of ${d.attendance.expectedDays} days`} icon={Clock} tone="amber" to="/intern/attendance" />
              <StatCard testId="kpi-tasks" label="Open tasks" value={d.tasks.pending} hint={`${d.tasks.completed} approved, ${d.tasks.dueSoon} due soon`} icon={CheckSquare} tone="purple" to="/intern/tasks" />
              <StatCard testId="kpi-learning" label="Learning" value={fmtPercent(d.learning.percent)} hint={`${d.learning.completed} of ${d.learning.total} lessons`} icon={GraduationCap} to="/intern/learning" />
              <StatCard testId="kpi-journal" label="Journal today" value={d.journalToday.submitted ? 'Submitted' : 'Not yet'} icon={NotebookPen} tone={d.journalToday.submitted ? 'emerald' : 'rose'} to="/intern/journal" />
              <StatCard testId="kpi-score" label="Latest review" value={d.performanceScore == null ? '-' : `${d.performanceScore} / 10`} icon={Star} to="/intern/performance" />
              <StatCard testId="kpi-checkin" label="Today" value={d.todayAttendance.checkedIn ? (d.todayAttendance.checkedOut ? 'Checked out' : 'Checked in') : 'Not checked in'} to="/intern/attendance" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Progress" testId="progress-card"><ProgressBar value={d.overallProgress} label="Overall progress" /><p className="mt-2 text-xs text-slate-700">Half from approved tasks, then time elapsed, then learning.</p></SectionCard>
              <SectionCard title="Upcoming meetings" testId="meetings-card">
                {d.upcomingMeetings.length === 0 ? <p className="text-sm text-slate-600">No upcoming meetings.</p> : <ul className="divide-y divide-slate-100">{d.upcomingMeetings.map((m) => <li key={m._id} className="py-2 text-sm"><p className="font-medium text-slate-900">{m.title}</p><p className="text-xs text-slate-700">{fmtDate(m.scheduledDate)}, {m.startTime}-{m.endTime}</p></li>)}</ul>}
              </SectionCard>
            </div>
          </div>
        )}
      </StateView>
    </>
  );
}
