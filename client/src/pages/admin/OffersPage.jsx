import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useList } from '../../hooks/useList';
import { useAction, useForm, rules } from '../../hooks/useForm';
import { fmtDate, fullName, humanize } from '../../lib/format';
import { OFFER_STATUS } from '@shared/constants.js';
import { Button, CopyField, DataTable, FilterBar, FormModal, InlineAlert, Modal, PageHeader, Pagination, SelectField, StatusBadge, TextAreaField } from '../../components/ui';
import { OfferDraftModal } from '../../components/domain/OfferDraftModal';

function RevokeModal({ offer, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ reason: '' });
  return (
    <FormModal open onClose={onClose} size="sm" testId="revoke-offer-modal" title={`Revoke ${offer.offerId}?`} description="The candidate can no longer accept it. The application returns to Selected." submitLabel="Revoke offer" submitVariant="danger" form={form}
      rules={{ reason: [rules.required('Reason'), rules.min(3, 'Reason')] }}
      onSubmit={(v) => api.post(`/offers/${offer._id}/revoke`, { reason: v.reason.trim() })}
      onDone={() => { toast.success('Offer revoked'); onDone(); }}>
      <TextAreaField {...form.field('reason')} label="Reason" required rows={2} />
    </FormModal>
  );
}

function AcceptOnBehalfModal({ offer, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ channel: 'EMAIL', note: '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="sm" testId="accept-behalf-modal" title="Record acceptance" description="Use this only when the candidate accepted outside the portal. It creates the intern account and onboarding plan." submitLabel="Record acceptance" form={form}
      rules={{ note: [rules.required('Note'), rules.min(3, 'Note')] }}
      onSubmit={(v) => api.post(`/offers/${offer._id}/accept`, { channel: v.channel, note: v.note.trim() })}
      onDone={(res) => { toast.success('Acceptance recorded. Intern workspace created.'); onDone(res.data); }}>
      <SelectField {...f('channel')} label="How did they accept?" options={[{ value: 'EMAIL', label: 'Email' }, { value: 'PHONE', label: 'Phone' }, { value: 'IN_PERSON', label: 'In person' }]} />
      <TextAreaField {...f('note')} label="Note" required rows={2} hint="Who confirmed and when." />
    </FormModal>
  );
}

export function OffersPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null); // {type, offer}
  const [linkInfo, setLinkInfo] = useState(null); // { title, link, note }
  const list = useList('/offers', { filters: { status } });
  const send = useAction();
  const close = () => setModal(null);
  const done = () => { close(); list.reload({ silent: true }); };

  const sendOffer = (o) => send.run(async () => {
    try {
      const res = await api.post(`/offers/${o._id}/send`);
      toast.success('Offer sent to the candidate');
      setLinkInfo({ title: `Offer ${o.offerId} sent`, link: res.data.offerLink, note: 'The candidate was emailed this link. Email delivery is simulated in this environment, so share the link yourself if needed. It is shown only once.' });
      list.reload({ silent: true });
    } catch (e) { toast.error(e.message); list.reload({ silent: true }); }
  });

  const cols = [
    { key: 'offerId', header: 'Offer', render: (o) => <div><p className="font-mono text-xs font-semibold text-slate-900">{o.offerId}</p><Link to={`/admin/applications/${o.applicationId?._id}`} className="text-xs text-brand-800 underline">{o.applicationId?.applicationId}</Link></div> },
    { key: 'candidate', header: 'Candidate', render: (o) => <div><p className="font-medium text-slate-900">{fullName(o.candidateId)}</p><p className="text-xs text-slate-600">{o.candidateId?.email}</p></div> },
    { key: 'title', header: 'Role', render: (o) => o.title },
    { key: 'stipend', header: 'Stipend', render: (o) => o.stipend || '-' },
    { key: 'dates', header: 'Internship', render: (o) => `${fmtDate(o.startDate)} to ${fmtDate(o.endDate)}` },
    { key: 'valid', header: 'Respond by', render: (o) => (o.validUntil ? fmtDate(o.validUntil) : '-') },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    { key: 'actions', header: 'Actions', align: 'right', render: (o) => (
      <div className="flex flex-wrap justify-end gap-2">
        {o.status === 'DRAFT' && can('offers.create') && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'edit', offer: o })} data-testid={`offer-edit-${o._id}`}>Edit</Button>}
        {o.status === 'DRAFT' && can('offers.send') && <Button size="sm" loading={send.pending} onClick={() => sendOffer(o)} data-testid={`offer-send-${o._id}`}>Send</Button>}
        {['SENT', 'VIEWED'].includes(o.status) && can('offers.accept') && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'accept', offer: o })} data-testid={`offer-accept-behalf-${o._id}`}>Record acceptance</Button>}
        {['DRAFT', 'SENT', 'VIEWED'].includes(o.status) && can('offers.send') && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'revoke', offer: o })} data-testid={`offer-revoke-${o._id}`}>Revoke</Button>}
      </div>
    ) }
  ];

  return (
    <>
      <PageHeader title="Offers" description="Draft offers from selected applications. Accepting an offer creates the intern account, onboarding plan and compensation plan in one atomic step." />
      <FilterBar>
        <SelectField name="status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={Object.values(OFFER_STATUS).map((s) => ({ value: s, label: humanize(s) }))} />
      </FilterBar>
      <DataTable testId="offers-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(o) => o.offerId} caption="Offers" emptyTitle="No offers yet" emptyDescription="Select an application, then draft an offer from its detail page." />
      <Pagination pagination={list.pagination} onPage={list.setPage} />

      {modal?.type === 'edit' && <OfferDraftModal open offer={modal.offer} application={{ candidateName: fullName(modal.offer.candidateId), title: modal.offer.title }} onClose={close} onDone={done} />}
      {modal?.type === 'revoke' && <RevokeModal offer={modal.offer} onClose={close} onDone={done} />}
      {modal?.type === 'accept' && <AcceptOnBehalfModal offer={modal.offer} onClose={close} onDone={(data) => { close(); list.reload({ silent: true }); if (data.setupLink) setLinkInfo({ title: 'Intern account created', link: data.setupLink, note: 'Give this password-setup link to the intern. It works once and is shown only now.' }); }} />}
      {linkInfo && (
        <Modal open onClose={() => setLinkInfo(null)} size="md" testId="link-modal" title={linkInfo.title} footer={<Button onClick={() => setLinkInfo(null)} data-testid="link-modal-done">Done</Button>}>
          <InlineAlert tone="info" className="mb-4">{linkInfo.note}</InlineAlert>
          <CopyField label="Secure link" value={linkInfo.link} testId="secure-link" />
        </Modal>
      )}
    </>
  );
}
