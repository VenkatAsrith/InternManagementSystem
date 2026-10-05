import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Eye } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useAction, useForm, rules } from '../../hooks/useForm';
import { fmtDate, fmtDateTime, fullName, humanize } from '../../lib/format';
import { APPLICATION_MANUAL_TRANSITIONS, APPLICATION_NOTE_REQUIRED } from '@shared/lifecycle.js';
import { Button, DetailList, InlineAlert, PageHeader, SectionCard, StateView, StatusBadge, TextAreaField, Timeline, useConfirm } from '../../components/ui';
import { ScheduleInterviewModal } from '../../components/domain/ScheduleInterviewModal';
import { OfferDraftModal } from '../../components/domain/OfferDraftModal';
import { ResumePreviewModal } from '../../components/domain/ResumePreviewModal';

const STAGE_LABEL = { UNDER_REVIEW: 'Start review', SHORTLISTED: 'Shortlist', SELECTED: 'Select candidate', REJECTED: 'Reject', WITHDRAWN: 'Mark withdrawn', ON_HOLD: 'Put on hold', INTERVIEWED: 'Mark interviewed' };
const DANGER = ['REJECTED', 'WITHDRAWN'];

export function ApplicationDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const state = useFetch(() => api.get(`/recruitment/applications/${id}`), [id]);
  const move = useAction();
  const [scheduling, setScheduling] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [previewingResume, setPreviewingResume] = useState(false);
  const noteForm = useForm({ text: '' });

  const changeStage = (app, stage) => move.run(async () => {
    let note;
    if (APPLICATION_NOTE_REQUIRED.includes(stage)) {
      note = await confirm({ title: `${STAGE_LABEL[stage] || humanize(stage)}?`, message: 'Record why. The reason is kept in the application history.', requireReason: true, reasonLabel: 'Reason', confirmLabel: STAGE_LABEL[stage] || 'Confirm', tone: DANGER.includes(stage) ? 'danger' : 'primary' });
      if (!note) return;
    } else if (!(await confirm({ title: `${STAGE_LABEL[stage] || humanize(stage)}?`, message: `Move ${app.applicationId} to ${humanize(stage)}.`, confirmLabel: 'Confirm' }))) return;
    try {
      await api.patch(`/recruitment/applications/${app._id}/stage`, { stage, ...(note ? { note } : {}) });
      toast.success(`Moved to ${humanize(stage)}`);
      state.reload({ silent: true });
    } catch (e) { toast.error(e.message); state.reload({ silent: true }); }
  });

  const addNote = (e) => {
    e.preventDefault();
    noteForm.submit({ text: [rules.required('Note'), rules.max(2000, 'Note')] }, async (v) => {
      await api.post(`/recruitment/applications/${id}/notes`, { text: v.text.trim() });
      noteForm.reset();
      toast.success('Note added');
      state.reload({ silent: true });
    });
  };

  const resume = async () => {
    try { await downloadFile(`/recruitment/applications/${id}/resume`, 'resume'); } catch (e) { toast.error(e.message); }
  };

  return (
    <StateView state={state} loadingLabel="Loading application...">
      {(app) => {
        const c = app.candidateId || {};
        const next = APPLICATION_MANUAL_TRANSITIONS[app.status] || [];
        const canStage = can('applications.stage');
        const canSchedule = can('interviews.schedule') && ['SHORTLISTED', 'INTERVIEWED'].includes(app.status) && !(app.interviews || []).some((i) => ['SCHEDULED', 'RESCHEDULED'].includes(i.status));
        const canOffer = can('offers.create') && ['SELECTED', 'OFFER_EXPIRED'].includes(app.status);
        const candidateName = fullName(c);
        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: 'Applications', to: '/admin/applications' }, { label: app.applicationId }]}
              title={candidateName}
              description={`${app.openingId?.title || 'Application'} - ${app.applicationId}`}
              actions={<StatusBadge status={app.status} testId="application-status" />}
            />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <SectionCard title="Candidate" testId="candidate-card">
                  <DetailList items={[
                    { label: 'Email', value: c.email }, { label: 'Phone', value: c.phone },
                    { label: 'Location', value: [c.city, c.state, c.country].filter(Boolean).join(', ') || '-' },
                    { label: 'College', value: c.education?.college }, { label: 'Degree', value: `${c.education?.degree || ''} ${c.education?.branch ? `- ${c.education.branch}` : ''}` },
                    { label: 'Graduation year', value: c.education?.graduationYear }, { label: 'CGPA', value: c.education?.cgpa || '-' },
                    { label: 'Technical skills', value: (c.technicalSkills || []).join(', ') || '-' },
                    { label: 'GitHub', value: c.github ? <a className="text-brand-800 underline" href={c.github} target="_blank" rel="noopener noreferrer">{c.github}</a> : '-' },
                    { label: 'LinkedIn', value: c.linkedin ? <a className="text-brand-800 underline" href={c.linkedin} target="_blank" rel="noopener noreferrer">{c.linkedin}</a> : '-' }
                  ]} />
                  {app.coverLetter && <div className="mt-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Cover letter</h3><p className="mt-1 whitespace-pre-line text-sm text-slate-800">{app.coverLetter}</p></div>}
                  {app.resumePath && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="primary" size="sm" icon={Eye} onClick={() => setPreviewingResume(true)} data-testid="preview-resume">
                        Preview resume
                      </Button>
                      <Button variant="outline" size="sm" icon={Download} onClick={resume} data-testid="download-resume">
                        Download resume
                      </Button>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Interviews" testId="interviews-card" actions={canSchedule && <Button size="sm" onClick={() => setScheduling(true)} data-testid="schedule-interview">Schedule interview</Button>}>
                  {(app.interviews || []).length === 0 ? <p className="text-sm text-slate-600">No interviews yet.</p> : (
                    <ul className="divide-y divide-slate-100">
                      {app.interviews.map((i) => (
                        <li key={i._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                          <span><span className="font-medium text-slate-900">Round {i.round || ''} {humanize(i.type)}</span> - {fmtDateTime(i.startsAt)}</span>
                          <StatusBadge status={i.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>

                {app.offer && (
                  <SectionCard title="Offer" testId="offer-card" actions={<Link to="/admin/offers" className="text-xs font-medium text-brand-800 underline">Open offers</Link>}>
                    <DetailList items={[{ label: 'Offer ID', value: app.offer.offerId }, { label: 'Status', value: <StatusBadge status={app.offer.status} /> }, { label: 'Stipend', value: app.offer.stipend || '-' }, { label: 'Valid until', value: fmtDate(app.offer.validUntil) }]} />
                  </SectionCard>
                )}

                <SectionCard title="Internal notes" testId="notes-card" description="Visible to recruiting staff only. Never shown to the candidate.">
                  {can('applications.notes') && (
                    <form onSubmit={addNote} noValidate className="mb-4" data-testid="note-form">
                      <TextAreaField {...noteForm.field('text')} label="Add a note" rows={2} />
                      <Button type="submit" size="sm" className="mt-2" loading={noteForm.submitting} data-testid="add-note">Add note</Button>
                    </form>
                  )}
                  {(app.notes || []).length === 0 ? <p className="text-sm text-slate-600">No notes yet.</p> : (
                    <ul className="space-y-3">
                      {[...app.notes].reverse().map((n, i) => (
                        <li key={n._id || i} className="rounded-lg bg-slate-50 p-3 text-sm" data-testid="note-item"><p className="text-slate-900 break-words">{n.text}</p><p className="mt-1 text-xs text-slate-600">{n.authorName} - {fmtDateTime(n.createdAt)}</p></li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              </div>

              <div className="space-y-6">
                <SectionCard title="Actions" testId="actions-card">
                  {app.status === 'OFFER_ACCEPTED' ? <InlineAlert tone="success">Offer accepted. The intern workspace has been created.</InlineAlert> : (
                    <div className="flex flex-col gap-2">
                      {canStage && next.map((s) => (
                        <Button key={s} variant={DANGER.includes(s) ? 'danger' : 'outline'} loading={move.pending} onClick={() => changeStage(app, s)} data-testid={`stage-${s}`}>{STAGE_LABEL[s] || humanize(s)}</Button>
                      ))}
                      {canOffer && <Button onClick={() => setDrafting(true)} data-testid="draft-offer">Draft offer</Button>}
                      {!canStage && !canOffer && <p className="text-sm text-slate-600">You can view this application but not change it.</p>}
                      {canStage && next.length === 0 && !canOffer && <p className="text-sm text-slate-600">No further manual actions. The next step happens through {app.status.startsWith('OFFER') ? 'the offer' : 'interviews'}.</p>}
                    </div>
                  )}
                </SectionCard>
                <SectionCard title="History" testId="history-card">
                  <Timeline items={(app.timeline || []).map((t, i) => ({ key: i, title: humanize(t.stage), meta: `${fmtDateTime(t.timestamp)}${t.actorName ? ` - ${t.actorName}` : ''}`, body: t.note }))} />
                </SectionCard>
              </div>
            </div>

            {scheduling && <ScheduleInterviewModal open onClose={() => setScheduling(false)} application={{ applicationId: app.applicationId, candidateName }} onDone={() => { setScheduling(false); state.reload({ silent: true }); }} />}
            {drafting && <OfferDraftModal open onClose={() => setDrafting(false)} application={{ applicationId: app.applicationId, candidateName, title: app.openingId?.title }} onDone={() => { setDrafting(false); state.reload({ silent: true }); }} />}
            {previewingResume && <ResumePreviewModal applicationId={app._id} candidateName={candidateName} onClose={() => setPreviewingResume(false)} />}
          </>
        );
      }}
    </StateView>
  );
}
