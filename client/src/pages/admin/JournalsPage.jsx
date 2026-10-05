import React, { useState } from 'react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useList } from '../../hooks/useList';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, fullName, humanize } from '../../lib/format';
import { JOURNAL_STATUS } from '@shared/constants.js';
import { Button, DataTable, DetailList, FilterBar, FormModal, Modal, PageHeader, Pagination, SelectField, StatusBadge, TextAreaField } from '../../components/ui';

function ReviewModal({ journal, canReview, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ comments: '' });
  const reviewable = canReview && journal.status === 'SUBMITTED';
  const body = (
    <DetailList cols={1} items={[
      { label: 'Intern', value: fullName(journal.userId) }, { label: 'Work summary', value: journal.workSummary }, { label: 'What they learned', value: journal.whatILearned },
      { label: 'Challenges', value: journal.challenges || '-' }, { label: 'Blockers', value: journal.blockers || '-' }, { label: 'Next steps', value: journal.nextSteps || '-' }, { label: 'Hours', value: journal.hoursWorked },
      journal.status === 'REVIEWED' ? { label: 'Mentor feedback', value: journal.mentorReview?.comments } : null
    ]} />
  );
  if (!reviewable) return <Modal open onClose={onClose} size="lg" testId="journal-review-modal" title={`Day ${journal.dayNumber} - ${fmtDate(journal.date)}`}>{body}</Modal>;
  return (
    <FormModal open onClose={onClose} size="lg" testId="journal-review-modal" title={`Day ${journal.dayNumber} - ${fmtDate(journal.date)}`} submitLabel="Save review" form={form}
      rules={{ comments: [rules.required('Comments'), rules.min(3, 'Comments')] }}
      onSubmit={(v) => api.post(`/journals/${journal._id}/review`, { comments: v.comments.trim() })} onDone={() => { toast.success('Journal reviewed. The intern was notified.'); onDone(); }}>
      {body}
      <TextAreaField {...form.field('comments')} label="Your feedback" required rows={3} />
    </FormModal>
  );
}

export function JournalsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('SUBMITTED');
  const [open, setOpen] = useState(null);
  const list = useList('/journals', { filters: { status } });
  const cols = [
    { key: 'date', header: 'Date', render: (j) => fmtDate(j.date) },
    { key: 'intern', header: 'Intern', render: (j) => <div><p className="font-medium text-slate-900">{fullName(j.userId)}</p><p className="font-mono text-xs text-slate-600">{j.internId?.internId}</p></div> },
    { key: 'day', header: 'Day', render: (j) => j.dayNumber }, { key: 'hours', header: 'Hours', render: (j) => j.hoursWorked },
    { key: 'status', header: 'Status', render: (j) => <StatusBadge status={j.status} /> },
    { key: 'actions', header: '', align: 'right', render: (j) => <Button size="sm" variant="outline" onClick={() => setOpen(j)} data-testid={`journal-open-${j._id}`}>{j.status === 'SUBMITTED' && can('journals.review') ? 'Review' : 'View'}</Button> }
  ];
  return (
    <>
      <PageHeader title="Daily journals" description="Journals from the interns you supervise. Review each entry once." />
      <FilterBar><SelectField name="status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All" options={Object.values(JOURNAL_STATUS).map((s) => ({ value: s, label: humanize(s) }))} /></FilterBar>
      <DataTable testId="journals-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} caption="Journals" emptyTitle={status === 'SUBMITTED' ? 'Nothing waiting for review' : 'No journals'} emptyDescription="Submitted journals appear here." />
      <Pagination pagination={list.pagination} onPage={list.setPage} />
      {open && <ReviewModal journal={open} canReview={can('journals.review')} onClose={() => setOpen(null)} onDone={() => { setOpen(null); list.reload({ silent: true }); }} />}
    </>
  );
}
