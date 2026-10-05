import React, { useState, useEffect } from 'react';
import { Download, ExternalLink, AlertCircle } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { Button, Modal, LoadingBlock } from '../ui';

export function ResumePreviewModal({ applicationId, candidateName, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let url = null;

    async function loadResume() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/recruitment/applications/${applicationId}/resume?inline=1`, {
          responseType: 'blob'
        });
        if (!active) return;
        const mime = res.headers?.['content-type'] || 'application/pdf';
        url = URL.createObjectURL(new Blob([res.data], { type: mime }));
        setBlobUrl(url);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load resume preview.');
      } finally {
        if (active) setLoading(false);
      }
    }

    if (applicationId) {
      loadResume();
    }

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [applicationId]);

  const handleDownload = async () => {
    try {
      await downloadFile(`/recruitment/applications/${applicationId}/resume`, `${candidateName || 'candidate'}-resume.pdf`);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      testId="resume-preview-modal"
      title={`Resume - ${candidateName || 'Candidate'}`}
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="resume-preview-close">
            Close
          </Button>
          <div className="flex gap-2">
            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                data-testid="resume-preview-newtab"
              >
                <ExternalLink className="h-4 w-4" />
                Open in tab
              </a>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={Download}
              onClick={handleDownload}
              data-testid="resume-preview-download"
            >
              Download PDF
            </Button>
          </div>
        </div>
      }
    >
      <div className="min-h-[500px] h-[70vh] w-full rounded-lg bg-slate-100 flex flex-col items-center justify-center overflow-hidden border border-slate-200">
        {loading && <LoadingBlock label="Rendering resume preview..." />}
        {error && (
          <div className="text-center p-6 space-y-3">
            <AlertCircle className="h-10 w-10 text-amber-600 mx-auto" />
            <p className="text-sm font-medium text-slate-800">{error}</p>
            <p className="text-xs text-slate-500">You can still try downloading the original file directly.</p>
            <Button size="sm" variant="outline" icon={Download} onClick={handleDownload}>
              Download file directly
            </Button>
          </div>
        )}
        {!loading && !error && blobUrl && (
          <iframe
            src={`${blobUrl}#toolbar=0`}
            title={`Resume of ${candidateName}`}
            className="w-full h-full border-0 rounded-lg"
            data-testid="resume-preview-iframe"
          />
        )}
      </div>
    </Modal>
  );
}
