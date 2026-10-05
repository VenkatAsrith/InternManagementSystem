import React, { useState, useEffect } from 'react';
import { Download, ExternalLink, Printer, FileText, Send, CheckCircle, Clock, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { Button, Modal, LoadingBlock, DetailList, StatusBadge } from '../ui';
import { fmtDateTime, fullName, humanize } from '../../lib/format';

export function DocumentPreviewModal({ doc, onClose, onOpenSend }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [detectedType, setDetectedType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let url = null;

    async function loadDocument() {
      if (!doc?._id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/documents/${doc._id}/download?inline=1`, {
          responseType: 'blob'
        });
        if (!active) return;
        const mime = res.headers?.['content-type'] || doc.mimeType || 'application/pdf';
        setDetectedType(mime);
        url = URL.createObjectURL(new Blob([res.data], { type: mime }));
        setBlobUrl(url);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to render document preview.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDocument();

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc?._id]);

  const handleDownload = async () => {
    try {
      await downloadFile(`/documents/${doc._id}/download`, doc.originalName || `${doc.documentId || 'document'}.pdf`);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const who = doc.internId?.userId ? `${fullName(doc.internId.userId)} (${doc.internId.internId})` : '-';
  const isImage = (detectedType || doc.mimeType || '').startsWith('image/');
  const isPdf = (detectedType || doc.mimeType || '') === 'application/pdf';

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      testId="document-preview-modal"
      title={`Preview: ${doc.title || doc.originalName || doc.documentType || 'Document'}`}
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="doc-preview-close">
            Close
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleDownload}
              data-testid="doc-preview-download"
            >
              Download {isPdf ? 'PDF' : 'File'}
            </Button>
            {onOpenSend && !['REVOKED', 'ARCHIVED'].includes(doc.status) && (
              <Button
                variant="primary"
                size="sm"
                icon={Send}
                onClick={() => {
                  onClose();
                  onOpenSend(doc);
                }}
                data-testid="doc-preview-send"
              >
                Send Document...
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Document Metadata Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
          <div>
            <p className="text-slate-500 uppercase tracking-wider font-semibold">Document Reference</p>
            <p className="font-mono font-medium text-slate-900 mt-0.5 truncate">{doc.documentId || doc.originalName || doc._id}</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wider font-semibold">Recipient / Owner</p>
            <p className="font-medium text-slate-900 mt-0.5 truncate">{who}</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wider font-semibold">Type & Version</p>
            <p className="font-medium text-slate-900 mt-0.5">{humanize(doc.type || 'DOCUMENT')} (v{doc.version || 1})</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wider font-semibold">Current Status</p>
            <div className="mt-0.5"><StatusBadge status={doc.status} /></div>
          </div>
        </div>

        {/* Document Viewer Canvas */}
        <div className="min-h-[460px] h-[65vh] w-full rounded-lg bg-slate-100 flex flex-col items-center justify-center overflow-hidden border border-slate-200 relative">
          {loading && <LoadingBlock label="Retrieving document preview..." />}
          {error && (
            <div className="text-center p-6 space-y-2">
              <FileText className="h-10 w-10 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-800">{error}</p>
              <Button size="sm" variant="outline" icon={Download} onClick={handleDownload}>
                Download File to inspect
              </Button>
            </div>
          )}
          {!loading && !error && blobUrl && (
            isImage ? (
              <div className="w-full h-full flex items-center justify-center p-4 bg-slate-900/5 overflow-auto">
                <img
                  src={blobUrl}
                  alt={doc.title || doc.originalName}
                  className="max-h-full max-w-full object-contain rounded shadow border border-slate-200"
                  data-testid="document-preview-image"
                />
              </div>
            ) : isPdf ? (
              <iframe
                src={`${blobUrl}#toolbar=0`}
                title={`Preview of ${doc.title || doc.originalName}`}
                className="w-full h-full border-0 rounded-lg"
                data-testid="document-preview-iframe"
              />
            ) : (
              <div className="text-center p-6 space-y-3">
                <FileText className="h-12 w-12 text-primary-600 mx-auto" />
                <p className="text-base font-semibold text-slate-900">{doc.originalName || doc.title}</p>
                <p className="text-xs text-slate-500">Preview is optimized for PDF and Image files. Download to inspect this format.</p>
                <Button size="sm" variant="primary" icon={Download} onClick={handleDownload}>
                  Download Document
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    </Modal>
  );
}
