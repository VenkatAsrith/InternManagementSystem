import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, ShieldAlert, Search, XCircle } from 'lucide-react';
import api from '../../lib/http';
import { fmtDate } from '../../lib/format';
import { Button, DetailList, InlineAlert, SectionCard, TextField } from '../../components/ui';

const CERT_RE = /^CERT-\d{4}-\d{6}$/i;
const DOC_RE = /^DOC-\d{4}-\d{6}$/i;

/** Public verification. Only authenticity metadata is shown (name, program, dates), never contact or performance data. */
export function CertificateVerifyPage({ kind = 'certificate' }) {
  const { certificateId, documentId } = useParams();
  const paramId = certificateId || documentId || '';
  const navigate = useNavigate();
  const isDoc = kind === 'document';
  const re = isDoc ? DOC_RE : CERT_RE;
  const [id, setId] = useState(paramId);
  const [error, setError] = useState('');
  const [state, setState] = useState({ loading: false, result: null, outcome: null, failure: null });

  const run = async (value) => {
    const clean = value.trim().toUpperCase();
    setError('');
    if (!re.test(clean)) {
      setState({ loading: false, result: null, outcome: null, failure: null });
      setError(isDoc ? 'Enter a document ID like DOC-2026-000123' : 'Enter a certificate ID like CERT-2026-123456');
      return;
    }
    setState({ loading: true, result: null, outcome: null, failure: null });
    try {
      const res = await api.get(`/${isDoc ? 'documents' : 'certificates'}/verify/${encodeURIComponent(clean)}`);
      setState({ loading: false, result: res.data, outcome: res.data.isValid === false ? 'revoked' : 'valid', failure: null });
    } catch (e) {
      const outcome = e.status === 404 ? 'notfound' : e.status === 410 ? 'revoked' : null;
      setState({ loading: false, result: null, outcome, failure: outcome ? null : e });
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (paramId) run(paramId); }, [paramId]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (state.loading) return;
    const clean = id.trim().toUpperCase();
    if (re.test(clean)) navigate(`/verify/${kind}/${clean}`);
    else run(id);
  };

  const r = state.result;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 data-testid="page-title" className="text-3xl font-bold tracking-tight text-slate-900">Verify a {kind}</h1>
      <p className="mt-1 text-sm text-slate-700">Confirm that a {kind} was really issued by TechMecha Torque. No login is needed.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col items-start gap-3 sm:flex-row" role="search" data-testid="verify-form">
        <TextField name={isDoc ? 'documentId' : 'certificateId'} label={isDoc ? 'Document ID' : 'Certificate ID'} value={id} onChange={(e) => setId(e.target.value)} error={error} placeholder={isDoc ? 'DOC-2026-000123' : 'CERT-2026-123456'} className="w-full sm:flex-1" autoComplete="off" />
        <Button type="submit" icon={Search} loading={state.loading} className="sm:mt-[1.625rem]" data-testid="verify-submit">Verify</Button>
      </form>

      <div className="mt-6" aria-live="polite">
        {state.outcome === 'notfound' && (
          <InlineAlert tone="warning" title={`${isDoc ? 'Document' : 'Certificate'} not found`} testId="verify-notfound">
            <span className="inline-flex items-center gap-1"><XCircle className="h-4 w-4" aria-hidden="true" /> No {kind} exists with this ID. Check for typing mistakes.</span>
          </InlineAlert>
        )}
        {state.outcome === 'revoked' && (
          <InlineAlert tone="error" title="This credential is no longer valid" testId="verify-revoked">
            <span className="inline-flex items-center gap-1"><ShieldAlert className="h-4 w-4" aria-hidden="true" /> The issuing organization has revoked it. Do not rely on it.</span>
          </InlineAlert>
        )}
        {state.failure && <InlineAlert tone="error" title="Could not verify right now" testId="verify-error">{state.failure.message}</InlineAlert>}
        {state.outcome === 'valid' && r && (
          <SectionCard testId="verify-valid" title={isDoc ? 'Authentic document' : 'Authentic certificate'} actions={<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900"><BadgeCheck className="h-4 w-4" aria-hidden="true" /> Verified</span>}>
            {isDoc ? (
              <DetailList items={[
                { label: 'Document ID', value: r.documentId }, { label: 'Type', value: r.documentType?.replace(/_/g, ' ') },
                { label: 'Recipient', value: r.recipientName }, { label: 'Issued by', value: r.organizationName },
                { label: 'Issued on', value: r.issuedOn }, { label: 'Status', value: r.isCurrentVersion ? 'Current version' : 'Superseded by a newer version' }
              ]} />
            ) : (
              <DetailList items={[
                { label: 'Certificate ID', value: r.certificateId }, { label: 'Awarded to', value: r.internName, testId: 'verify-name' },
                { label: 'Program', value: r.programTitle }, { label: 'Department', value: r.departmentName },
                { label: 'Issued by', value: r.organizationName }, { label: 'Duration', value: r.duration },
                { label: 'Issue date', value: String(r.issueDate).includes('T') ? fmtDate(r.issueDate) : r.issueDate }
              ]} />
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
