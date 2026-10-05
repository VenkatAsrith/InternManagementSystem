import React, { useState } from 'react';
import { Mail, Globe, MessageSquare, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { Button, Modal, InlineAlert, CheckboxField } from '../ui';
import { fullName } from '../../lib/format';

export function SendDocumentModal({ doc, onClose, onDone }) {
  const toast = useToast();
  const [email, setEmail] = useState(true);
  const [portal, setPortal] = useState(true);
  const [whatsapp, setWhatsapp] = useState(false);
  const [sending, setSending] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState(null);

  const recipient = doc.internId?.userId;
  const recipientName = recipient ? fullName(recipient) : 'Recipient';
  const recipientEmail = recipient?.email || 'No email on record';
  const recipientPhone = recipient?.phone || 'No phone on record';

  const handleSend = async () => {
    const selectedChannels = [];
    if (email) selectedChannels.push('EMAIL');
    if (portal) selectedChannels.push('PORTAL');
    if (whatsapp) selectedChannels.push('WHATSAPP');

    if (selectedChannels.length === 0) {
      toast.error('Select at least one delivery channel.');
      return;
    }

    try {
      setSending(true);
      const res = await api.post(`/documents/${doc._id}/send`, { channels: selectedChannels });
      setDeliveryResult(res.data);
      toast.success(res.message || 'Document dispatched successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to dispatch document');
    } finally {
      setSending(false);
    }
  };

  if (deliveryResult) {
    const history = deliveryResult.deliveryHistory || [];
    const handleCloseResult = () => {
      if (onDone) onDone();
      onClose();
    };

    return (
      <Modal
        open
        onClose={handleCloseResult}
        size="md"
        testId="send-result-modal"
        title="Document Dispatched"
        footer={<Button variant="primary" onClick={handleCloseResult} data-testid="send-result-done">Done</Button>}
      >
        <div className="space-y-4">
          <InlineAlert tone="success">
            The document <strong>{doc.documentId}</strong> was processed through the selected delivery channels.
          </InlineAlert>

          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between p-3 text-sm">
                <div className="flex items-center gap-2.5">
                  {h.channel === 'EMAIL' && <Mail className="h-4 w-4 text-blue-600" />}
                  {h.channel === 'PORTAL' && <Globe className="h-4 w-4 text-emerald-600" />}
                  {h.channel === 'WHATSAPP' && <MessageSquare className="h-4 w-4 text-green-600" />}
                  <span className="font-medium text-slate-800">{h.channel}</span>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${h.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' : h.status === 'SENT' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                  {h.status || 'PROCESSED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      testId="send-document-modal"
      title={`Send ${doc.title || 'Document'}`}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Send}
            loading={sending}
            onClick={handleSend}
            data-testid="confirm-send-document"
          >
            Dispatch Document
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1 text-sm">
          <p className="font-semibold text-slate-900">{doc.title} ({doc.documentId})</p>
          <p className="text-slate-600 text-xs">
            Recipient: <strong className="text-slate-800">{recipientName}</strong> &bull; {recipientEmail}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Delivery Channels</p>
          <div className="space-y-2.5">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={email}
                onChange={(e) => setEmail(e.target.checked)}
                className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                data-testid="channel-email"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 font-medium text-sm text-slate-900">
                  <Mail className="h-4 w-4 text-blue-600" />
                  Email Dispatch
                </div>
                <p className="text-xs text-slate-500">Sends high-priority PDF attachment directly to {recipientEmail}.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={portal}
                onChange={(e) => setPortal(e.target.checked)}
                className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                data-testid="channel-portal"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 font-medium text-sm text-slate-900">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  Intern Workspace Portal
                </div>
                <p className="text-xs text-slate-500">Makes the letter immediately available in the intern's verified document vault.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={whatsapp}
                onChange={(e) => setWhatsapp(e.target.checked)}
                className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                data-testid="channel-whatsapp"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 font-medium text-sm text-slate-900">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  WhatsApp Notification (Optional)
                </div>
                <p className="text-xs text-slate-500">Sends instant verification link to {recipientPhone}.</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
