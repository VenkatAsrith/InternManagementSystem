import React, { useState } from 'react';
import api from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { humanize } from '../../lib/format';
import { Button, DataTable, FormModal, InlineAlert, PageHeader, StatusBadge, TextAreaField } from '../../components/ui';
import { ReviewDetail } from '../admin/PerformancePage';

function SelfAssessmentModal({ review, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ strengths: '', growthAreas: '', generalComments: '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="lg" testId="self-assessment-modal" title="Self-assessment" description={review.cycleTitle} submitLabel="Submit self-assessment" form={form}
      rules={{ strengths: [rules.required('Strengths'), rules.min(5, 'Strengths')], growthAreas: [rules.required('Growth areas'), rules.min(5, 'Growth areas')] }}
      onSubmit={(v) => api.post(`/performance/reviews/${review._id}/self-assessment`, { strengths: v.strengths.trim(), growthAreas: v.growthAreas.trim(), ...(v.generalComments.trim() ? { generalComments: v.generalComments.trim() } : {}) })}
      onDone={() => { toast.success('Self-assessment submitted. Your mentor was notified.'); onDone(); }}>
      <TextAreaField {...f('strengths')} label="What are your strengths so far?" required rows={3} />
      <TextAreaField {...f('growthAreas')} label="Where do you want to grow?" required rows={3} />
      <TextAreaField {...f('generalComments')} label="Anything else?" rows={2} />
    </FormModal>
  );
}

export function InternPerformancePage() {
  const state = useFetch(() => api.get('/performance/reviews'), []);
  const [modal, setModal] = useState(null);
  const cols = [
    { key: 'cycle', header: 'Review', render: (r) => <div><p className="font-medium text-slate-900">{r.cycleTitle}</p><p className="text-xs text-slate-600">{humanize(r.type)}</p></div> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'score', header: 'Score', render: (r) => (r.status === 'FINALIZED' ? `${r.finalScore} / 10` : 'Pending') },
    { key: 'actions', header: '', align: 'right', render: (r) => (
      <div className="flex justify-end gap-2">
        {r.status === 'SELF_ASSESSMENT_PENDING' && <Button size="sm" onClick={() => setModal({ type: 'self', r })} data-testid={`self-assess-${r._id}`}>Self-assessment</Button>}
        {r.status === 'FINALIZED' && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'view', r })} data-testid={`review-view-${r._id}`}>View result</Button>}
      </div>
    ) }
  ];
  const pending = (state.data || []).some((r) => r.status === 'SELF_ASSESSMENT_PENDING');
  return (
    <>
      <PageHeader title="Performance" description="Your reviews. Mentor scores and comments become visible once the review is finalized." />
      {pending && <InlineAlert tone="warning" className="mb-4" testId="self-assessment-due">A review is waiting for your self-assessment.</InlineAlert>}
      <DataTable testId="my-reviews-table" columns={cols} rows={state.data || []} loading={state.loading} error={state.error} onRetry={state.reload} caption="My performance reviews" emptyTitle="No reviews yet" emptyDescription="Your mentor or program manager opens a review when it is due." />
      {modal?.type === 'self' && <SelfAssessmentModal review={modal.r} onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload({ silent: true }); }} />}
      {modal?.type === 'view' && <ReviewDetail review={modal.r} onClose={() => setModal(null)} />}
    </>
  );
}
