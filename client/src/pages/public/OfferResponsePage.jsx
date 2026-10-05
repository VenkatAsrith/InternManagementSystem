import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import api from '../../lib/http';
import { useFetch } from '../../hooks/useFetch';
import { useAction } from '../../hooks/useForm';
import { fmtDate } from '../../lib/format';
import { Button, DetailList, EmptyState, ErrorState, InlineAlert, LoadingBlock, Modal, SectionCard, StatusBadge, TextAreaField } from '../../components/ui';

/**
 * Candidate-facing offer page (the secret link is the credential).
 * Acceptance is a single server-side atomic operation. This page:
 *  - disables the button while the request runs (duplicate click),
 *  - treats "already accepted" / "expired" / "revoked" answers from the server as real states,
 *  - never shows the success screen unless the API confirmed the acceptance.
 */
export function OfferResponsePage() {
  const { token } = useParams();
  const offer = useFetch(() => api.get(`/offers/public/${encodeURIComponent(token)}`), [token]);
  const accept = useAction();
  const decline = useAction();
  const [outcome, setOutcome] = useState(null); // { type:'accepted'|'declined', setupLink?, internId? }
  const [problem, setProblem] = useState(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');

  const onAccept = () => accept.run(async () => {
    setProblem(null);
    try {
      const res = await api.post(`/offers/public/${encodeURIComponent(token)}/accept`);
      setOutcome({ type: 'accepted', setupLink: res.data.setupLink, internId: res.data.internId });
    } catch (e) {
      if (e.code === 'OFFER_ALREADY_ACCEPTED') offer.reload({ silent: false });
      setProblem(e);
      if (['OFFER_EXPIRED', 'OFFER_REVOKED', 'OFFER_DECLINED'].includes(e.code)) offer.reload();
    }
  });

  const onDecline = () => decline.run(async () => {
    setProblem(null);
    try {
      await api.post(`/offers/public/${encodeURIComponent(token)}/decline`, { reason: reason.trim() });
      setDeclineOpen(false);
      setOutcome({ type: 'declined' });
    } catch (e) {
      setDeclineOpen(false);
      setProblem(e);
      offer.reload();
    }
  });

  const shell = (children) => <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">{children}</div>;

  if (outcome?.type === 'accepted') {
    return shell(
      <div className="text-center" data-testid="offer-accepted">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-700" aria-hidden="true" />
        <h1 data-testid="page-title" className="mt-4 text-3xl font-bold text-slate-900">Offer accepted</h1>
        <p className="mt-2 text-sm text-slate-700">Welcome to the team. Your intern ID is <strong data-testid="offer-intern-id">{outcome.internId}</strong>.</p>
        {outcome.setupLink ? (
          <>
            <p className="mt-4 text-sm text-slate-700">Set your password now to open your intern workspace. This link works once.</p>
            <a href={outcome.setupLink} className="mt-5 inline-flex h-11 items-center rounded-lg bg-brand-600 px-6 text-base font-medium text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2" data-testid="offer-setup-link">Set my password</a>
          </>
        ) : <p className="mt-4 text-sm text-slate-700">Check your email for the link to set your password.</p>}
      </div>
    );
  }
  if (outcome?.type === 'declined') {
    return shell(
      <div className="text-center" data-testid="offer-declined">
        <XCircle className="mx-auto h-14 w-14 text-slate-600" aria-hidden="true" />
        <h1 data-testid="page-title" className="mt-4 text-3xl font-bold text-slate-900">Offer declined</h1>
        <p className="mt-2 text-sm text-slate-700">We have recorded your decision. Thank you for your time.</p>
        <Link to="/internships" className="mt-5 inline-block text-sm font-medium text-brand-800 underline">Browse other internships</Link>
      </div>
    );
  }

  if (offer.loading && !offer.data) return shell(<LoadingBlock label="Loading your offer..." />);
  if (offer.error?.code === 'OFFER_LINK_INVALID' || offer.error?.status === 404) {
    return shell(<EmptyState title="This offer link is not valid" description="Check that you opened the full link from your email. If the problem continues, contact the organization." testId="offer-invalid" />);
  }
  if (offer.error?.code === 'OFFER_EXPIRED') {
    return shell(<EmptyState title="This offer has expired" description="Please contact the organization if you still wish to join." testId="offer-expired" />);
  }
  if (offer.error) return shell(<ErrorState error={offer.error} onRetry={offer.reload} />);

  const o = offer.data;
  const actionable = ['SENT', 'VIEWED'].includes(o.status);
  const blocked = {
    ACCEPTED: 'You have already accepted this offer. Use the link in your welcome email to set your password, or sign in.',
    DECLINED: 'This offer was declined and can no longer be accepted.',
    EXPIRED: 'This offer has expired.',
    REVOKED: 'This offer was withdrawn by the organization.',
    DRAFT: 'This offer is not available yet.'
  }[o.status];

  return shell(
    <>
      <header className="mb-6">
        <p className="text-sm font-medium text-slate-700">{o.organization?.name}</p>
        <h1 data-testid="page-title" className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Internship offer: {o.title}</h1>
        <p className="mt-2 text-sm text-slate-700">Hello {o.candidateFirstName}, congratulations! Please review your offer below.</p>
        <div className="mt-3 flex items-center gap-3"><StatusBadge status={o.status} testId="offer-status" /><span className="font-mono text-xs text-slate-600">{o.offerId}</span></div>
      </header>

      {problem && <InlineAlert tone="error" title="We could not complete that" testId="offer-problem" className="mb-4">{problem.message}</InlineAlert>}
      {!actionable && blocked && <InlineAlert tone="warning" testId="offer-not-actionable" className="mb-4">{blocked}</InlineAlert>}

      <SectionCard title="Offer details" testId="offer-details">
        <DetailList cols={2} items={[
          { label: 'Role', value: o.title }, { label: 'Department', value: o.department },
          { label: 'Mentor', value: o.mentor || 'To be assigned' }, { label: 'Work mode', value: o.workMode?.replace('_', ' ') },
          { label: 'Start date', value: fmtDate(o.startDate) }, { label: 'End date', value: fmtDate(o.endDate) },
          { label: 'Duration', value: `${o.durationDays} days` },
          { label: 'Stipend', value: o.stipend || 'Unpaid', testId: 'offer-stipend' },
          { label: 'Respond by', value: fmtDate(o.validUntil), testId: 'offer-valid-until' }
        ]} />
        {o.responsibilities?.length > 0 && (
          <div className="mt-5"><h3 className="text-sm font-semibold text-slate-900">Responsibilities</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">{o.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul></div>
        )}
        {o.terms && <div className="mt-5"><h3 className="text-sm font-semibold text-slate-900">Terms</h3><p className="mt-2 whitespace-pre-line text-sm text-slate-800">{o.terms}</p></div>}
      </SectionCard>

      {actionable && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="success" size="lg" loading={accept.pending} onClick={onAccept} data-testid="offer-accept">Accept offer</Button>
          <Button variant="outline" size="lg" disabled={accept.pending} onClick={() => setDeclineOpen(true)} data-testid="offer-decline">Decline</Button>
        </div>
      )}

      <Modal
        open={declineOpen} onClose={() => setDeclineOpen(false)} title="Decline this offer?" size="sm" testId="decline-modal"
        description="This cannot be undone. You would need to apply again."
        footer={<><Button variant="outline" onClick={() => setDeclineOpen(false)}>Keep offer</Button><Button variant="danger" loading={decline.pending} onClick={onDecline} data-testid="offer-decline-confirm">Decline offer</Button></>}
      >
        <TextAreaField name="declineReason" label="Reason (optional)" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}
