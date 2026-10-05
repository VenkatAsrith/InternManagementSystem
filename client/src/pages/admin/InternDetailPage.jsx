import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { useStaffUsers, userLabel } from '../../hooks/useRefData';
import { fmtDate, fmtDateTime, fullName, humanize, fmtPercent } from '../../lib/format';
import { INTERN_MANUAL_TRANSITIONS } from '@shared/lifecycle.js';
import { Button, DataTable, DetailList, FormModal, InlineAlert, PageHeader, SectionCard, SelectField, StateView, StatusBadge, TabPanel, Tabs, TextAreaField, TextField, Timeline, StatCard } from '../../components/ui';
import { AssignTemplateModal } from './DocumentsPage';

function MentorModal({ intern, onClose, onDone }) {
  const toast = useToast();
  const { mentors } = useStaffUsers();
  const form = useForm({ mentorId: intern.mentorId?._id || '' });
  return (
    <FormModal open onClose={onClose} size="sm" testId="mentor-modal" title="Assign mentor" submitLabel="Assign" form={form} rules={{ mentorId: rules.required('Mentor') }}
      onSubmit={(v) => api.patch(`/interns/${intern._id}`, { mentorId: v.mentorId })} onDone={() => { toast.success('Mentor assigned. Both people were notified.'); onDone(); }}>
      <SelectField {...form.field('mentorId')} label="Mentor" required placeholder="Select a mentor" options={mentors.map((m) => ({ value: m._id, label: userLabel(m) }))} />
    </FormModal>
  );
}

function ExtendModal({ intern, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ expectedEndDate: String(intern.expectedEndDate).slice(0, 10), reason: '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="sm" testId="extend-modal" title="Change end date" description="The change is recorded with your reason." submitLabel="Save end date" form={form}
      rules={{ expectedEndDate: [rules.required('End date'), (v) => (v && v <= String(intern.startDate).slice(0, 10) ? 'End date must be after the start date' : null)], reason: [rules.required('Reason'), rules.min(3, 'Reason')] }}
      onSubmit={(v) => api.patch(`/interns/${intern._id}`, { expectedEndDate: v.expectedEndDate, reason: v.reason.trim() })} onDone={() => { toast.success('End date updated'); onDone(); }}>
      <TextField {...f('expectedEndDate')} label="New end date" type="date" required />
      <TextAreaField {...f('reason')} label="Reason" required rows={2} />
    </FormModal>
  );
}

function StatusModal({ intern, onClose, onDone }) {
  const toast = useToast();
  const allowed = INTERN_MANUAL_TRANSITIONS[intern.status] || [];
  const form = useForm({ status: allowed[0] || '' });
  return (
    <FormModal open onClose={onClose} size="sm" testId="status-modal" title="Change status" description="Only steps allowed by the internship lifecycle are listed. Exit steps are handled in Exit & Offboarding." submitLabel="Change status" form={form} rules={{ status: rules.required('Status') }}
      onSubmit={(v) => api.patch(`/interns/${intern._id}`, { status: v.status })} onDone={() => { toast.success('Status updated'); onDone(); }}>
      <SelectField {...form.field('status')} label="New status" required options={allowed.map((s) => ({ value: s, label: humanize(s) }))} />
    </FormModal>
  );
}

