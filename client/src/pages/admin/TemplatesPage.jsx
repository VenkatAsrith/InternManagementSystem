import React, { useState } from 'react';
import { Eye, FileDown, Plus } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useAction, useForm, rules } from '../../hooks/useForm';
import { fullName, humanize } from '../../lib/format';
import { DOCUMENT_TYPE } from '@shared/constants.js';
import { Button, DataTable, FormGrid, FormModal, InlineAlert, Modal, PageHeader, SelectField, StateView, StatusBadge, TextAreaField, TextField } from '../../components/ui';

function VersionModal({ base, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ templateCode: base?.templateCode || '', title: base?.title || '', documentType: base?.documentType || 'OFFER_LETTER', bodyMarkdown: base?.bodyMarkdown || '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="xl" testId="template-modal" title={base ? `New version of ${base.templateCode}` : 'New template'} description="Saving never edits history. It creates a new version, and documents already issued keep the version they used." submitLabel="Save as new version" form={form}
      rules={{ templateCode: [rules.required('Template code'), (v) => (v && !/^[A-Z][A-Z0-9_]{2,39}$/.test(v) ? 'Use capital letters, digits and underscores (3-40 characters)' : null)], title: rules.required('Title'), bodyMarkdown: [rules.required('Body'), rules.min(20, 'Body')] }}
      onSubmit={(v) => api.post('/templates', { templateCode: v.templateCode.trim(), title: v.title.trim(), documentType: v.documentType, bodyMarkdown: v.bodyMarkdown })}
      onDone={(res) => { toast.success(res.message); onDone(); }}>
      <FormGrid>
        <TextField {...f('templateCode')} label="Template code" required disabled={!!base} hint="e.g. JOINING_LETTER" />
        <SelectField {...f('documentType')} label="Document type" options={Object.values(DOCUMENT_TYPE).map((t) => ({ value: t, label: humanize(t) }))} />
        <TextField {...f('title')} label="Title" required className="sm:col-span-2" />
        <TextAreaField {...f('bodyMarkdown')} label="Body" required rows={14} className="sm:col-span-2" hint="Use {{variable}} placeholders such as {{candidate.name}} and {{intern.startDate}}." />
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
  const [mode, setMode] = useState('pdf'); // 'pdf' | 'text'

  React.useEffect(() => {
    let active = true;
    let url = null;
    async function fetchPdfBlob() {
      try {
        setLoadingBlob(true);
        const res = await api.get(`/templates/${template._id}/pdf-preview`, { responseType: 'blob' });
        if (!active) return;
        url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        setBlobUrl(url);
      } catch (err) {
        console.warn('PDF preview could not be loaded directly:', err);
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
            <Button
              size="xs"
              variant={mode === 'pdf' ? 'primary' : 'outline'}
              onClick={() => setMode('pdf')}
              data-testid="mode-pdf"
            >
              PDF Document
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
        {(p) => (
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

            {mode === 'pdf' ? (
              blobUrl ? (
                <iframe
                  src={blobUrl}
                  className="w-full h-[520px] rounded-lg border border-slate-200 shadow-inner bg-slate-100"
                  title="PDF Preview"
                  data-testid="template-pdf-frame"
                />
              ) : loadingBlob ? (
                <div className="h-[520px] flex items-center justify-center border border-slate-200 rounded-lg bg-slate-50 text-slate-500 text-sm">
                  Rendering PDF document preview...
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
        )}
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
