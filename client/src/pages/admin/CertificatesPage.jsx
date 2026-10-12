import React, { useState, useEffect } from 'react';
import { CheckCircle2, Download, Eye, XCircle } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { useAction, useForm, rules } from '../../hooks/useForm';
import { fmtDate, fullName } from '../../lib/format';
import { Button, DataTable, FormModal, InlineAlert, LoadingBlock, Modal, PageHeader, Pagination, SectionCard, SelectField, StateView, StatusBadge, TextAreaField } from '../../components/ui';

function CertificatePreviewModal({ cert, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let url = null;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/certificates/${cert._id}/download?inline=1`, { responseType: 'blob' });
        if (!active) return;
        const blob = res instanceof Blob ? res : (res?.data instanceof Blob ? res.data : new Blob([res], { type: 'application/pdf' }));
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load certificate preview');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [cert._id]);

  const handleDownload = async () => {
    await downloadFile(`/certificates/${cert._id}/download`, `${cert.certificateId}.pdf`);
  };

  return (
    <Modal open onClose={onClose} size="xl" title={`Certificate Preview: ${cert.certificateId}`} testId="cert-preview-modal"
      footer={(
        <div className="flex w-full items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="cert-preview-close">Close</Button>
          <Button variant="primary" size="sm" icon={Download} onClick={handleDownload} data-testid="cert-preview-download">Download PDF</Button>
        </div>
      )}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
          <div>
            <p className="text-slate-500 uppercase font-semibold">Certificate ID</p>
            <p className="font-mono font-medium text-slate-900 mt-0.5">{cert.certificateId}</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase font-semibold">Awarded To</p>
            <p className="font-medium text-slate-900 mt-0.5">{cert.internName}</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase font-semibold">Program</p>
            <p className="font-medium text-slate-900 mt-0.5 truncate">{cert.programTitle}</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase font-semibold">Issue Date</p>
            <p className="font-medium text-slate-900 mt-0.5">{String(cert.issueDate).includes('T') ? fmtDate(cert.issueDate) : cert.issueDate}</p>
          </div>
        </div>
        <div className="min-h-[460px] h-[65vh] w-full rounded-lg bg-slate-100 flex flex-col items-center justify-center overflow-hidden border border-slate-200 relative">
          {loading && <LoadingBlock label="Rendering certificate preview..." />}
          {error && (
            <div className="text-center p-6 space-y-2">
              <p className="text-sm font-medium text-slate-800">{error}</p>
              <Button size="sm" variant="outline" icon={Download} onClick={handleDownload}>Download to inspect</Button>
            </div>
          )}
          {!loading && !error && blobUrl && (
            <iframe src={`${blobUrl}#toolbar=0`} title={`Preview of ${cert.certificateId}`} className="w-full h-full border-0 rounded-lg" data-testid="cert-preview-iframe" />
          )}
        </div>
      </div>
    </Modal>
  );
}

function Readiness({ internId, onIssued }) {
  const { can } = useAuth();
  const toast = useToast();
  const state = useFetch(() => api.get(`/certificates/readiness/${internId}`), [internId]);
  const issue = useAction();
  const doIssue = () => issue.run(async () => {
    try {
      const res = await api.post('/certificates/generate', { internId });
      toast.success(`Certificate ${res.data.certificateId} issued`);
      onIssued();
      state.reload({ silent: true });
    } catch (e) {
      toast.error(e.message);
      state.reload({ silent: true });
    }
  });
  return (
    <StateView state={state} loadingLabel="Checking eligibility...">
      {(r) => (
        <SectionCard title={`Eligibility: ${r.name} (${r.internId})`} testId="readiness" description={`Current status: ${r.status.replace(/_/g, ' ')}`}
          actions={can('certificates.issue') && <Button onClick={doIssue} loading={issue.pending} disabled={!r.canIssueNow} data-testid="issue-certificate">Issue certificate</Button>}>
          <ul className="divide-y divide-slate-100" data-testid="eligibility-checks">
            {r.checks.map((c) => (
              <li key={c.key} data-testid={`check-${c.key}`} data-satisfied={c.satisfied} className="flex items-start gap-3 py-2.5 text-sm">
                {c.satisfied ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" aria-label="Met" /> : <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-700" aria-label="Not met" />}
                <div><p className="font-medium text-slate-900">{c.label}</p><p className="text-xs text-slate-700">Actual {String(c.actual)}{c.unit} / required {String(c.required)}{c.unit}</p></div>
              </li>
            ))}
          </ul>
          {r.existingCertificate && <InlineAlert tone="success" className="mt-3" testId="already-issued">Certificate {r.existingCertificate.certificateId} is already active for this intern.</InlineAlert>}
          {!r.canIssueNow && !r.existingCertificate && (
            <InlineAlert tone="warning" className="mt-3" testId="cannot-issue">
              {r.status !== 'CERTIFICATION' ? 'Certificates are issued during the Certification stage of the exit process.' : !r.eligible ? 'One or more requirements are not met.' : 'This exit is not certificate-eligible.'}
            </InlineAlert>
          )}
        </SectionCard>
      )}
    </StateView>
  );
}

