import React, { useState, useEffect } from 'react';
import { Download, ExternalLink, Ticket, Send, ShieldCheck, Mail } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { Button, Modal, LoadingBlock, InlineAlert } from '../ui';

export function PassPreviewModal({ pass, onClose, onOpenSend }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let url = null;

    async function loadPass() {
      if (!pass?._id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/growth/passes/${pass._id}/pdf?inline=1`, {
          responseType: 'blob'
        });
        if (!active) return;
        const blob = res instanceof Blob ? res : (res?.data instanceof Blob ? res.data : new Blob([res], { type: 'application/pdf' }));
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to render pass preview.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPass();

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [pass?._id]);

  const handleDownload = async () => {
    try {
      await downloadFile(`/growth/passes/${pass._id}/pdf`, `${pass.passCode || 'bootcamp-pass'}.pdf`);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      testId="pass-preview-modal"
      title={`Admission Pass: ${pass.candidateName || 'Candidate'}`}
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="pass-preview-close">
            Close
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleDownload}
              data-testid="pass-preview-download"
            >
              Download PDF
            </Button>
            {onOpenSend && (
              <Button
                variant="primary"
                size="sm"
                icon={Mail}
                onClick={() => {
                  onClose();
                  onOpenSend(pass);
                }}
                data-testid="pass-preview-send"
              >
                Email / WhatsApp Pass...
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Pass Metadata Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
          <div>
            <p className="text-slate-500 uppercase tracking-wider font-semibold">Pass Code</p>
            <p className="font-mono font-bold text-brand-800 mt-0.5" data-testid="preview-pass-code">{pass.passCode}</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wider font-semibold">Candidate</p>
            <p className="font-medium text-slate-900 mt-0.5">{pass.candidateName}</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wider font-semibold">Email</p>
            <p className="text-slate-700 mt-0.5 truncate">{pass.candidateEmail}</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wider font-semibold">Status</p>
            <span className={`inline-flex mt-0.5 text-xs font-semibold px-2 py-0.5 rounded ${pass.status === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
              {pass.status}
            </span>
          </div>
        </div>

        {/* Pass Canvas */}
        <div className="min-h-[500px] h-[68vh] w-full rounded-lg bg-slate-100 flex flex-col items-center justify-center overflow-hidden border border-slate-200">
          {loading && <LoadingBlock label="Rendering official entrance pass..." />}
          {error && (
            <div className="text-center p-6 space-y-2">
              <Ticket className="h-10 w-10 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-800">{error}</p>
              <Button size="sm" variant="outline" icon={Download} onClick={handleDownload}>
                Download Pass to inspect
              </Button>
            </div>
          )}
          {!loading && !error && blobUrl && (
            <iframe
              src={`${blobUrl}#toolbar=0`}
              title={`Preview of ${pass.passCode}`}
              className="w-full h-full border-0 rounded-lg"
              data-testid="pass-preview-iframe"
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