export function InternDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState(null);
  const state = useFetch(() => api.get(`/interns/${id}`), [id]);
  const timeline = useFetch(() => api.get(`/interns/${id}/timeline`), [id], { enabled: tab === 'timeline' });
  const work = useFetch(() => api.get(`/interns/${id}/work-record`), [id], { enabled: tab === 'work' });
  const done = () => { setModal(null); state.reload({ silent: true }); };

  return (
    <StateView state={state} loadingLabel="Loading intern...">
      {({ intern, metrics }) => {
        const allowed = INTERN_MANUAL_TRANSITIONS[intern.status] || [];
        const canEdit = can('interns.update') && !['ALUMNI', 'TERMINATED'].includes(intern.status);
        return (
          <>
            <PageHeader breadcrumbs={[{ label: 'Interns', to: '/admin/interns' }, { label: intern.internId }]} title={fullName(intern.userId)} description={`${intern.programId?.title || ''} - ${intern.departmentId?.name || ''}`}
              actions={<>
                <StatusBadge status={intern.status} testId="intern-status" />
                {can('documents.generate') && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={FileText}
                    onClick={() => setModal('assignDocs')}
                    data-testid="assign-docs-btn"
                  >
                    Assign Documents
                  </Button>
                )}
                {can('exit.initiate') && !['ALUMNI', 'TERMINATED', 'PRE_ONBOARDING', 'ONBOARDING'].includes(intern.status) && !intern.status.startsWith('EXIT') && (
                  <Link to={`/admin/exits?initiate=${intern._id}`} className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600" data-testid="start-exit">Start exit</Link>
                )}
              </>} />
            <Tabs label="Intern sections" active={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'work', label: 'Work record' }, { id: 'timeline', label: 'Timeline' }]} />
            <TabPanel id="overview" active={tab}>
              <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Attendance" value={metrics.attendancePercent == null ? '-' : fmtPercent(metrics.attendancePercent, 1)} hint={`${metrics.daysPresent} days present`} />
                <StatCard label="Journals logged" value={metrics.journalsLogged} />
                <StatCard label="Onboarding" value={metrics.onboardingProgress == null ? '-' : fmtPercent(metrics.onboardingProgress)} />
                <StatCard label="Recent tasks" value={intern.recentTasks?.length ?? 0} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <SectionCard title="Engagement" testId="engagement-card" actions={canEdit && <Button size="sm" variant="outline" onClick={() => setModal('extend')} data-testid="change-end-date">Change end date</Button>}>
                  <DetailList items={[
                    { label: 'Intern ID', value: intern.internId }, { label: 'Email', value: intern.userId?.email }, { label: 'Phone', value: intern.userId?.phone || '-' },
                    { label: 'Source', value: humanize(intern.source || 'APPLICATION'), testId: 'intern-source' },
                    ...(intern.source === 'REFERRAL' ? [
                      { label: 'Referred By', value: intern.referral?.referredById ? fullName(intern.referral.referredById) : (intern.referral?.referralName || 'Direct Referral') },
                      ...(intern.referral?.relationship ? [{ label: 'Relationship', value: intern.referral.relationship }] : [])
                    ] : []),
                    { label: 'Work mode', value: humanize(intern.workMode) }, { label: 'Start date', value: fmtDate(intern.startDate) }, { label: 'Expected end', value: fmtDate(intern.expectedEndDate), testId: 'expected-end' },
                    { label: 'Activated', value: intern.activatedAt ? fmtDate(intern.activatedAt) : 'Not yet' }
                  ]} />
                  {(intern.extensionHistory || []).length > 0 && <div className="mt-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">End-date changes</h3><ul className="mt-1 space-y-1 text-xs text-slate-800">{intern.extensionHistory.map((e, i) => <li key={i}>{fmtDate(e.previousEndDate)} to {fmtDate(e.newEndDate)}: {e.reason}</li>)}</ul></div>}
                </SectionCard>
                <SectionCard title="Supervision" testId="supervision-card" actions={canEdit && <Button size="sm" variant="outline" onClick={() => setModal('mentor')} data-testid="assign-mentor">{intern.mentorId ? 'Change mentor' : 'Assign mentor'}</Button>}>
                  <DetailList cols={1} items={[{ label: 'Mentor', value: intern.mentorId ? fullName(intern.mentorId) : 'Unassigned', testId: 'intern-mentor' }, { label: 'Manager', value: intern.managerId ? fullName(intern.managerId) : '-' }]} />
                  {canEdit && allowed.length > 0 && <Button size="sm" variant="outline" className="mt-4" onClick={() => setModal('status')} data-testid="change-status">Change status</Button>}
                  {intern.status.startsWith('EXIT') || ['ASSET_CLEARANCE', 'FINAL_SETTLEMENT', 'CERTIFICATION'].includes(intern.status) ? <InlineAlert tone="warning" className="mt-4">This internship is in the exit process. Manage it in Exit & Offboarding.</InlineAlert> : null}
                </SectionCard>
                <SectionCard title="Recent tasks" className="lg:col-span-2">
                  <DataTable testId="recent-tasks" columns={[{ key: 'title', header: 'Task' }, { key: 'priority', header: 'Priority', render: (t) => <StatusBadge status={t.priority} /> }, { key: 'due', header: 'Due', render: (t) => fmtDate(t.dueDate) }, { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> }]} rows={intern.recentTasks || []} emptyTitle="No tasks assigned" caption="Recent tasks" />
                </SectionCard>
              </div>
            </TabPanel>
            <TabPanel id="work" active={tab}>
              <StateView state={work} loadingLabel="Loading work record...">
                {({ summary, activities }) => (
                  <>
                    <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
                      <StatCard label="Tasks" value={`${summary.completedTasks}/${summary.totalTasks}`} hint="approved / total" />
                      <StatCard label="Journals" value={summary.totalJournals} /><StatCard label="Days attended" value={summary.attendanceRecordsCount} />
                      <StatCard label="Meetings" value={summary.totalMeetings} /><StatCard label="Reviews" value={summary.reviewsCount} />
                    </div>
                    <DataTable testId="activity-table" rows={activities.map((a, i) => ({ ...a, _id: `${a.type}-${i}` }))} columns={[
                      { key: 'date', header: 'Date', render: (a) => fmtDate(a.date) }, { key: 'type', header: 'Type', render: (a) => humanize(a.type) }, { key: 'title', header: 'Activity' },
                      { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> }]} emptyTitle="No activity yet" caption="Work activity" />
                  </>
                )}
              </StateView>
            </TabPanel>
            <TabPanel id="timeline" active={tab}>
              <StateView state={timeline} loadingLabel="Loading timeline...">
                {(items) => <Timeline items={items.map((t, i) => ({ key: i, title: humanize(t.action), meta: `${fmtDateTime(t.timestamp)}${t.actorEmail ? ` - ${t.actorEmail}` : ''}` }))} emptyText="No recorded events." />}
              </StateView>
            </TabPanel>
            {modal === 'mentor' && <MentorModal intern={intern} onClose={() => setModal(null)} onDone={done} />}
            {modal === 'extend' && <ExtendModal intern={intern} onClose={() => setModal(null)} onDone={done} />}
            {modal === 'status' && <StatusModal intern={intern} onClose={() => setModal(null)} onDone={done} />}
            {modal === 'assignDocs' && <AssignTemplateModal defaultInternId={intern._id} onClose={() => setModal(null)} onDone={done} />}
          </>
        );
      }}
    </StateView>
  );
}
