import React, { useState } from 'react';
import { Eye, FileDown, Plus } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { session } from '../../lib/session';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useAction, useForm, rules } from '../../hooks/useForm';
import { fullName, humanize } from '../../lib/format';
import { DOCUMENT_TYPE } from '@shared/constants.js';
import { Button, DataTable, FormGrid, FormModal, InlineAlert, Modal, PageHeader, SelectField, StateView, StatusBadge, TextAreaField, TextField } from '../../components/ui';

const CERT_PLACEHOLDERS = [
  '{{organization_name}}', '{{participant_name}}', '{{participant_email}}', '{{issue_date}}',
  '{{program_name}}', '{{certificate_id}}', '{{completion_date}}', '{{instructor_name}}',
  '{{grade}}', '{{signatory_name}}', '{{signatory_title}}', '{{verification_url}}'
];

const PASS_PLACEHOLDERS = [
  '{{organization_name}}', '{{participant_name}}', '{{participant_email}}', '{{pass_id}}',
  '{{bootcamp_name}}', '{{event_date}}', '{{event_start_time}}', '{{venue}}', '{{participant_type}}'
];

function VersionModal({ base, onClose, onDone }) {
  const toast = useToast();
  const [templateType, setTemplateType] = useState(base?.templateType || 'LETTER');
  const [showLivePreview, setShowLivePreview] = useState(false);

  const form = useForm({
    templateCode: base?.templateCode || '',
    title: base?.title || '',
    documentType: base?.documentType || (base?.templateType === 'BOOTCAMP_PASS' ? 'BOOTCAMP_PASS' : base?.templateType === 'CERTIFICATE' ? 'CERTIFICATE' : 'OFFER_LETTER'),
    bodyMarkdown: base?.bodyMarkdown || '',
    bodyHtml: base?.bodyHtml || (templateType === 'CERTIFICATE' ? `<div style="font-family: sans-serif; text-align: center; border: 8px solid #0f172a; padding: 40px; background: #ffffff;">\n  <h1 style="color: #0f172a; font-size: 26px; text-transform: uppercase;">Certificate of Completion</h1>\n  <p style="font-size: 13px; color: #64748b;">This certifies that</p>\n  <h2 style="font-size: 24px; color: #2563eb; margin: 12px 0;">{{participant_name}}</h2>\n  <p style="font-size: 13px; color: #334155;">has successfully completed all requirements for</p>\n  <h3 style="font-size: 18px; color: #0f172a; margin: 10px 0;">{{program_name}}</h3>\n  <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; pt: 10px;">\n    <div><strong>Certificate ID:</strong> {{certificate_id}}</div>\n    <div><strong>Issued:</strong> {{issue_date}}</div>\n  </div>\n</div>` : templateType === 'BOOTCAMP_PASS' ? `<div style="font-family: sans-serif; border: 2px dashed #4338ca; border-radius: 12px; padding: 24px; background: #f8fafc; max-width: 450px; margin: auto;">\n  <div style="text-align: center;">\n    <span style="background: #4338ca; color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold;">ADMIT ONE PASS</span>\n    <h2 style="color: #1e1b4b; font-size: 20px; margin: 12px 0 4px;">{{bootcamp_name}}</h2>\n    <p style="font-size: 12px; color: #64748b;">{{venue}} &bull; {{event_date}} at {{event_start_time}}</p>\n  </div>\n  <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 16px 0;" />\n  <div style="font-size: 13px; color: #1e293b; line-height: 1.6;">\n    <div><strong>Pass Code:</strong> <span style="font-family: monospace; color: #4338ca; font-weight: bold;">{{pass_id}}</span></div>\n    <div><strong>Participant:</strong> {{participant_name}}</div>\n    <div><strong>Email:</strong> {{participant_email}}</div>\n  </div>\n</div>` : ''),
    bodyCss: base?.bodyCss || ''
  });
  const f = form.field;

  const handleInsertPlaceholder = (placeholder) => {
    if (templateType === 'LETTER') {
      form.set('bodyMarkdown', (form.values.bodyMarkdown || '') + ` ${placeholder}`);
    } else {
      form.set('bodyHtml', (form.values.bodyHtml || '') + ` ${placeholder}`);
    }
    toast.success(`Inserted ${placeholder}`);
  };

  const getSampleHtmlPreview = () => {
    let html = form.values.bodyHtml || '<p>Enter HTML content...</p>';
    const sampleMap = {
      '{{organization_name}}': 'TechMecha Torque Technologies',
      '{{participant_name}}': 'Aarav Sharma',
      '{{participant_email}}': 'aarav.sharma@example.com',
      '{{issue_date}}': new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      '{{program_name}}': 'Full Stack Cloud Engineering Track',
      '{{course_name}}': 'Advanced React & Microservices Architecture',
      '{{template_title}}': form.values.title || 'Official Document',
      '{{certificate_id}}': 'TMT-CERT-2026-9481',
      '{{completion_date}}': '10 October 2026',
      '{{instructor_name}}': 'Dr. Rajesh Nair',
      '{{grade}}': 'A+ (Distinction)',
      '{{signatory_name}}': 'Rohan Sen',
      '{{signatory_title}}': 'Head of Engineering & Talent',
      '{{verification_url}}': 'https://verify.techmecha.com/cert/TMT-CERT-2026-9481',
      '{{pass_id}}': 'TMT-PASS-73812-9901',
      '{{bootcamp_name}}': 'Cloud & DevOps Acceleration Bootcamp',
      '{{event_date}}': '15 October 2026',
      'event_start_time': '10:00 AM',
      '{{event_start_time}}': '10:00 AM',
      '{{venue}}': 'Campus Auditorium & Virtual Live Stream',
      '{{participant_type}}': 'Registered Delegate'
    };
    for (const [k, v] of Object.entries(sampleMap)) {
      html = html.split(k).join(v);
    }
    return html;
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="xl"
      testId="template-modal"
      title={base ? `Edit Version: ${base.templateCode}` : 'Create Document / HTML Template'}
      description="Create customizable templates with dynamic placeholders. Every change creates a versioned revision."
      submitLabel="Save & Publish Version"
      form={form}
      rules={{
        templateCode: [
          rules.required('Template code'),
          (v) => (v && !/^[A-Z][A-Z0-9_]{2,39}$/.test(v) ? 'Use capital letters, digits and underscores' : null)
        ],
        title: rules.required('Title')
      }}
      onSubmit={(v) =>
        api.post('/templates', {
          templateCode: v.templateCode.trim(),
          title: v.title.trim(),
          documentType: v.documentType,
          templateType,
          bodyMarkdown: templateType === 'LETTER' ? v.bodyMarkdown : undefined,
          bodyHtml: templateType !== 'LETTER' ? v.bodyHtml : undefined,
          bodyCss: templateType !== 'LETTER' ? v.bodyCss : undefined
        })
      }
      onDone={(res) => {
        toast.success(res.message);
        onDone();
      }}
    >
      <FormGrid>
        {/* Template Format Selector */}
        <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
            Template Architecture & Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'LETTER', label: 'Standard Letter (Markdown)' },
              { id: 'CERTIFICATE', label: 'HTML Certificate' },
              { id: 'BOOTCAMP_PASS', label: 'HTML Check-in Pass' }
            ].map((t) => (
              <label
                key={t.id}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-medium transition ${
                  templateType === t.id ? 'border-brand-600 bg-white shadow-xs text-brand-950 font-semibold' : 'border-slate-200 bg-white/60 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="templateType"
                  value={t.id}
                  checked={templateType === t.id}
                  onChange={() => setTemplateType(t.id)}
                  className="text-brand-600 focus:ring-brand-500"
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <TextField {...f('templateCode')} label="Template Code" required disabled={!!base} hint="e.g. CERT_COMPLETION or BOOTCAMP_PASS_A" />
        <SelectField
          {...f('documentType')}
          label="Document Classification"
          options={Object.values(DOCUMENT_TYPE).map((t) => ({ value: t, label: humanize(t) }))}
        />
        <TextField {...f('title')} label="Template Name" required className="sm:col-span-2" placeholder="Official Certificate of Completion" />

        {/* Dynamic Placeholders Reference */}
        <div className="sm:col-span-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">
            Available Dynamic Placeholders (Click to Insert)
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(templateType === 'BOOTCAMP_PASS' ? PASS_PLACEHOLDERS : CERT_PLACEHOLDERS).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleInsertPlaceholder(p)}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-100/70 transition shadow-2xs"
                title={`Insert ${p}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {templateType === 'LETTER' ? (
          <TextAreaField
            {...f('bodyMarkdown')}
            label="Letter Markdown Template"
            required
            rows={12}
            className="sm:col-span-2"
            hint="Use {{variable}} placeholders such as {{candidate.name}} and {{intern.startDate}}."
          />
        ) : (
          <div className="sm:col-span-2 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                HTML Template Code
              </label>
              <Button
                size="xs"
                variant="outline"
                type="button"
                onClick={() => setShowLivePreview(!showLivePreview)}
              >
                {showLivePreview ? 'Hide Live Preview' : 'Show Live Preview'}
              </Button>
            </div>
            <TextAreaField
              {...f('bodyHtml')}
              rows={10}
              className="font-mono text-xs"
              placeholder="<div>Enter template HTML with inline CSS and {{placeholders}}...</div>"
            />
            {showLivePreview && (
              <div className="rounded-xl border border-slate-300 p-4 bg-slate-100 space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Live Sandboxed Sample Preview</p>
                <div className="bg-white rounded-lg border border-slate-200 p-2 overflow-auto max-h-[300px]">
                  <iframe
                    srcDoc={getSampleHtmlPreview()}
                    sandbox="allow-same-origin"
                    title="Live Preview"
                    className="w-full min-h-[260px] border-0"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </FormGrid>
    </FormModal>
  );
}

function PreviewModal({ template, onClose }) {
  const toast = useToast();
  const state = useFetch(() => api.post(`/templates/${template._id}/preview`, {}), [template._id]);
  const pdf = useAction();
  const [blobUrl, setBlobUrl] = useState(null);
  const [loadingBlob, setLoadingBlob] = useState(false);
  const [mode, setMode] = useState(template.bodyHtml ? 'html' : 'pdf'); // 'html' | 'pdf' | 'text'

  React.useEffect(() => {
    let active = true;
    let url = null;
    async function fetchPdfBlob() {
      try {
        setLoadingBlob(true);
        const res = await api.get(`/templates/${template._id}/pdf-preview`, { responseType: 'blob' });
        if (!active) return;
        const blob = res instanceof Blob ? res : (res?.data instanceof Blob ? res.data : new Blob([res], { type: 'application/pdf' }));
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        console.warn('PDF preview could not be loaded directly:', err.message);
      } finally {
        if (active) setLoadingBlob(false);
      }
    }
    if (template?._id) fetchPdfBlob();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [template?._id]);

  const openPdf = () => pdf.run(async () => {
    try {
      await downloadFile(`/templates/${template._id}/pdf-preview`, `${template.templateCode}_preview.pdf`);
    } catch (e) {
      toast.error(e.message);
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      testId="template-preview"
      title={`${template.title} (v${template.version})`}
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex gap-2">
            {template.bodyHtml && (
              <Button
                size="xs"
                variant={mode === 'html' ? 'primary' : 'outline'}
                onClick={() => setMode('html')}
                data-testid="mode-html"
              >
                Evaluated Live View
              </Button>
            )}
            <Button
              size="xs"
              variant={mode === 'pdf' ? 'primary' : 'outline'}
              onClick={() => setMode('pdf')}
              data-testid="mode-pdf"
            >
              PDF Document {blobUrl ? '✓' : ''}
            </Button>
            <Button
              size="xs"
              variant={mode === 'text' ? 'primary' : 'outline'}
              onClick={() => setMode('text')}
              data-testid="mode-text"
            >
              Resolved Text
            </Button>
          </div>
          <Button
            variant="outline"
            icon={FileDown}
            loading={pdf.pending}
            onClick={openPdf}
            data-testid="pdf-preview"
          >
            Download PDF preview
          </Button>
        </div>
      }
    >
      <StateView state={state}>
        {(p) => {
          // Client-side fallback interpolation so that no raw {{...}} placeholders ever appear
          const evaluatedHtml = (() => {
            if (p?.interpolatedHtml) return p.interpolatedHtml;
            if (!template?.bodyHtml) return null;
            let html = template.bodyHtml;
            const ctx = p?.contextUsed || {
              candidate: { name: 'Sample Participant', email: 'candidate@techmechatorque.com' },
              intern: { internId: 'INT-2026-0042', role: 'Full Stack Web Development Intern', department: 'Software Engineering', startDate: '15 Jan 2026', endDate: '15 Apr 2026', workMode: 'Remote' },
              organization: { name: 'TechMecha Torque Pvt. Ltd.', signatoryName: 'Jay Chandra Reddy', signatoryTitle: 'Founder & CEO' },
              issueDate: '22 October 2026',
              stipend: { amount: 'INR 15,000 / month' },
              document: { sequence: 'DOC/2026/0042' }
            };
            return html.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (match, path) => {
              const parts = path.split('.');
              let cur = ctx;
              for (const part of parts) {
                if (cur == null) return match;
                cur = cur[part];
              }
              return cur !== undefined && cur !== null ? String(cur) : match;
            });
          })();

          return (
            <div className="space-y-3">
              {p.isSample && (
                <InlineAlert tone="warning" testId="sample-warning">
                  This preview uses SAMPLE values, not a real person&apos;s data. Nothing here can be issued.
                </InlineAlert>
              )}
              {p.missingVariables?.length > 0 && (
                <InlineAlert tone="warning" title="Unknown variables" testId="missing-vars">
                  {p.missingVariables.join(', ')}
                </InlineAlert>
              )}

              {mode === 'html' && evaluatedHtml ? (
                <div className="w-full h-[520px] rounded-lg border border-slate-200 overflow-hidden bg-white shadow-inner">
                  <iframe
                    srcDoc={evaluatedHtml}
                    sandbox="allow-same-origin"
                    className="w-full h-full border-0"
                    title="HTML Preview"
                  />
                </div>
              ) : mode === 'pdf' ? (
                blobUrl ? (
                  <iframe
                    src={`${blobUrl}#toolbar=0`}
                    className="w-full h-[520px] rounded-lg border border-slate-200 shadow-inner bg-slate-100"
                    title="PDF Preview"
                    data-testid="template-pdf-frame"
                  />
                ) : loadingBlob ? (
                  <div className="h-[520px] flex items-center justify-center border border-slate-200 rounded-lg bg-slate-50 text-slate-500 text-sm">
                    Rendering PDF document preview...
                  </div>
                ) : evaluatedHtml ? (
                  <div className="w-full h-[520px] rounded-lg border border-slate-200 overflow-hidden bg-white shadow-inner">
                    <iframe
                      srcDoc={evaluatedHtml}
                      sandbox="allow-same-origin"
                      className="w-full h-full border-0"
                      title="HTML Preview"
                    />
                  </div>
                ) : (
                  <pre
                    className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900"
                    data-testid="preview-text"
                  >
                    {p.interpolatedMarkdown}
                  </pre>
                )
              ) : (
                <pre
                  className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900"
                  data-testid="preview-text"
                >
                  {p.interpolatedMarkdown}
                </pre>
              )}
            </div>
          );
        }}
      </StateView>
    </Modal>
  );
}

