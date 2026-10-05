import React, { useState } from 'react';
import { Send, Eye, CheckCircle2, AlertTriangle, FileText, Mail, MessageSquare } from 'lucide-react';
import api from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useForm, rules } from '../../hooks/useForm';
import { Button, FormModal, FormGrid, TextField, TextAreaField, InlineAlert, Modal } from '../ui';
import { PassPreviewModal } from './PassPreviewModal';

export function SendBootcampPassModal({ pass, bootcamp, onClose, onDone }) {
  const toast = useToast();
  const [showPassPreview, setShowPassPreview] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [deliveryLogs, setDeliveryLogs] = useState(null);

  const defaultSubject = `Your TechMecha Torque Bootcamp Pass - ${pass?.passCode || ''}`;
  const defaultBody = `Hello ${pass?.candidateName || 'Candidate'},\n\nYour registration for "${bootcamp?.title || 'TechMecha Torque Bootcamp'}" is confirmed.\n\nPlease find your official entrance pass attached as a PDF. Bring this pass with you for automated check-in verification.\n\nWe look forward to seeing you!`;

  const form = useForm({
    to: pass?.candidateEmail || '',
    subject: defaultSubject,
    message: defaultBody,
    sendEmail: true,
    sendWhatsApp: false
  });
  const f = form.field;

  const handleSend = async (v) => {
    const channels = [];
    if (v.sendEmail) channels.push('EMAIL');
    if (v.sendWhatsApp) channels.push('WHATSAPP');

    if (channels.length === 0) {
      toast.error('Select at least one delivery channel (Email or WhatsApp)');
      return;
    }

    try {
      const res = await api.post(`/growth/passes/${pass._id}/send`, {
        to: v.to.trim(),
        subject: v.subject.trim(),
        message: v.message.trim(),
        channels
      });

      setDeliveryLogs(res.data.deliveryResults || []);
      toast.success('Communication processed');
      if (onDone) onDone();
    } catch (err) {
      toast.error(err.message || 'Failed to send pass communication');
    }
  };

  if (deliveryLogs) {
    return (
      <Modal
        open
        onClose={onClose}
        size="md"
        testId="pass-delivery-results"
        title="Delivery Status"
        footer={<Button onClick={onClose} data-testid="delivery-done-btn">Done</Button>}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Dispatch results for pass <strong>{pass.passCode}</strong>:
          </p>
          <div className="space-y-2">
            {deliveryLogs.map((log, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border text-xs flex justify-between items-center ${
                  log.status === 'DELIVERED' || log.status === 'SENT'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : log.status === 'UNCONFIGURED'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
                data-testid={`delivery-channel-${log.channel.toLowerCase()}`}
              >
                <div>
                  <span className="font-bold uppercase tracking-wider">{log.channel}: </span>
                  <span className="font-semibold">{log.status}</span>
                  {log.error && <p className="mt-0.5 text-[11px] opacity-90">{log.error}</p>}
                </div>
                <span className="text-[10px] opacity-75">{log.to}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <FormModal
        open
        onClose={onClose}
        size="lg"
        testId="send-bootcamp-pass-modal"
        title="SEND BOOTCAMP PASS"
        description="Dispatch verified attendance pass directly to the candidate."
        submitLabel="Send Pass"
        form={form}
        rules={{
          to: [rules.required('Recipient email'), rules.email('Recipient email')],
          subject: rules.required('Subject'),
          message: rules.required('Message')
        }}
        onSubmit={handleSend}
        onDone={() => {}}
      >
        <FormGrid>
          <TextField {...f('to')} label="To" required type="email" placeholder="candidate@email.com" className="sm:col-span-2" />
          <TextField {...f('subject')} label="Subject" required className="sm:col-span-2" />

          {/* Attachment & Pass Preview Ribbon */}
          <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand-700" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Attachment: Bootcamp Pass.pdf</p>
                <p className="text-[11px] text-slate-500 font-mono">Pass Code: {pass?.passCode}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={Eye}
                onClick={() => setShowPassPreview(true)}
                data-testid="preview-attached-pass-btn"
              >
                Preview Pass
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={Mail}
                onClick={() => setShowEmailPreview(true)}
                data-testid="preview-email-btn"
              >
                Preview Email
              </Button>
            </div>
          </div>

          <TextAreaField {...f('message')} label="Message" rows={5} required className="sm:col-span-2" />

          {/* Channel Selection */}
          <div className="sm:col-span-2 border-t border-slate-200 pt-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Communication Channels
            </label>
            <div className="flex flex-wrap gap-6 text-sm text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.values.sendEmail}
                  onChange={(e) => form.setValue('sendEmail', e.target.checked)}
                  className="rounded border-slate-300 text-brand-700 focus:ring-brand-600"
                  data-testid="channel-email-checkbox"
                />
                <span className="flex items-center gap-1 font-medium">
                  <Mail className="h-4 w-4 text-slate-500" /> Email
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.values.sendWhatsApp}
                  onChange={(e) => form.setValue('sendWhatsApp', e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  data-testid="channel-whatsapp-checkbox"
                />
                <span className="flex items-center gap-1 font-medium">
                  <MessageSquare className="h-4 w-4 text-emerald-600" /> WhatsApp
                </span>
              </label>
            </div>
            {form.values.sendWhatsApp && (
              <p className="mt-2 text-xs text-amber-700 font-medium">
                Note: If WhatsApp API provider is unconfigured, system will report truthful status without faking delivery.
              </p>
            )}
          </div>
        </FormGrid>
      </FormModal>

      {/* Embedded Pass Preview Modal */}
      {showPassPreview && (
        <PassPreviewModal pass={pass} onClose={() => setShowPassPreview(false)} />
      )}

      {/* Email Preview Modal */}
      {showEmailPreview && (
        <Modal
          open
          onClose={() => setShowEmailPreview(false)}
          size="lg"
          testId="email-preview-modal"
          title="Email Preview"
          footer={<Button onClick={() => setShowEmailPreview(false)}>Close Preview</Button>}
        >
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm text-sm" data-testid="email-preview-card">
            <div className="space-y-2 border-b border-slate-200 pb-3 text-xs text-slate-600">
              <div className="flex">
                <span className="w-20 font-bold uppercase text-slate-500">From:</span>
                <span className="text-slate-800 font-medium">TechMecha Torque Admissions &lt;admissions@techmecha.com&gt;</span>
              </div>
              <div className="flex">
                <span className="w-20 font-bold uppercase text-slate-500">To:</span>
                <span className="text-slate-900 font-semibold" data-testid="preview-to">{form.values.to}</span>
              </div>
              <div className="flex">
                <span className="w-20 font-bold uppercase text-slate-500">Subject:</span>
                <span className="text-slate-900 font-semibold" data-testid="preview-subject">{form.values.subject}</span>
              </div>
              <div className="flex">
                <span className="w-20 font-bold uppercase text-slate-500">Attachment:</span>
                <span className="inline-flex items-center gap-1 text-brand-800 font-mono font-medium">
                  <FileText className="h-3.5 w-3.5" /> Bootcamp-Pass-{pass?.passCode}.pdf
                </span>
              </div>
            </div>

            <div className="whitespace-pre-wrap text-slate-800 bg-slate-50 p-4 rounded border border-slate-100 font-sans" data-testid="preview-body">
              {form.values.message}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
