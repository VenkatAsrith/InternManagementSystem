import React, { useState, useEffect } from 'react';
import { Download, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { downloadFile } from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { fmtDate } from '../../lib/format';
import { Button, DataTable, PageHeader, StatusBadge, Modal, LoadingBlock } from '../../components/ui';

function InternCertificatePreviewModal({ cert, onClose }) {
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
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Certificate: ${cert.certificateId}`}
      testId="intern-cert-preview-modal"
      footer={(
        <div className="flex w-full items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button variant="primary" size="sm" icon={Download} onClick={handleDownload}>Download PDF</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="min-h-[460px] h-[65vh] w-full rounded-lg bg-slate-100 flex flex-col items-center justify-center overflow-hidden border border-slate-200 relative">
          {loading && <LoadingBlock label="Rendering certificate preview..." />}
          {error && (
            <div className="text-center p-6 space-y-2">
              <p className="text-sm font-medium text-slate-800">{error}</p>
              <Button size="sm" variant="outline" icon={Download} onClick={handleDownload}>Download to inspect</Button>
            </div>
          )}
          {!loading && !error && blobUrl && (
            <iframe src={`${blobUrl}#toolbar=0`} title={`Preview of ${cert.certificateId}`} className="w-full h-full border-0 rounded-lg" />
          )}
        </div>
      </div>
    </Modal>
  );
}

export function InternCertificatesPage() {
  const toast = useToast();
  const state = useFetch(() => api.get('/certificates'), []);
  const [preview, setPreview] = useState(null);

  const download = async (c) => {
    try {
      await downloadFile(`/certificates/${c._id}/download`, `${c.certificateId}.pdf`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const cols = [
    { key: 'id', header: 'Certificate', render: (c) => <span className="font-mono text-xs font-semibold">{c.certificateId}</span> },
    { key: 'program', header: 'Program', render: (c) => c.programTitle },
    { key: 'issued', header: 'Issued', render: (c) => (String(c.issueDate).includes('T') ? fmtDate(c.issueDate) : c.issueDate) },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status === 'ACTIVE' ? 'APPROVED' : 'REVOKED'} label={c.status === 'ACTIVE' ? 'Active' : 'Revoked'} /> },
    { key: 'verify', header: 'Verify', render: (c) => <Link className="text-brand-800 underline" to={`/verify/certificate/${c.certificateId}`}>Public page</Link> },
    {
      key: 'actions', header: '', align: 'right', render: (c) => c.status === 'ACTIVE' && (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" icon={Eye} onClick={() => setPreview(c)} data-testid={`cert-preview-${c.certificateId}`}>Preview</Button>
          <Button size="sm" variant="outline" icon={Download} onClick={() => download(c)} data-testid={`cert-download-${c.certificateId}`}>Download PDF</Button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader title="Certificates" description="Your certificates are issued when you complete your internship and meet every requirement." />
      <DataTable testId="my-certificates-table" columns={cols} rows={state.data || []} loading={state.loading} error={state.error} onRetry={state.reload} rowKey={(c) => c.certificateId} caption="My certificates" emptyTitle="No certificate yet" emptyDescription="It is issued during the final stage of your exit process, if you meet the attendance, task and review requirements." />
      {preview && <InternCertificatePreviewModal cert={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