export function TemplatesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const state = useFetch(() => api.get('/templates'), []);
  const [modal, setModal] = useState(null);
  const seed = useAction();
  const latest = Object.values((state.data || []).reduce((acc, t) => { if (!acc[t.templateCode] || acc[t.templateCode].version < t.version) acc[t.templateCode] = t; return acc; }, {}));
  const doSeed = () => seed.run(async () => { try { await api.post('/templates/seed'); toast.success('Default templates initialised'); state.reload({ silent: true }); } catch (e) { toast.error(e.message); } });
  const cols = [
    { key: 'code', header: 'Template', render: (t) => <div><p className="font-medium text-slate-900">{t.title}</p><p className="font-mono text-xs text-slate-600">{t.templateCode}</p></div> },
    { key: 'type', header: 'Type', render: (t) => humanize(t.documentType) }, { key: 'version', header: 'Version', render: (t) => `v${t.version}` },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.isApproved ? 'APPROVED' : 'DRAFT'} /> }, { key: 'approved', header: 'Approved by', render: (t) => (t.approvedBy ? fullName(t.approvedBy) : '-') },
    { key: 'actions', header: '', align: 'right', render: (t) => (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" icon={Eye} onClick={() => setModal({ type: 'preview', t })} data-testid={`template-preview-${t.templateCode}`}>Preview</Button>
        {can('templates.manage') && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'version', t })} data-testid={`template-edit-${t.templateCode}`}>New version</Button>}
      </div>
    ) }
  ];
  return (
    <>
      <PageHeader title="Templates" description="Letter templates with versioning. Only the latest version of each template is listed."
        actions={can('templates.manage') && <>{latest.length === 0 && <Button variant="outline" loading={seed.pending} onClick={doSeed} data-testid="seed-templates">Load default templates</Button>}<Button icon={Plus} onClick={() => setModal({ type: 'version', t: null })} data-testid="new-template">New template</Button></>} />
      <DataTable testId="templates-table" columns={cols} rows={latest} loading={state.loading} error={state.error} onRetry={state.reload} rowKey={(t) => t.templateCode} caption="Templates" emptyTitle="No templates" emptyDescription="Load the default letter templates or create your own." />
      {modal?.type === 'version' && <VersionModal base={modal.t} onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload({ silent: true }); }} />}
      {modal?.type === 'preview' && <PreviewModal template={modal.t} onClose={() => setModal(null)} />}
    </>
  );
}
