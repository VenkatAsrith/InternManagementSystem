import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDebounced } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDateTime, fullName, humanize, todayISO } from '../../lib/format';
import { INTERVIEW_STATUS, INTERVIEW_RECOMMENDATION } from '@shared/constants.js';
import { Button, DataTable, DetailList, FilterBar, FormGrid, FormModal, Modal, PageHeader, Pagination, SelectField, StatusBadge, TextAreaField, TextField, CheckboxField } from '../../components/ui';

const ACTIVE = ['SCHEDULED', 'RESCHEDULED'];
const CRITERIA = [
  ['technicalKnowledge', 'Technical knowledge'], ['communication', 'Communication'], ['problemSolving', 'Problem solving'],
  ['relevantExperience', 'Relevant experience'], ['learningAbility', 'Learning ability'], ['cultureFit', 'Culture fit']
];

function ScorecardModal({ interview, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ ...Object.fromEntries(CRITERIA.map(([k]) => [k, ''])), recommendation: '', comments: '' });
  const f = form.field;
  return (
    <FormModal
      open onClose={onClose} size="lg" testId="scorecard-modal" title="Submit scorecard" description={`${fullName(interview.candidateId)} - ${humanize(interview.type)} interview`} submitLabel="Submit scorecard" form={form}
      rules={{
        ...Object.fromEntries(CRITERIA.map(([k, l]) => [k, [rules.required(l), rules.number(l, { min: 1, max: 10 }), (v) => (v && !Number.isInteger(Number(v)) ? `${l} must be a whole number` : null)]])),
        recommendation: rules.required('Recommendation'), comments: [rules.required('Comments'), rules.min(10, 'Comments')]
      }}
      onSubmit={(v) => api.post(`/interviews/${interview._id}/feedback`, { ...Object.fromEntries(CRITERIA.map(([k]) => [k, Number(v[k])])), recommendation: v.recommendation, comments: v.comments.trim() })}
      onDone={() => { toast.success('Scorecard submitted'); onDone(); }}
    >
      <p className="text-sm text-slate-700">Rate each area from 1 (weak) to 10 (excellent).</p>
      <FormGrid cols={3}>{CRITERIA.map(([k, label]) => <TextField key={k} {...f(k)} label={label} type="number" min="1" max="10" required />)}</FormGrid>
      <SelectField {...f('recommendation')} label="Recommendation" required placeholder="Choose" options={Object.values(INTERVIEW_RECOMMENDATION).map((r) => ({ value: r, label: humanize(r) }))} />
      <TextAreaField {...f('comments')} label="Comments" required rows={4} hint="At least 10 characters." />
    </FormModal>
  );
}

function RescheduleModal({ interview, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ scheduledDate: todayISO(), startTime: '10:00', endTime: '11:00', reason: '' });
  const f = form.field;
  return (
    <FormModal
      open onClose={onClose} testId="reschedule-modal" title="Reschedule interview" submitLabel="Reschedule" form={form}
      rules={{ scheduledDate: rules.required('Date'), startTime: rules.required('Start time'), endTime: [rules.required('End time'), (v, a) => (v && a.startTime && v <= a.startTime ? 'End time must be after the start time' : null)], reason: [rules.required('Reason'), rules.min(3, 'Reason')] }}
      onSubmit={(v) => api.post(`/interviews/${interview._id}/reschedule`, { scheduledDate: v.scheduledDate, startTime: v.startTime, endTime: v.endTime, reason: v.reason.trim() })}
      onDone={() => { toast.success('Interview rescheduled'); onDone(); }}
    >
      <FormGrid>
        <TextField {...f('scheduledDate')} label="New date" type="date" required min={todayISO()} />
        <div className="grid grid-cols-2 gap-3"><TextField {...f('startTime')} label="Start" type="time" required /><TextField {...f('endTime')} label="End" type="time" required /></div>
      </FormGrid>
      <TextAreaField {...f('reason')} label="Reason" required rows={2} />
    </FormModal>
  );
}

function CancelModal({ interview, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ status: 'CANCELLED', reason: '' });
  const f = form.field;
  return (
    <FormModal
      open onClose={onClose} size="sm" testId="cancel-interview-modal" title="Cancel interview" submitLabel="Confirm" submitVariant="danger" form={form}
      rules={{ reason: [rules.required('Reason'), rules.min(3, 'Reason')] }}
      onSubmit={(v) => api.patch(`/interviews/${interview._id}/status`, { status: v.status, reason: v.reason.trim() })}
      onDone={() => { toast.success('Interview updated. The application returned to a schedulable stage.'); onDone(); }}
    >
      <SelectField {...f('status')} label="Outcome" options={[{ value: 'CANCELLED', label: 'Cancelled' }, { value: 'NO_SHOW', label: 'Candidate did not attend' }]} />
      <TextAreaField {...f('reason')} label="Reason" required rows={2} />
    </FormModal>
  );
}

