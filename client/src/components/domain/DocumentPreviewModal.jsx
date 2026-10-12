import React, { useState, useEffect } from 'react';
import { Download, ExternalLink, Printer, FileText, Send, CheckCircle, Clock, ShieldCheck, Image as ImageIcon, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { session } from '../../lib/session';
import { Button, Modal, LoadingBlock, DetailList, StatusBadge } from '../ui';
import { fmtDateTime, fullName, humanize } from '../../lib/format';

export function DocumentPreviewModal({ doc, onClose, onOpenSend }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [detectedType, setDetectedType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  useEffect(() => {
    let active = true;
    let url = null;

    async function loadDocument() {
      if (!doc) return;

      // Sandboxed HTML preview
      if (doc.htmlContent || doc.bodyHtml || doc.bodyMarkdown) {
        setLoading(false);
        setDetectedType('text/html');
        return;
      }

      // Direct image/PDF URL (e.g. external asset or attachment)
      if (doc.url && (doc.url.startsWith('http://') || doc.url.startsWith('https://') || doc.url.startsWith('data:'))) {
        setBlobUrl(doc.url);
        const lowerUrl = doc.url.toLowerCase();
        if (lowerUrl.endsWith('.png') || lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.gif') || lowerUrl.startsWith('data:image/')) {
          setDetectedType('image/png');
        } else if (lowerUrl.endsWith('.pdf')) {
          setDetectedType('application/pdf');
        }
        setLoading(false);
        return;
      }

      const docId = doc?._id || doc?.id;
      if (!docId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const token = session.getToken();
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const actingOrg = session.getActingOrg();
        if (actingOrg) headers['x-organization-id'] = actingOrg;

        const response = await fetch(`/api/v1/documents/${docId}/download?inline=1`, { headers });
        if (!response.ok) {
          throw new Error(`Failed to load document (${response.status} ${response.statusText})`);
        }
        const mime = response.headers.get('content-type') || doc.mimeType || 'application/pdf';
        const blobData = await response.blob();
        if (!active) return;
        setDetectedType(mime);
        url = URL.createObjectURL(blobData);
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
  }, [doc?._id, doc?.id]);

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
          {!loading && !error && (
            (doc?.htmlContent || doc?.bodyHtml) ? (
              <div className="w-full h-full flex flex-col bg-white">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <span className="font-medium">Sandboxed HTML Template Preview</span>
                  <div className="flex items-center gap-1">
                    <Button size="xs" variant="ghost" icon={ZoomOut} onClick={() => setZoomLevel(z => Math.max(50, z - 10))} />
                    <span className="px-1 text-[11px] font-mono">{zoomLevel}%</span>
                    <Button size="xs" variant="ghost" icon={ZoomIn} onClick={() => setZoomLevel(z => Math.min(150, z + 10))} />
                    <Button size="xs" variant="ghost" icon={RefreshCw} onClick={() => setZoomLevel(100)}>Reset</Button>
                  </div>
                </div>
                <div className="flex-1 w-full overflow-auto p-4 flex justify-center">
                  <div style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s' }} className="w-full h-full">
                    <iframe
                      srcDoc={doc.htmlContent || doc.bodyHtml}
                      sandbox="allow-same-origin"
                      title={doc.title || 'HTML Preview'}
                      className="w-full h-full min-h-[500px] border border-slate-200 rounded shadow-sm bg-white"
                      data-testid="document-preview-html-iframe"
                    />
                  </div>
                </div>
              </div>
            ) : isImage && blobUrl ? (
              <div className="w-full h-full flex items-center justify-center p-4 bg-slate-900/5 overflow-auto">
                <img
                  src={blobUrl}
                  alt={doc.title || doc.originalName}
                  style={{ transform: `scale(${zoomLevel / 100})`, transition: 'transform 0.2s' }}
                  className="max-h-full max-w-full object-contain rounded shadow border border-slate-200"
                  data-testid="document-preview-image"
                />
              </div>
            ) : isPdf && blobUrl ? (
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
                <p className="text-xs text-slate-500">Preview is optimized for PDF, HTML and Image files. Download to inspect this format.</p>
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
