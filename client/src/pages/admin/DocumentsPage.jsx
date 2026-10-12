import React, { useState } from 'react';
import { Download, Plus, Eye, Send, Upload, CheckCircle2, AlertCircle, FileCheck, Layers, Shield, FileText, Check, X, UserCheck } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { useAction, useForm, rules } from '../../hooks/useForm';
import { fmtDateTime, fullName, humanize } from '../../lib/format';
import { DOCUMENT_CATEGORY, DOCUMENT_STATUS } from '@shared/constants.js';
import { Button, DataTable, FilterBar, FormGrid, FormModal, Modal, PageHeader, Pagination, SelectField, StatusBadge, Tabs, TabPanel, TextAreaField, TextField, useConfirm } from '../../components/ui';
import { DocumentPreviewModal } from '../../components/domain/DocumentPreviewModal';
import { SendDocumentModal } from '../../components/domain/SendDocumentModal';

const LETTERS = [
  ['OFFER_LETTER', 'Offer letter'], ['JOINING_LETTER', 'Joining letter'], ['NDA_AGREEMENT', 'NDA'], ['COMPLETION_LETTER', 'Completion letter'],
  ['EXPERIENCE_LETTER', 'Experience letter'], ['RECOMMENDATION_LETTER', 'Recommendation letter']
];

