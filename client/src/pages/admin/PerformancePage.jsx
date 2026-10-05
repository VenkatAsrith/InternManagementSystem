import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, fullName, humanize } from '../../lib/format';
import { PERFORMANCE_REVIEW_STATUS, PERFORMANCE_REVIEW_TYPE } from '@shared/constants.js';
import { Button, DataTable, DetailList, FilterBar, FormModal, InlineAlert, Modal, PageHeader, Pagination, SelectField, StatusBadge, TextAreaField, TextField } from '../../components/ui';

function ScoreGrid({ metrics, values, onChange, errors, disabled }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-sm" data-testid="score-grid">
        <caption className="sr-only">Competency scores from 0 to 10</caption>
        <thead className="bg-slate-50"><tr><th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-700">Competency</th><th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-700">Weight</th><th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-700">Score (0-10)</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {metrics.map((m, i) => (
            <tr key={m.metricName}>
              <td className="px-3 py-2 text-slate-900">{m.metricName}</td>
              <td className="px-3 py-2 text-slate-700">{m.weightPercent}%</td>
              <td className="px-3 py-2">
                <input aria-label={`Score for ${m.metricName}`} data-testid={`score-${i}`} type="number" min="0" max="10" step="0.5" disabled={disabled} value={values[i] ?? ''} onChange={(e) => onChange(i, e.target.value)}
                  className={`h-9 w-24 rounded-lg border px-2 text-sm ${errors?.[i] ? 'border-rose-600' : 'border-slate-300'}`} />
                {errors?.[i] && <p role="alert" className="mt-0.5 text-xs font-medium text-rose-700">{errors[i]}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function scoreErrors(values, count) {
  const e = {};
  for (let i = 0; i < count; i++) {
    const v = values[i];
    if (v === '' || v === undefined) e[i] = 'Required';
    else if (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 10) e[i] = 'Use 0 to 10';
  }
  return e;
}

function NewReviewModal({ onClose, onDone }) {
  const toast = useToast();
  const interns = useFetch(() => api.get('/interns', { params: { open: true, limit: 200 } }), []);
  const form = useForm({ internId: '', type: 'MID_TERM', cycleTitle: '' });
  const f = form.field;
  const working = (interns.data || []).filter((i) => ['ACTIVE', 'PERFORMANCE_REVIEW', 'EXIT_INITIATED'].includes(i.status));
  return (
    <FormModal open onClose={onClose} size="sm" testId="review-modal" title="Open performance review" submitLabel="Open review" form={form} rules={{ internId: rules.required('Intern') }}
      onSubmit={(v) => api.post('/performance/reviews', { internId: v.internId, type: v.type, ...(v.cycleTitle.trim() ? { cycleTitle: v.cycleTitle.trim() } : {}) })}
      onDone={() => { toast.success('Review opened. The intern was asked for a self-assessment.'); onDone(); }}>
      <SelectField {...f('internId')} label="Intern" required placeholder="Select an intern" options={working.map((i) => ({ value: i._id, label: `${fullName(i.userId)} (${i.internId})` }))} />
      <SelectField {...f('type')} label="Review type" options={Object.values(PERFORMANCE_REVIEW_TYPE).map((t) => ({ value: t, label: humanize(t) }))} />
      <TextField {...f('cycleTitle')} label="Cycle title" placeholder="Standard Internship Evaluation Cycle" />
      <InlineAlert tone="info">Eight standard competencies are used. Opening a mid-term or final review moves the intern to Performance Review until it is finalized.</InlineAlert>
    </FormModal>
  );
}

function MentorModal({ review, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ feedback: '' });
  const [scores, setScores] = useState(review.metrics.map(() => ''));
  const [errs, setErrs] = useState({});
  return (
    <FormModal open onClose={onClose} size="lg" testId="mentor-assessment-modal" title="Mentor assessment" description={`${fullName(review.userId)} - ${review.cycleTitle}`} submitLabel="Submit assessment" form={form}
      rules={{ feedback: [rules.required('Feedback'), rules.min(10, 'Feedback')], scores: () => { const e = scoreErrors(scores, review.metrics.length); setErrs(e); return Object.keys(e).length ? 'Score every competency' : null; } }}
      onSubmit={(v) => api.post(`/performance/reviews/${review._id}/mentor-assessment`, { feedback: v.feedback.trim(), scores: review.metrics.map((m, i) => ({ metricName: m.metricName, score: Number(scores[i]) })) })}
      onDone={() => { toast.success('Assessment submitted. The score is calculated by the system.'); onDone(); }}>
      {review.selfAssessment && <InlineAlert tone="info" title="Intern self-assessment" testId="self-assessment-summary"><p><strong>Strengths:</strong> {review.selfAssessment.strengths}</p><p className="mt-1"><strong>Growth areas:</strong> {review.selfAssessment.growthAreas}</p></InlineAlert>}
      <ScoreGrid metrics={review.metrics} values={scores} errors={errs} onChange={(i, v) => setScores((s) => s.map((x, n) => (n === i ? v : x)))} />
      {form.errors.scores && <p role="alert" data-testid="error-scores" className="text-xs font-medium text-rose-700">{form.errors.scores}</p>}
      <TextAreaField {...form.field('feedback')} label="Feedback" required rows={4} hint="At least 10 characters." />
    </FormModal>
  );
}

function FinalizeModal({ review, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ comments: '' });
  const [scores, setScores] = useState(review.metrics.map((m) => String(m.score ?? '')));
  const [errs, setErrs] = useState({});
  return (
    <FormModal open onClose={onClose} size="lg" testId="finalize-modal" title="Finalize review" description="Finalizing locks the review. You may adjust individual scores; the overall score is recalculated by the system." submitLabel="Finalize review" form={form}
      rules={{ comments: [rules.required('Comments'), rules.min(5, 'Comments')], scores: () => { const e = scoreErrors(scores, review.metrics.length); setErrs(e); return Object.keys(e).length ? 'Score every competency' : null; } }}
      onSubmit={(v) => api.post(`/performance/reviews/${review._id}/finalize`, { comments: v.comments.trim(), adjustedScores: review.metrics.map((m, i) => ({ metricName: m.metricName, score: Number(scores[i]) })) })}
      onDone={(res) => { toast.success(res.message); onDone(); }}>
      {review.mentorAssessment && <InlineAlert tone="info" title={`Mentor feedback (${fullName(review.mentorAssessment.evaluatorId)})`} testId="mentor-feedback">{review.mentorAssessment.feedback}</InlineAlert>}
      <ScoreGrid metrics={review.metrics} values={scores} errors={errs} onChange={(i, v) => setScores((s) => s.map((x, n) => (n === i ? v : x)))} />
      <TextAreaField {...form.field('comments')} label="Manager comments" required rows={3} />
    </FormModal>
  );
}

