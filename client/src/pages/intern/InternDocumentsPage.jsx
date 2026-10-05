import React, { useState } from 'react';
import { Download, Eye, Trash2, Upload, CheckCircle2, Clock, AlertTriangle, FileCheck, XCircle } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { useForm } from '../../hooks/useForm';
import { fileSize, fmtDateTime, humanize } from '../../lib/format';
import { DOCUMENT_CATEGORY } from '@shared/constants.js';
import { Button, DataTable, FileField, FormModal, Modal, PageHeader, Pagination, SelectField, StatusBadge, useConfirm } from '../../components/ui';
import { DocumentPreviewModal } from '../../components/domain/DocumentPreviewModal';

const MAX = 10 * 1024 * 1024;
const TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv'];

function UploadModal({ onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ type: 'OTHER', file: null });
  return (
    <FormModal open onClose={onClose} size="sm" testId="upload-modal" title="Upload document" submitLabel="Upload" form={form}
      rules={{ file: (f) => (!f ? 'Choose a file' : !TYPES.includes(f.type) ? 'Use PDF, PNG, JPG, WEBP, DOC, DOCX, TXT or CSV' : f.size > MAX ? 'File must be smaller than 10 MB' : null) }}
      onSubmit={async (v) => { const body = new FormData(); body.append('file', v.file); body.append('type', v.type); return api.post('/documents/upload', body); }}
      onDone={() => { toast.success('Document uploaded'); onDone(); }}>
      <SelectField {...form.field('type')} label="Category" options={Object.values(DOCUMENT_CATEGORY).map((t) => ({ value: t, label: humanize(t) }))} />
      <FileField name="file" label="File" required hint="Up to 10 MB." error={form.errors.file} onChange={(e) => form.set('file', e.target.files?.[0] || null)} />
    </FormModal>
  );
}

function UploadRequirementModal({ requirement, onClose, onDone }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/documents/requirements/${requirement._id}/upload`, fd);
      toast.success(`${requirement.title} uploaded successfully`);
      onDone();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="md" testId="upload-req-modal" title={`Upload Required: ${requirement.title}`} footer={
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={handleUpload} loading={loading} data-testid="submit-requirement-file-btn">Upload Document</Button>
      </div>
    }>
      <form onSubmit={handleUpload} className="space-y-4 text-sm">
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        {requirement.instructions && (
          <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
            <strong>Instructions:</strong> {requirement.instructions}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Select Document File (PDF, PNG, JPG, DOC) <span className="text-rose-600">*</span>
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
            data-testid="req-file-input"
          />
        </div>
      </form>
    </Modal>
  );
}

export function InternDocumentsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const list = useList('/documents');
  const myReqs = useFetch(() => api.get('/documents/requirements/my'), []);
  const [open, setOpen] = useState(false);
  const [reqModal, setReqModal] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  const download = async (d) => { try { await downloadFile(`/documents/${d._id}/download`, d.originalName || 'document'); } catch (e) { toast.error(e.message); } };
  const remove = async (d) => {
    if (!(await confirm({ title: 'Remove this document?', message: 'Only documents that are not yet approved can be removed.', confirmLabel: 'Remove', tone: 'danger' }))) return;
    try { await api.delete(`/documents/${d._id}`); toast.success('Document removed'); } catch (e) { toast.error(e.message); }
    list.reload({ silent: true });
  };

  const requirements = myReqs.data || [];
  const requiredCount = requirements.length;
  const approvedCount = requirements.filter((r) => r.status === 'APPROVED').length;

  const cols = [
    { key: 'file', header: 'Document', render: (d) => <div><p className="font-medium text-slate-900">{d.title || d.originalName}</p><p className="text-xs text-slate-600">{d.source === 'GENERATED' ? `Official letter ${d.documentId}` : `${humanize(d.type)} - ${fileSize(d.size)}`}</p></div> },
    { key: 'date', header: 'Date', render: (d) => fmtDateTime(d.createdAt) }, { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> }, { key: 'note', header: 'Note', render: (d) => d.approvalNotes || '-' },
    { key: 'actions', header: '', align: 'right', render: (d) => d.status !== 'REVOKED' && (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" icon={Eye} onClick={() => setPreviewDoc(d)} data-testid={`doc-preview-${d._id}`}>Preview</Button>
        <Button size="sm" variant="ghost" icon={Download} onClick={() => download(d)} data-testid={`doc-download-${d._id}`}>Download</Button>
        {d.source === 'UPLOADED' && ['UPLOADED', 'REJECTED'].includes(d.status) && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(d)} aria-label={`Remove ${d.originalName}`} data-testid={`doc-remove-${d._id}`} />}
      </div>
    ) }
  ];

  return (
    <>
      <PageHeader
        title="Documents"
        description="Official letters issued to you and required onboarding documents."
        actions={<Button icon={Upload} onClick={() => setOpen(true)} data-testid="upload-document">Upload document</Button>}
      />

      {/* Admin-Defined Required Documents Checklist (§38) */}
      {requiredCount > 0 && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4" data-testid="required-documents-section">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-brand-600" />
                Required Onboarding Documents
              </h3>
              <p className="text-xs text-slate-500">Submit these required documents for compliance verification and profile activation.</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {approvedCount} of {requiredCount} Approved
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {requirements.map((r) => {
              const isApproved = r.status === 'APPROVED';
              const isRejected = r.status === 'REJECTED';
              const isPending = ['UPLOADED', 'UNDER_REVIEW'].includes(r.status);

              return (
                <div key={r._id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{r.title}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                        isApproved ? 'bg-emerald-100 text-emerald-800' :
                        isRejected ? 'bg-rose-100 text-rose-800' :
                        isPending ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {isApproved && <CheckCircle2 className="h-3 w-3" />}
                        {isRejected && <XCircle className="h-3 w-3" />}
                        {isPending && <Clock className="h-3 w-3" />}
                        {!isApproved && !isRejected && !isPending && <AlertTriangle className="h-3 w-3" />}
                        {r.status}
                      </span>
                    </div>

                    {r.instructions && <p className="text-xs text-slate-500 mt-1">{r.instructions}</p>}
                    {isRejected && r.rejectionReason && (
                      <p className="text-xs text-rose-600 font-medium mt-1 bg-rose-50 p-1.5 rounded border border-rose-100">
                        Reason: {r.rejectionReason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2 text-xs">
                    {r.sampleFileUrl ? (
                      <a href={r.sampleFileUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                        Download Sample
                      </a>
                    ) : <span className="text-slate-400">Standard format</span>}

                    {!isApproved && (
                      <Button
                        size="xs"
                        variant={isRejected ? 'danger' : 'primary'}
                        onClick={() => setReqModal(r)}
                        data-testid={`upload-req-btn-${r.code}`}
                      >
                        {isRejected ? 'Re-upload' : isPending ? 'Update File' : 'Upload File'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden p-4">
        <h4 className="font-semibold text-slate-900 mb-3 text-sm">All My Documents & Letters</h4>
        <DataTable testId="my-docs-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} caption="My documents" emptyTitle="No documents" emptyDescription="Onboarding documents are uploaded from your onboarding checklist." />
        <Pagination pagination={list.pagination} onPage={list.setPage} />
      </div>

      {open && <UploadModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); list.reload({ silent: true }); }} />}
      {reqModal && <UploadRequirementModal requirement={reqModal} onClose={() => setReqModal(null)} onDone={() => { setReqModal(null); myReqs.reload(); list.reload({ silent: true }); }} />}
      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </>
  );
}