function DetailModal({ interview, onClose }) {
  return (
    <Modal open onClose={onClose} size="lg" testId="interview-detail" title={`${fullName(interview.candidateId)} - ${humanize(interview.type)} interview`}>
      <DetailList items={[
        { label: 'When', value: `${fmtDateTime(interview.startsAt)} - ${fmtDateTime(interview.endsAt)}` }, { label: 'Status', value: <StatusBadge status={interview.status} /> },
        { label: 'Mode', value: humanize(interview.mode) }, { label: interview.mode === 'ONLINE' ? 'Meeting link' : 'Location', value: interview.mode === 'ONLINE' ? (interview.meetingLink ? <a className="text-brand-800 underline" href={interview.meetingLink} target="_blank" rel="noopener noreferrer">{interview.meetingLink}</a> : '-') : interview.location },
        { label: 'Panel', value: (interview.interviewers || []).map(fullName).join(', ') }, { label: 'Scorecards', value: `${interview.scorecardsSubmitted} of ${interview.scorecardsExpected}` }
      ]} />
      {(interview.feedback || []).length > 0 && (
        <div className="mt-5" data-testid="scorecards"><h3 className="mb-2 text-sm font-semibold text-slate-900">Scorecards</h3>
          <ul className="space-y-3">{interview.feedback.map((fb, i) => (
            <li key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-900">{humanize(fb.recommendation)}</p>
              <p className="mt-1 text-xs text-slate-700">{CRITERIA.map(([k, l]) => `${l} ${fb[k]}`).join(' / ')}</p>
              <p className="mt-2 text-slate-800 break-words">{fb.comments}</p>
            </li>
          ))}</ul>
        </div>
      )}
    </Modal>
  );
}

export function InterviewsPage() {
  const { can, user } = useAuth();
  const [status, setStatus] = useState('');
  const [upcoming, setUpcoming] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [modal, setModal] = useState(null); // { type, interview }
  const list = useList('/interviews', { filters: { status, search: q, upcoming: upcoming ? 'true' : '' } });
  const close = () => setModal(null);
  const done = () => { close(); list.reload({ silent: true }); };

  const cols = [
    { key: 'candidate', header: 'Candidate', render: (i) => <div><p className="font-medium text-slate-900">{fullName(i.candidateId)}</p><Link to={`/admin/applications/${i.applicationId?._id}`} className="font-mono text-xs text-brand-800 underline">{i.applicationId?.applicationId}</Link></div> },
    { key: 'round', header: 'Round', render: (i) => `${i.round} - ${humanize(i.type)}` },
    { key: 'when', header: 'When', render: (i) => fmtDateTime(i.startsAt) },
    { key: 'mode', header: 'Mode', render: (i) => humanize(i.mode) },
    { key: 'panel', header: 'Panel', render: (i) => (i.interviewers || []).map((p) => p.firstName).join(', ') },
    { key: 'score', header: 'Scorecards', render: (i) => `${i.scorecardsSubmitted}/${i.scorecardsExpected}` },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
    { key: 'actions', header: 'Actions', align: 'right', render: (i) => {
      const active = ACTIVE.includes(i.status);
      const onPanel = (i.interviewers || []).some((p) => p._id === user._id);
      const submitted = (i.feedback || []).some((fb) => String(fb.interviewerId?._id || fb.interviewerId) === String(user._id));
      return (
        <div className="flex flex-wrap justify-end gap-2">
          {i.mode === 'ONLINE' && i.meetingLink && (
            <a
              href={i.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-100"
              data-testid={`join-interview-${i._id}`}
            >
              <Video className="h-3 w-3" /> Meet
            </a>
          )}
          <Button size="sm" variant="outline" onClick={() => setModal({ type: 'detail', interview: i })} data-testid={`interview-view-${i._id}`}>View</Button>
          {active && onPanel && can('interviews.feedback') && !submitted && <Button size="sm" onClick={() => setModal({ type: 'score', interview: i })} data-testid={`interview-score-${i._id}`}>Scorecard</Button>}
          {active && can('interviews.schedule') && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'reschedule', interview: i })} data-testid={`interview-reschedule-${i._id}`}>Reschedule</Button>}
          {active && can('interviews.schedule') && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'cancel', interview: i })} data-testid={`interview-cancel-${i._id}`}>Cancel</Button>}
        </div>
      );
    } }
  ];

  return (
    <>
      <PageHeader title="Interviews" description="Interviews are scheduled from an application. The application moves to Interviewed once every panelist has submitted a scorecard." />
      <FilterBar>
        <TextField name="search" label="Search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Candidate name or application ID" />
        <SelectField name="status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={Object.values(INTERVIEW_STATUS).map((s) => ({ value: s, label: humanize(s) }))} />
        <div className="pb-2"><CheckboxField name="upcoming" label="Upcoming only" checked={upcoming} onChange={(e) => setUpcoming(e.target.checked)} /></div>
      </FilterBar>
      <DataTable testId="interviews-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} caption="Interviews" emptyTitle="No interviews" emptyDescription="Shortlist an application, then schedule an interview from its detail page." />
      <Pagination pagination={list.pagination} onPage={list.setPage} />
      {modal?.type === 'detail' && <DetailModal interview={modal.interview} onClose={close} />}
      {modal?.type === 'score' && <ScorecardModal interview={modal.interview} onClose={close} onDone={done} />}
      {modal?.type === 'reschedule' && <RescheduleModal interview={modal.interview} onClose={close} onDone={done} />}
      {modal?.type === 'cancel' && <CancelModal interview={modal.interview} onClose={close} onDone={done} />}
    </>
  );
}
