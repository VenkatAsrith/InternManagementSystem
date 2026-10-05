import React, { useState } from 'react';
import api from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { dateISO, fmtDate, todayISO } from '../../lib/format';
import { Button, DataTable, FormError, FormGrid, InlineAlert, PageHeader, SectionCard, StateView, StatusBadge, TextAreaField, TextField, Modal, DetailList } from '../../components/ui';

function JournalForm({ existing, onDone }) {
  const toast = useToast();
  const edit = !!existing;
  const form = useForm({
    workSummary: existing?.workSummary || '', whatILearned: existing?.whatILearned || '', challenges: existing?.challenges || '', blockers: existing?.blockers || '',
    nextSteps: existing?.nextSteps || '', tasksCompleted: (existing?.tasksCompleted || []).join(', '), hoursWorked: existing?.hoursWorked ?? ''
  });
  const f = form.field;
  const onSubmit = (e) => {
    e.preventDefault();
    form.submit({
      workSummary: [rules.required('Work summary'), rules.min(10, 'Work summary')], whatILearned: [rules.required('What you learned'), rules.min(5, 'What you learned')],
      hoursWorked: [rules.required('Hours worked'), rules.number('Hours worked', { min: 0.5, max: 24 })]
    }, async (v) => {
      const body = { workSummary: v.workSummary.trim(), whatILearned: v.whatILearned.trim(), challenges: v.challenges.trim(), blockers: v.blockers.trim(), nextSteps: v.nextSteps.trim(), tasksCompleted: v.tasksCompleted, hoursWorked: Number(v.hoursWorked) };
      if (edit) await api.put(`/journals/${existing._id}`, body); else await api.post('/journals', body);
      toast.success(edit ? 'Journal updated' : 'Journal submitted. Your mentor was notified.');
      onDone();
    });
  };
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="journal-form">
      <FormError error={form.formError} />
      <TextAreaField {...f('workSummary')} label="What did you work on today?" rows={4} required hint="At least 10 characters." />
      <TextAreaField {...f('whatILearned')} label="What did you learn?" rows={3} required />
      <FormGrid>
        <TextAreaField {...f('challenges')} label="Challenges" rows={2} />
        <TextAreaField {...f('blockers')} label="Blockers" rows={2} />
        <TextAreaField {...f('nextSteps')} label="Next steps" rows={2} />
        <TextField {...f('tasksCompleted')} label="Tasks completed" hint="Separate with commas." />
        <TextField {...f('hoursWorked')} label="Hours worked" type="number" step="0.5" min="0.5" max="24" required />
      </FormGrid>
      <Button type="submit" loading={form.submitting} data-testid="journal-submit">{edit ? 'Save changes' : 'Submit journal'}</Button>
    </form>
  );
}

export function InternJournalPage() {
  const state = useFetch(() => api.get('/journals', { params: { limit: 60 } }), []);
  const [view, setView] = useState(null);
  return (
    <>
      <PageHeader title="Daily journal" description="One entry per working day. You can edit today's entry until your mentor reviews it." />
      <StateView state={state} loadingLabel="Loading journals...">
        {(journals) => {
          const today = journals.find((j) => dateISO(j.date) === todayISO());
          const locked = today && today.status !== 'SUBMITTED';
          return (
            <div className="space-y-6">
              <SectionCard title={today ? `Today's journal (Day ${today.dayNumber})` : 'Write today\'s journal'} testId="journal-today"
                actions={today && <StatusBadge status={today.status} />}>
                {locked ? <InlineAlert tone="success" testId="journal-reviewed">Your mentor reviewed today's journal, so it is now locked.{today.mentorReview?.comments ? ` Feedback: ${today.mentorReview.comments}` : ''}</InlineAlert>
                  : <JournalForm key={today?._id || 'new'} existing={today} onDone={() => state.reload({ silent: true })} />}
              </SectionCard>
              <SectionCard title="History" testId="journal-history">
                <DataTable testId="journals-table" rows={journals} caption="Journal history" emptyTitle="No journals yet" emptyDescription="Your submitted entries will be listed here." columns={[
                  { key: 'date', header: 'Date', render: (j) => fmtDate(j.date) }, { key: 'day', header: 'Day', render: (j) => j.dayNumber }, { key: 'hours', header: 'Hours', render: (j) => j.hoursWorked },
                  { key: 'status', header: 'Status', render: (j) => <StatusBadge status={j.status} /> },
                  { key: 'view', header: '', align: 'right', render: (j) => <Button size="sm" variant="outline" onClick={() => setView(j)} data-testid={`journal-view-${j.dayNumber}`}>View</Button> }]} />
              </SectionCard>
              {view && (
                <Modal open onClose={() => setView(null)} size="lg" testId="journal-detail" title={`Day ${view.dayNumber} - ${fmtDate(view.date)}`}>
                  <DetailList cols={1} items={[{ label: 'Work summary', value: view.workSummary }, { label: 'What I learned', value: view.whatILearned }, { label: 'Challenges', value: view.challenges || '-' }, { label: 'Blockers', value: view.blockers || '-' }, { label: 'Next steps', value: view.nextSteps || '-' }, { label: 'Hours', value: view.hoursWorked }, { label: 'Mentor feedback', value: view.mentorReview?.comments || 'Not reviewed yet' }]} />
                </Modal>
              )}
            </div>
          );
        }}
      </StateView>
    </>
  );
}