export function ReviewDetail({ review, onClose }) {
  return (
    <Modal open onClose={onClose} size="lg" testId="review-detail" title={`${fullName(review.userId)} - ${review.cycleTitle}`}>
      <DetailList items={[{ label: 'Type', value: humanize(review.type) }, { label: 'Status', value: <StatusBadge status={review.status} /> }, { label: 'Overall score', value: review.finalScore != null ? `${review.finalScore} / 10` : 'Not calculated yet', testId: 'review-score' }, { label: 'Finalized', value: review.finalizedAt ? fmtDate(review.finalizedAt) : '-' }]} />
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-full text-sm"><caption className="sr-only">Competency scores</caption><thead className="bg-slate-50"><tr><th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase">Competency</th><th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase">Weight</th><th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase">Score</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{review.metrics.map((m) => <tr key={m.metricName}><td className="px-3 py-2">{m.metricName}</td><td className="px-3 py-2">{m.weightPercent}%</td><td className="px-3 py-2">{review.status === 'FINALIZED' || review.mentorAssessment ? m.score : '-'}</td></tr>)}</tbody></table></div>
      {review.selfAssessment && <div className="mt-4 text-sm"><h3 className="font-semibold text-slate-900">Self-assessment</h3><p className="mt-1"><strong>Strengths:</strong> {review.selfAssessment.strengths}</p><p><strong>Growth areas:</strong> {review.selfAssessment.growthAreas}</p></div>}
      {review.mentorAssessment && <div className="mt-4 text-sm"><h3 className="font-semibold text-slate-900">Mentor feedback</h3><p className="mt-1">{review.mentorAssessment.feedback}</p></div>}
      {review.managerReview && <div className="mt-4 text-sm"><h3 className="font-semibold text-slate-900">Manager comments</h3><p className="mt-1">{review.managerReview.comments}</p></div>}
    </Modal>
  );
}

export function PerformancePage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null);
  const list = useList('/performance/reviews', { filters: { status } });
  const close = () => setModal(null);
  const done = () => { close(); list.reload({ silent: true }); };
  const cols = [
    { key: 'intern', header: 'Intern', render: (r) => <div><p className="font-medium text-slate-900">{fullName(r.userId)}</p><p className="font-mono text-xs text-slate-600">{r.internId?.internId}</p></div> },
    { key: 'cycle', header: 'Review', render: (r) => <div><p>{r.cycleTitle}</p><p className="text-xs text-slate-600">{humanize(r.type)}</p></div> },
    { key: 'score', header: 'Score', render: (r) => (r.finalScore != null && r.finalScore > 0 ? `${r.finalScore} / 10` : '-') },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', align: 'right', render: (r) => (
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setModal({ type: 'view', r })} data-testid={`review-view-${r._id}`}>View</Button>
        {r.status === 'MENTOR_ASSESSMENT_PENDING' && can('performance.review') && <Button size="sm" onClick={() => setModal({ type: 'mentor', r })} data-testid={`review-mentor-${r._id}`}>Assess</Button>}
        {r.status === 'MANAGER_REVIEW_PENDING' && can('performance.manage') && <Button size="sm" onClick={() => setModal({ type: 'finalize', r })} data-testid={`review-finalize-${r._id}`}>Finalize</Button>}
      </div>
    ) }
  ];
  return (
    <>
      <PageHeader title="Performance reviews" description="Self-assessment, then mentor assessment, then manager finalization. The overall score is always calculated by the system."
        actions={can('performance.manage') && <Button icon={Plus} onClick={() => setModal({ type: 'new' })} data-testid="new-review">Open review</Button>} />
      <FilterBar><SelectField name="status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All" options={Object.values(PERFORMANCE_REVIEW_STATUS).map((s) => ({ value: s, label: humanize(s) }))} /></FilterBar>
      <DataTable testId="reviews-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} caption="Performance reviews" emptyTitle="No reviews" emptyDescription="Open a review for an active intern to start a cycle." />
      <Pagination pagination={list.pagination} onPage={list.setPage} />
      {modal?.type === 'new' && <NewReviewModal onClose={close} onDone={done} />}
      {modal?.type === 'view' && <ReviewDetail review={modal.r} onClose={close} />}
      {modal?.type === 'mentor' && <MentorModal review={modal.r} onClose={close} onDone={done} />}
      {modal?.type === 'finalize' && <FinalizeModal review={modal.r} onClose={close} onDone={done} />}
    </>
  );
}