function UploadModal({ onClose, onDone }) {
  const toast = useToast();
  const interns = useFetch(() => api.get('/interns', { params: { limit: 200 } }), []);
  const projects = useFetch(() => api.get('/projects', { params: { limit: 100 } }), []);
  const [file, setFile] = useState(null);
  const form = useForm({ title: '', type: 'OTHER', description: '', internId: '', projectId: '' });
  const f = form.field;

  const handleSubmit = async (v) => {
    if (!file) throw new Error('Choose a file to upload');
    const fd = new FormData();
    fd.append('file', file);
    if (v.title.trim()) fd.append('title', v.title.trim());
    if (v.type) fd.append('type', v.type);
    if (v.description.trim()) fd.append('description', v.description.trim());
    if (v.internId) fd.append('internId', v.internId);
    if (v.projectId) fd.append('projectId', v.projectId);

    return await api.post('/documents/upload', fd);
  };

  return (
    <FormModal
      open onClose={onClose} size="md" testId="upload-document-modal"
      title="Upload / Import document"
      description="Upload internal documents, agreements, ID proofs, or project assets."
      submitLabel="Upload document"
      form={form}
      rules={{
        title: [rules.required('Document title'), rules.max(150, 'Title')]
      }}
      onSubmit={handleSubmit}
      onDone={() => {
        toast.success('Document uploaded successfully');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Document Title / Name" required className="sm:col-span-2" placeholder="e.g. Master Services Agreement" />
        <SelectField
          {...f('type')}
          label="Category"
          options={Object.values(DOCUMENT_CATEGORY).map((c) => ({ value: c, label: humanize(c) }))}
        />
        <SelectField
          {...f('internId')}
          label="Related Intern (Optional)"
          placeholder="None (Organization / General)"
          options={(interns.data || []).map((i) => ({ value: i._id, label: `${fullName(i.userId)} (${i.internId})` }))}
        />
        <SelectField
          {...f('projectId')}
          label="Related Project (Optional)"
          placeholder="None (Direct / Standalone)"
          options={(projects.data?.projects || projects.data || []).map((p) => ({ value: p._id, label: `${p.title} (${p.code || 'Project'})` }))}
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            File Attachment <span className="text-rose-600">*</span>
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
            data-testid="document-file-input"
            required
          />
          <p className="mt-1 text-xs text-slate-500">Supports PDF, DOC, DOCX, PNG, JPG, WEBP, GIF, CSV, TXT (up to 10MB)</p>
        </div>
        <TextAreaField {...f('description')} label="Description" rows={2} className="sm:col-span-2" placeholder="Context or summary of the document..." />
      </FormGrid>
    </FormModal>
  );
}

function GenerateModal({ onClose, onDone }) {
  const toast = useToast();
  const interns = useFetch(() => api.get('/interns', { params: { limit: 200 } }), []);
  const form = useForm({ internId: '', templateCode: 'JOINING_LETTER', recommendationNote: '' });
  const f = form.field;
  const rec = form.values.templateCode === 'RECOMMENDATION_LETTER';
  return (
    <FormModal open onClose={onClose} size="md" testId="generate-letter-modal" title="Generate letter" description="The letter is rendered from the approved template and the intern's real records. It gets a unique verifiable ID." submitLabel="Generate" form={form}
      rules={{ internId: rules.required('Intern'), recommendationNote: (v, a) => (a.templateCode === 'RECOMMENDATION_LETTER' && String(v).trim().length < 20 ? 'Write at least 20 characters' : null) }}
      onSubmit={(v) => api.post('/documents/generate', { internId: v.internId, templateCode: v.templateCode, ...(rec ? { recommendationNote: v.recommendationNote.trim() } : {}) })}
      onDone={(res) => { toast.success(`Generated ${res.data.documentId}`); onDone(); }}>
      <SelectField {...f('internId')} label="Intern" required placeholder="Select an intern" options={(interns.data || []).map((i) => ({ value: i._id, label: `${fullName(i.userId)} (${i.internId})` }))} />
      <SelectField {...f('templateCode')} label="Letter" options={LETTERS.map(([value, label]) => ({ value, label }))} />
      {rec && <TextAreaField {...f('recommendationNote')} label="Recommendation paragraph" required rows={5} hint="Written by you. Minimum 20 characters." />}
    </FormModal>
  );
}

function RevokeModal({ doc, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ reason: '' });
  return (
    <FormModal open onClose={onClose} size="sm" testId="revoke-doc-modal" title={`Revoke ${doc.documentId}?`} description="Public verification will show it as revoked." submitLabel="Revoke" submitVariant="danger" form={form}
      rules={{ reason: [rules.required('Reason'), rules.min(3, 'Reason')] }} onSubmit={(v) => api.post(`/documents/${doc._id}/revoke`, { reason: v.reason.trim() })} onDone={() => { toast.success('Document revoked'); onDone(); }}>
      <TextAreaField {...form.field('reason')} label="Reason" required rows={2} />
    </FormModal>
  );
}

function CreateRequirementTemplateModal({ onClose, onDone }) {
  const toast = useToast();
  const [name, setName] = useState('Standard Intern Onboarding');
  const [description, setDescription] = useState('Default document requirements for new interns.');
  const [appliesTo, setAppliesTo] = useState('INTERN');
  const [docs, setDocs] = useState([
    { code: 'GOVT_ID', title: 'Aadhaar / ID Proof', isMandatory: true, instructions: 'Clear front & back scan' },
    { code: 'RESUME', title: 'Updated Resume / CV', isMandatory: true, instructions: 'PDF format' },
    { code: 'COLLEGE_ID', title: 'College ID / NOC', isMandatory: true, instructions: 'Proof of student status' },
    { code: 'BANK_DETAILS', title: 'Bank Passbook / Cancelled Cheque', isMandatory: false, instructions: 'For stipend disbursement' }
  ]);
  const [loading, setLoading] = useState(false);

  const addDoc = () => {
    setDocs((prev) => [...prev, { code: `DOC_${Date.now()}`, title: 'Additional Document', isMandatory: false, instructions: '' }]);
  };

  const removeDoc = (idx) => {
    setDocs((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateDoc = (idx, field, val) => {
    setDocs((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: val } : d)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Template name is required');
    if (docs.length === 0) return toast.error('At least one document requirement is needed');
    setLoading(true);
    try {
      await api.post('/documents/requirements/templates', {
        name: name.trim(),
        description: description.trim(),
        appliesTo,
        requiredDocuments: docs
      });
      toast.success('Document template created successfully');
      onDone();
    } catch (err) {
      toast.error(err.message || 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" testId="create-doc-template-modal" title="New Document Requirement Template" footer={
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} loading={loading} data-testid="save-template-btn">Create Template</Button>
      </div>
    }>
      <form onSubmit={handleSave} className="space-y-4 text-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Template Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" data-testid="template-name-input" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Applies To</label>
            <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
              <option value="INTERN">Individual Interns</option>
              <option value="PROGRAM">Training / Internship Programs</option>
              <option value="ALL">All Cohorts (Universal)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Required Documents List</label>
            <Button size="xs" variant="outline" type="button" icon={Plus} onClick={addDoc}>Add Document</Button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {docs.map((doc, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                <input type="text" value={doc.title} onChange={(e) => updateDoc(idx, 'title', e.target.value)} placeholder="Document Title" className="flex-1 rounded border border-slate-300 px-2 py-1 bg-white" />
                <input type="text" value={doc.instructions} onChange={(e) => updateDoc(idx, 'instructions', e.target.value)} placeholder="Instructions" className="flex-1 rounded border border-slate-300 px-2 py-1 bg-white" />
                <label className="flex items-center gap-1 font-medium text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={doc.isMandatory} onChange={(e) => updateDoc(idx, 'isMandatory', e.target.checked)} className="rounded text-brand-600" />
                  Mandatory
                </label>
                <button type="button" onClick={() => removeDoc(idx)} className="text-slate-400 hover:text-rose-600 p-1"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function AssignTemplateModal({ defaultInternId, onClose, onDone }) {
  const toast = useToast();
  const [templateId, setTemplateId] = useState('');
  const [targetType, setTargetType] = useState(defaultInternId ? 'INTERN' : 'ALL_ACTIVE');
  const [targetId, setTargetId] = useState(defaultInternId || '');
  const [targetRole, setTargetRole] = useState('INTERN');
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const templates = useFetch(() => api.get('/documents/requirements/templates'), []);
  const interns = useFetch(() => api.get('/interns', { params: { limit: 200 } }), []);

  const selectedTemplate = (templates.data || []).find(t => t._id === templateId);

  const handleTemplateChange = (id) => {
    setTemplateId(id);
    const tmpl = (templates.data || []).find(t => t._id === id);
    if (tmpl && tmpl.requiredDocuments) {
      setSelectedDocs(tmpl.requiredDocuments.map(d => d.title));
    } else {
      setSelectedDocs([]);
    }
  };

  const toggleDoc = (title) => {
    setSelectedDocs(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  const selectAllDocs = () => {
    if (selectedTemplate?.requiredDocuments) {
      setSelectedDocs(selectedTemplate.requiredDocuments.map(d => d.title));
    }
  };

  const clearAllDocs = () => {
    setSelectedDocs([]);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!templateId) return toast.error('Select a template');
    if (!selectedDocs.length) return toast.error('Please select at least one document requirement to assign');
    setLoading(true);
    try {
      const res = await api.post('/documents/requirements/assign', {
        templateId,
        internId: targetType === 'INTERN' ? targetId : undefined,
        role: targetType === 'ROLE' ? targetRole : undefined,
        documentTitles: selectedDocs
      });
      toast.success(res.message || 'Required documents assigned successfully');
      onDone();
    } catch (err) {
      toast.error(err.message || 'Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      testId="assign-template-modal"
      title="Assign Required Documents"
      description="Select the target role or intern, and choose only the specific documents needed for their compliance."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleAssign}
            loading={loading}
            disabled={!selectedDocs.length}
            data-testid="confirm-assign-btn"
          >
            Assign {selectedDocs.length} Document(s)
          </Button>
        </div>
      }
    >
      <form onSubmit={handleAssign} className="space-y-4 text-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Target Audience</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              data-testid="target-audience-select"
            >
              <option value="ALL_ACTIVE">All Active Interns</option>
              <option value="ROLE">By Specific Role (e.g. Intern, Trainee)</option>
              <option value="INTERN">Specific Intern</option>
            </select>
          </div>

          {targetType === 'ROLE' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Select Role</label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                data-testid="target-role-select"
              >
                <option value="INTERN">Intern</option>
                <option value="TRAINEE">Trainee</option>
                <option value="MENTOR">Mentor</option>
                <option value="TEAM_LEAD">Team Lead</option>
              </select>
            </div>
          )}

          {targetType === 'INTERN' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Select Intern</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                data-testid="select-intern"
              >
                <option value="">-- Select Intern --</option>
                {(interns.data || []).map((i) => (
                  <option key={i._id} value={i._id}>{fullName(i.userId)} ({i.internId})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Select Document Template</label>
          <select
            value={templateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            data-testid="select-template"
          >
            <option value="">-- Choose a template --</option>
            {(templates.data || []).map((t) => (
              <option key={t._id} value={t._id}>{t.name} ({t.requiredDocuments?.length || 0} docs)</option>
            ))}
          </select>
        </div>

        {/* Selective Document Checklist: Assign only what documents we need */}
        {selectedTemplate && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                  Select Documents to Assign ({selectedDocs.length} of {selectedTemplate.requiredDocuments?.length || 0} selected)
                </span>
                <p className="text-xs text-slate-500">Uncheck any documents that are not required for this role or person.</p>
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={selectAllDocs} className="text-blue-600 hover:underline font-medium">Select All</button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={clearAllDocs} className="text-slate-500 hover:underline">Clear</button>
              </div>
            </div>

            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white overflow-hidden max-h-56 overflow-y-auto">
              {(selectedTemplate.requiredDocuments || []).map((doc, idx) => {
                const isChecked = selectedDocs.includes(doc.title);
                return (
                  <label
                    key={idx}
                    className={`flex items-start gap-3 p-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                      isChecked ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleDoc(doc.title)}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{doc.title}</span>
                        {doc.mandatory !== false ? (
                          <span className="rounded bg-rose-50 px-1.5 py-0.2 text-[10px] font-bold text-rose-700">Mandatory</span>
                        ) : (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600">Optional</span>
                        )}
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-500">{humanize(doc.category)}</span>
                      </div>
                      {doc.instructions && (
                        <p className="text-slate-500 text-[11px] mt-0.5">{doc.instructions}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

function InternRequirementsModal({ intern, onClose, onDone }) {
  const toast = useToast();
  const reqs = useFetch(() => api.get(`/documents/requirements/intern/${intern._id}`), [intern._id]);

  const handleReview = async (reqId, status) => {
    let rejectionReason = '';
    if (status === 'REJECTED') {
      rejectionReason = window.prompt('Enter rejection reason for the intern:');
      if (!rejectionReason) return;
    }
    try {
      await api.post(`/documents/requirements/${reqId}/review`, { status, rejectionReason });
      toast.success(`Document marked as ${status}`);
      reqs.reload();
      if (onDone) onDone();
    } catch (err) {
      toast.error(err.message || 'Review action failed');
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" testId="intern-requirements-modal" title={`Document Compliance: ${fullName(intern.userId)} (${intern.internId})`} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="space-y-4 text-sm">
        {reqs.loading ? (
          <p className="text-slate-500 py-4 text-center">Loading requirement checklist...</p>
        ) : (reqs.data || []).length === 0 ? (
          <p className="text-slate-500 py-4 text-center">No requirement checklist assigned to this intern yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {(reqs.data || []).map((r) => (
              <div key={r._id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 bg-white hover:bg-slate-50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{r.title}</span>
                    {r.isMandatory && <span className="text-[10px] uppercase font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">Mandatory</span>}
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                      r.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                      r.status === 'UPLOADED' || r.status === 'UNDER_REVIEW' ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  {r.instructions && <p className="text-xs text-slate-500">{r.instructions}</p>}
                  {r.rejectionReason && <p className="text-xs text-rose-600 font-medium">Rejection reason: {r.rejectionReason}</p>}
                  {r.documentId && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                      <span>File: {r.documentId.originalName || 'Attached'}</span>
                      <a href={`/api/v1/documents/${r.documentId._id}/download`} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline font-medium">
                        Download / View
                      </a>
                    </div>
                  )}
                </div>

                {['UPLOADED', 'UNDER_REVIEW', 'PENDING'].includes(r.status) && (
                  <div className="flex gap-2">
                    <Button size="xs" variant="primary" icon={Check} onClick={() => handleReview(r._id, 'APPROVED')}>Approve</Button>
                    <Button size="xs" variant="outline" tone="danger" icon={X} onClick={() => handleReview(r._id, 'REJECTED')}>Reject</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ComplianceDashboardPanel({ onOpenChecklist }) {
  const comp = useFetch(() => api.get('/documents/requirements/compliance'), []);
  const data = comp.data || { summary: {}, interns: [] };
  const s = data.summary || {};

  return (
    <div className="space-y-6" data-testid="compliance-dashboard-panel">
      {/* Compliance Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Interns</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{s.totalInterns || 0}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Fully Compliant</span>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{s.fullyCompliant || 0}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <span className="text-xs font-medium text-blue-700 uppercase tracking-wider">In Progress</span>
          <p className="mt-1 text-2xl font-bold text-blue-800">{s.inProgress || 0}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">Pending Review</span>
          <p className="mt-1 text-2xl font-bold text-amber-800">{s.pendingReviewCount || 0}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
          <span className="text-xs font-medium text-rose-700 uppercase tracking-wider">Missing Required</span>
          <p className="mt-1 text-2xl font-bold text-rose-800">{s.missingDocsCount || 0}</p>
        </div>
      </div>

      {/* Interns Compliance Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <h3 className="font-semibold text-slate-900">Intern Document Compliance Status (§37)</h3>
          <p className="text-xs text-slate-500">Track required vs uploaded vs approved onboarding credentials across cohorts.</p>
        </div>

        {comp.loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Calculating compliance metrics...</p>
        ) : (data.interns || []).length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No intern compliance records generated yet. Assign a template to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="compliance-table">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="p-3">Intern</th>
                  <th className="p-3">ID</th>
                  <th className="p-3">Required</th>
                  <th className="p-3">Uploaded</th>
                  <th className="p-3">Approved</th>
                  <th className="p-3">Compliance Rate</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.interns || []).map((row) => {
                  const pct = row.totalRequired > 0 ? Math.round((row.approvedCount / row.totalRequired) * 100) : 0;
                  return (
                    <tr key={row.internId} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-900">{row.name}</td>
                      <td className="p-3 font-mono text-xs text-slate-600">{row.internIdCode}</td>
                      <td className="p-3">{row.totalRequired}</td>
                      <td className="p-3">{row.uploadedCount}</td>
                      <td className="p-3 font-semibold text-emerald-700">{row.approvedCount}</td>
                      <td className="p-3">
                        <div className="w-28 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div className={`h-full ${pct === 100 ? 'bg-emerald-600' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Button size="xs" variant="outline" onClick={() => onOpenChecklist({ _id: row.internId, internId: row.internIdCode, userId: { firstName: row.name } })} data-testid={`view-checklist-${row.internIdCode}`}>
                          View Checklist
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RequirementTemplatesPanel({ onCreateTemplate, onAssignTemplate }) {
  const templates = useFetch(() => api.get('/documents/requirements/templates'), []);

  return (
    <div className="space-y-6" data-testid="requirement-templates-panel">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Admin Document Requirement Templates (§31-§35)</h3>
          <p className="text-xs text-slate-500">Define which mandatory identity, academic, and financial documents interns must submit.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={UserCheck} onClick={onAssignTemplate} data-testid="open-assign-template-btn">
            Assign Template
          </Button>
          <Button variant="primary" icon={Plus} onClick={onCreateTemplate} data-testid="open-create-template-btn">
            Create Template
          </Button>
        </div>
      </div>

      {templates.loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading requirement templates...</p>
      ) : (templates.data || []).length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          <FileText className="mx-auto h-8 w-8 text-slate-400 mb-2" />
          <p className="font-medium text-slate-700">No Document Templates Created Yet</p>
          <p className="text-xs text-slate-400 mt-1">Create an onboarding document template and assign it to cohorts.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(templates.data || []).map((tmpl) => (
            <div key={tmpl._id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-900">{tmpl.name}</h4>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">v{tmpl.version || 1}</span>
                </div>
                {tmpl.description && <p className="text-xs text-slate-600 mt-1">{tmpl.description}</p>}
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Requirements ({(tmpl.requiredDocuments || []).length})
                  </span>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {(tmpl.requiredDocuments || []).map((doc, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <CheckCircle2 className={`h-3.5 w-3.5 ${doc.isMandatory ? 'text-rose-500' : 'text-slate-400'}`} />
                        <span>{doc.title}</span>
                        {doc.isMandatory && <span className="text-[9px] font-bold text-rose-600 uppercase">Req</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs text-slate-500">
                <span>Applies: {tmpl.appliesTo}</span>
                <span className="text-emerald-700 font-medium">Active</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DocumentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('generated');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null);
  const gen = useList('/documents', { filters: { source: 'GENERATED', status } });
  const upl = useList('/documents', { filters: { source: 'UPLOADED', status } });
  const act = useAction();
  const active = tab === 'generated' ? gen : upl;
  const refresh = () => { gen.reload({ silent: true }); upl.reload({ silent: true }); };

  const download = async (d) => { try { await downloadFile(`/documents/${d._id}/download`, d.originalName || `${d.documentId}.pdf`); } catch (e) { toast.error(e.message); } };
  const send = (d) => act.run(async () => { try { const res = await api.post(`/documents/${d._id}/send`); toast.success(res.message); refresh(); } catch (e) { toast.error(e.message); } });
  const approve = (d) => act.run(async () => { try { await api.post(`/documents/${d._id}/approve`, {}); toast.success('Document approved'); refresh(); } catch (e) { toast.error(e.message); refresh(); } });
  const reject = (d) => act.run(async () => {
    const reason = await confirm({ title: 'Reject this document?', message: 'The intern sees your reason and can upload a replacement.', requireReason: true, reasonLabel: 'Reason', confirmLabel: 'Reject', tone: 'danger' });
    if (!reason) return;
    try { await api.post(`/documents/${d._id}/reject`, { rejectionReason: reason }); toast.success('Document rejected'); } catch (e) { toast.error(e.message); }
    refresh();
  });

  const who = (d) => (d.internId?.userId ? `${fullName(d.internId.userId)} (${d.internId.internId})` : '-');
  const genCols = [
    { key: 'id', header: 'Document', render: (d) => <div><p className="font-mono text-xs font-semibold text-slate-900" data-testid={`doc-id-${d.documentId}`}>{d.documentId}</p><p className="text-xs text-slate-600">{d.title}</p></div> },
    { key: 'recipient', header: 'Recipient', render: who }, { key: 'version', header: 'Version', render: (d) => `v${d.version}` }, { key: 'created', header: 'Created', render: (d) => fmtDateTime(d.createdAt) },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
    { key: 'actions', header: '', align: 'right', render: (d) => (
      <div className="flex flex-wrap justify-end gap-2">
        {d.status !== 'REVOKED' && (
          <Button size="sm" variant="outline" icon={Eye} onClick={() => setModal({ type: 'preview', d })} data-testid={`doc-preview-${d.documentId}`}>
            Preview
          </Button>
        )}
        {d.status !== 'REVOKED' && <Button size="sm" variant="outline" icon={Download} onClick={() => download(d)} data-testid={`doc-download-${d.documentId}`}>PDF</Button>}
        {can('documents.generate') && !['REVOKED', 'ARCHIVED'].includes(d.status) && (
          <Button size="sm" variant="primary" icon={Send} disabled={act.pending} onClick={() => setModal({ type: 'send', d })} data-testid={`doc-send-${d.documentId}`}>
            Send...
          </Button>
        )}
        {can('documents.generate') && d.status !== 'REVOKED' && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'revoke', d })} data-testid={`doc-revoke-${d.documentId}`}>Revoke</Button>}
      </div>
    ) }
  ];
  const uplCols = [
    { key: 'file', header: 'File', render: (d) => <div><p className="font-medium text-slate-900">{d.originalName}</p><p className="text-xs text-slate-600">{humanize(d.type)} - v{d.version}</p></div> },
    { key: 'owner', header: 'Intern', render: who }, { key: 'created', header: 'Uploaded', render: (d) => fmtDateTime(d.createdAt) },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> }, { key: 'notes', header: 'Notes', render: (d) => d.approvalNotes || '-' },
    { key: 'actions', header: '', align: 'right', render: (d) => (
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" icon={Eye} onClick={() => setModal({ type: 'preview', d })} data-testid={`upload-preview-${d._id}`}>Preview</Button>
        <Button size="sm" variant="ghost" icon={Download} onClick={() => download(d)} data-testid={`upload-download-${d._id}`}>Download</Button>
        {can('documents.approve') && ['UPLOADED', 'UNDER_REVIEW'].includes(d.status) && <><Button size="sm" variant="success" disabled={act.pending} onClick={() => approve(d)} data-testid={`upload-approve-${d._id}`}>Approve</Button><Button size="sm" variant="outline" disabled={act.pending} onClick={() => reject(d)} data-testid={`upload-reject-${d._id}`}>Reject</Button></>}
      </div>
    ) }
  ];

  return (
    <>
      <PageHeader
        title="Letters & documents"
        description="Official letters generated from templates, and documents uploaded by interns or imported by administrators."
        actions={(
          <div className="flex gap-2">
            {can('documents.upload') && (
              <Button variant="outline" icon={Upload} onClick={() => setModal({ type: 'upload' })} data-testid="upload-document">
                Import document
              </Button>
            )}
            {can('documents.generate') && (
              <Button icon={Plus} onClick={() => setModal({ type: 'generate' })} data-testid="generate-letter">
                Generate letter
              </Button>
            )}
          </div>
        )}
      />
      <Tabs
        label="Document types"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'compliance', label: 'Compliance Dashboard' },
          { id: 'templates', label: 'Requirement Templates' },
          { id: 'generated', label: 'Official letters', count: gen.pagination?.total },
          { id: 'uploaded', label: 'Uploaded by interns', count: upl.pagination?.total }
        ]}
      />

      {['generated', 'uploaded'].includes(tab) && (
        <div className="mt-4">
          <FilterBar>
            <SelectField
              name="status"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="All (except archived)"
              options={Object.values(DOCUMENT_STATUS).map((s) => ({ value: s, label: humanize(s) }))}
            />
          </FilterBar>
        </div>
      )}

      <TabPanel id="compliance" active={tab}>
        <ComplianceDashboardPanel onOpenChecklist={(intern) => setModal({ type: 'internChecklist', intern })} />
      </TabPanel>

      <TabPanel id="templates" active={tab}>
        <RequirementTemplatesPanel
          onCreateTemplate={() => setModal({ type: 'createTemplate' })}
          onAssignTemplate={() => setModal({ type: 'assignTemplate' })}
        />
      </TabPanel>

      <TabPanel id="generated" active={tab}>
        <DataTable testId="generated-docs-table" columns={genCols} rows={gen.rows} loading={gen.loading} error={gen.error} onRetry={gen.reload} rowKey={(d) => d.documentId} caption="Official letters" emptyTitle="No letters generated" emptyDescription="Generate a joining, completion or experience letter for an intern." />
        <Pagination pagination={active.pagination} onPage={active.setPage} />
      </TabPanel>

      <TabPanel id="uploaded" active={tab}>
        <DataTable testId="uploaded-docs-table" columns={uplCols} rows={upl.rows} loading={upl.loading} error={upl.error} onRetry={upl.reload} caption="Uploaded documents" emptyTitle="No uploaded documents" emptyDescription="Documents interns upload during onboarding appear here for approval." />
        <Pagination pagination={active.pagination} onPage={active.setPage} />
      </TabPanel>

      {modal?.type === 'upload' && <UploadModal onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal?.type === 'generate' && <GenerateModal onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal?.type === 'preview' && <DocumentPreviewModal doc={modal.d} onClose={() => setModal(null)} onOpenSend={(d) => setModal({ type: 'send', d })} />}
      {modal?.type === 'send' && <SendDocumentModal doc={modal.d} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal?.type === 'revoke' && <RevokeModal doc={modal.d} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal?.type === 'createTemplate' && <CreateRequirementTemplateModal onClose={() => setModal(null)} onDone={() => setModal(null)} />}
      {modal?.type === 'assignTemplate' && <AssignTemplateModal onClose={() => setModal(null)} onDone={() => setModal(null)} />}
      {modal?.type === 'internChecklist' && <InternRequirementsModal intern={modal.intern} onClose={() => setModal(null)} onDone={() => refresh()} />}
    </>
  );
}