function RevokeModal({ cert, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ reason: '' });
  return (
    <FormModal open onClose={onClose} size="sm" testId="revoke-cert-modal" title={`Revoke ${cert.certificateId}?`} description="Public verification will show it as revoked immediately." submitLabel="Revoke" submitVariant="danger" form={form}
      rules={{ reason: [rules.required('Reason'), rules.min(3, 'Reason')] }} onSubmit={(v) => api.post(`/certificates/${cert._id}/revoke`, { reason: v.reason.trim() })} onDone={() => { toast.success('Certificate revoked'); onDone(); }}>
      <TextAreaField {...form.field('reason')} label="Reason" required rows={2} />
    </FormModal>
  );
}

export function CertificatesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList('/certificates');
  const candidates = useFetch(() => api.get('/interns', { params: { status: 'CERTIFICATION', limit: 100 } }), [], { enabled: can('interns.read') });
  const [pick, setPick] = useState('');
  const [revoke, setRevoke] = useState(null);
  const [preview, setPreview] = useState(null);
  const send = useAction();

  const sendCert = (c) => send.run(async () => { try { const res = await api.post(`/certificates/${c._id}/send`); toast.success(res.message); } catch (e) { toast.error(e.message); } });
  const download = async (c) => { try { await downloadFile(`/certificates/${c._id}/download`, `${c.certificateId}.pdf`); } catch (e) { toast.error(e.message); } };

  const cols = [
    { key: 'id', header: 'Certificate', render: (c) => <span className="font-mono text-xs font-semibold" data-testid={`cert-id-${c.certificateId}`}>{c.certificateId}</span> },
    { key: 'name', header: 'Awarded to', render: (c) => c.internName }, { key: 'program', header: 'Program', render: (c) => c.programTitle }, { key: 'issued', header: 'Issued', render: (c) => (String(c.issueDate).includes('T') ? fmtDate(c.issueDate) : c.issueDate) },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status === 'ACTIVE' ? 'APPROVED' : 'REVOKED'} label={c.status === 'ACTIVE' ? 'Active' : 'Revoked'} /> },
    { key: 'actions', header: '', align: 'right', render: (c) => c.status === 'ACTIVE' && (
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" icon={Eye} onClick={() => setPreview(c)} data-testid={`cert-preview-${c.certificateId}`}>Preview</Button>
        <Button size="sm" variant="outline" icon={Download} onClick={() => download(c)} data-testid={`cert-download-${c.certificateId}`}>PDF</Button>
        {can('certificates.issue') && <Button size="sm" variant="outline" disabled={send.pending} onClick={() => sendCert(c)} data-testid={`cert-send-${c.certificateId}`}>Email</Button>}
        {can('certificates.revoke') && <Button size="sm" variant="outline" onClick={() => setRevoke(c)} data-testid={`cert-revoke-${c.certificateId}`}>Revoke</Button>}
      </div>
    ) }
  ];
  return (
    <>
      <PageHeader title="Certificates" description="Certificates are issued during the Certification stage of an exit, only when every eligibility check passes." />
      {can('certificates.issue') && (
        <div className="mb-6 space-y-4">
          <div className="max-w-md">
            <SelectField name="internId" label="Check eligibility for an intern in Certification" value={pick} onChange={(e) => setPick(e.target.value)} placeholder={candidates.data?.length ? 'Select an intern' : 'No interns in the Certification stage'} options={(candidates.data || []).map((i) => ({ value: i._id, label: `${fullName(i.userId)} (${i.internId})` }))} />
          </div>
          {pick && <Readiness key={pick} internId={pick} onIssued={() => list.reload({ silent: true })} />}
        </div>
      )}
      <DataTable testId="certificates-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(c) => c.certificateId} caption="Certificates" emptyTitle="No certificates issued" emptyDescription="Certificates appear here once interns complete the exit process." />
      <Pagination pagination={list.pagination} onPage={list.setPage} />
      {revoke && <RevokeModal cert={revoke} onClose={() => setRevoke(null)} onDone={() => { setRevoke(null); list.reload({ silent: true }); }} />}
      {preview && <CertificatePreviewModal cert={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
