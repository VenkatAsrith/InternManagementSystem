import React, { useState, useEffect } from 'react';
import { Download, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { downloadFile } from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { fmtDate } from '../../lib/format';
import { Button, DataTable, PageHeader, StatusBadge, Modal, LoadingBlock } from '../../components/ui';

import { CertificateLiveView } from '../../components/domain/CertificateLiveView';

function InternCertificatePreviewModal({ cert, onClose }) {
  const toast = useToast();
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('live'); // 'live' | 'pdf'

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
        console.warn('PDF stream unavailable, falling back to live replica preview:', err.message);
        setError(err.message || 'PDF not on disk');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [cert._id]);

  const handleDownload = async () => {
    try {
      await downloadFile(`/certificates/${cert._id}/download`, `${cert.certificateId}.pdf`);
    } catch (err) {
      toast.warning('Server PDF file is generating. Opening printable verified credential...');
      window.print();
    }
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
          <Button variant="outline" size="sm" onClick={onClose} data-testid="intern-cert-preview-close">Close</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
            <Button variant="primary" size="sm" icon={Download} onClick={handleDownload} data-testid="intern-cert-preview-download">Download PDF</Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        {/* Toggle between Live Credential View and PDF Document */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('live')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                viewMode === 'live' ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Live Replica Preview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pdf')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                viewMode === 'pdf' ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              PDF Document {blobUrl ? '✓' : ''}
            </button>
          </div>

          <div className="hidden sm:block text-xs text-slate-500 font-mono">
            {cert.certificateId}
          </div>
        </div>

        {viewMode === 'live' ? (
          <div className="max-h-[72vh] overflow-y-auto p-1">
            <CertificateLiveView cert={cert} onDownloadPdf={handleDownload} />
          </div>
        ) : (
          <div className="min-h-[460px] h-[65vh] w-full rounded-lg bg-slate-100 flex flex-col items-center justify-center overflow-hidden border border-slate-200 relative">
            {loading && <LoadingBlock label="Rendering server PDF..." />}
            {error && (
              <div className="text-center p-6 space-y-3">
                <p className="text-sm font-medium text-slate-800">
                  Direct server PDF stream is generating.
                </p>
                <p className="text-xs text-slate-500">
                  Switch to Live Replica Preview to inspect the verified certificate with all evaluated fields.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button size="sm" variant="primary" onClick={() => setViewMode('live')}>
                    Switch to Live Preview
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.print()}>
                    Print Certificate
                  </Button>
                </div>
              </div>
            )}
            {!loading && !error && blobUrl && (
              <iframe
                src={`${blobUrl}#toolbar=0`}
                title={`Preview of ${cert.certificateId}`}
                className="w-full h-full border-0 rounded-lg"
                data-testid="intern-cert-preview-iframe"
              />
            )}
          </div>
        )}
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
