import React from 'react';
import { Activity, CheckSquare, Clock, GraduationCap, Star, Users, UserCheck, FileText } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { fmtPercent } from '../../lib/format';
import { PageHeader, SectionCard, StatCard, StateView, ProgressBar, InlineAlert } from '../../components/ui';

/** Every number is aggregated by the API. A missing value renders "-", never an invented placeholder. */
export function AdminDashboardPage() {
  const { organization, can } = useAuth();
  const state = useFetch(() => api.get('/analytics/dashboard'), []);

  return (
    <>
      <PageHeader title="Dashboard" description={`Live overview for ${organization?.name || 'your organization'}. Figures are calculated from current records.`} />
      <StateView state={state} loadingLabel="Loading dashboard...">
        {(d) => (
          <div className="space-y-6" data-testid="dashboard-loaded">
            {d.recruitment.totalApplications === 0 && d.interns.total === 0 && (
              <InlineAlert tone="info" testId="dashboard-empty" title="Nothing to report yet">There are no applications or interns in this organization. Figures will appear as work starts.</InlineAlert>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard testId="kpi-applications" label="Applications" value={d.recruitment.totalApplications} icon={FileText} tone="sky" to={can('applications.read') ? '/admin/applications' : undefined} />
              <StatCard testId="kpi-active-interns" label="Active interns" value={d.interns.active} hint={`${d.interns.onboarding} onboarding`} icon={Users} tone="emerald" to={can('interns.read') ? '/admin/interns' : undefined} />
              <StatCard testId="kpi-offer-acceptance" label="Offer acceptance" value={d.recruitment.offerAcceptanceRate == null ? '-' : fmtPercent(d.recruitment.offerAcceptanceRate, 1)} hint="Accepted of decided offers" icon={UserCheck} tone="purple" />
              <StatCard testId="kpi-completion" label="Program completion" value={d.interns.completionRate == null ? '-' : fmtPercent(d.interns.completionRate)} hint={`${d.interns.completed} alumni of ${d.interns.total}`} icon={GraduationCap} tone="amber" />
              <StatCard testId="kpi-task-completion" label="Task completion" value={d.tasks.completionRate == null ? '-' : fmtPercent(d.tasks.completionRate)} hint={`${d.tasks.completed} of ${d.tasks.total} approved`} icon={CheckSquare} tone="emerald" to={can('tasks.read') ? '/admin/tasks' : undefined} />
              <StatCard testId="kpi-attendance" label={`Attendance (${d.attendance.windowDays} days)`} value={d.attendance.attendanceRate == null ? '-' : fmtPercent(d.attendance.attendanceRate, 1)} hint={`${d.attendance.internsCounted} working interns`} icon={Clock} tone="sky" />
              <StatCard testId="kpi-avg-hours" label="Average hours / day" value={d.attendance.avgHours == null ? '-' : d.attendance.avgHours} icon={Activity} tone="slate" />
              <StatCard testId="kpi-performance" label="Average review score" value={d.performance.avgScore == null ? '-' : `${d.performance.avgScore} / 10`} hint={`${d.performance.reviewsFinalized} finalized reviews`} icon={Star} tone="amber" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Recruitment pipeline" description="Applications currently in each stage" testId="pipeline-card">
                <ul className="space-y-3">
                  {d.recruitment.funnel.map((s) => (
                    <li key={s.key} data-testid={`funnel-${s.key}`}>
                      <div className="mb-1 flex justify-between text-sm"><span className="text-slate-800">{s.stage}</span><span className="font-semibold text-slate-900">{s.count}</span></div>
                      <ProgressBar value={d.recruitment.totalApplications ? (s.count / d.recruitment.totalApplications) * 100 : 0} label={`${s.stage}: ${s.count}`} />
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-slate-600">Left the pipeline: {d.recruitment.branches.map((b) => `${b.stage} ${b.count}`).join(' / ')}</p>
              </SectionCard>

              <SectionCard title="Intern lifecycle" description="Interns by current status" testId="intern-status-card">
                {d.interns.byStatus.length === 0 ? <p className="text-sm text-slate-600">No interns yet.</p> : (
                  <ul className="divide-y divide-slate-100">
                    {d.interns.byStatus.map((s) => (
                      <li key={s.status} className="flex items-center justify-between py-2 text-sm"><span className="text-slate-800">{s.status.replace(/_/g, ' ')}</span><span className="font-semibold text-slate-900">{s.count}</span></li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </div>
        )}
      </StateView>
    </>
  );
}
