import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Users, QrCode, Plus, CheckCircle2, ShieldCheck, Ticket, Paperclip, Award, Trash2, ExternalLink, FileSpreadsheet, RefreshCw, Link2, AlertTriangle, Send, Eye, Download, PhoneCall, Copy, IndianRupee, FileText, Check } from 'lucide-react';
import api, { downloadFile, API_BASE_URL } from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { Button, DetailList, FormGrid, FormModal, Modal, PageHeader, SectionCard, StateView, StatusBadge, Tabs, TabPanel, TextField, InlineAlert, LoadingBlock } from '../../components/ui';
import { PassPreviewModal } from '../../components/domain/PassPreviewModal';
import { SendBootcampPassModal } from '../../components/domain/SendBootcampPassModal';
import { BootcampPreviewModal } from '../../components/domain/BootcampPreviewModal';

function AddSlotModal({ bootcampId, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    slotName: 'Afternoon Track',
    startTime: '02:00 PM',
    endTime: '05:00 PM',
    capacity: 25
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    return await api.post(`/growth/bootcamps/${bootcampId}/slots`, {
      slotName: v.slotName.trim(),
      startTime: v.startTime.trim(),
      endTime: v.endTime.trim(),
      capacity: Number(v.capacity)
    });
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="add-slot-modal"
      title="Add Bootcamp Slot"
      submitLabel="Add Slot"
      form={form}
      rules={{
        slotName: rules.required('Slot Name'),
        startTime: rules.required('Start Time'),
        endTime: rules.required('End Time'),
        capacity: [rules.required('Capacity'), (v) => (Number(v) < 1 ? 'Capacity must be at least 1' : null)]
      }}
      onSubmit={handleSubmit}
      onDone={() => {
        toast.success('Slot added successfully');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('slotName')} label="Slot Name" required placeholder="Evening Cohort" className="sm:col-span-2" />
        <TextField {...f('startTime')} label="Start Time" required placeholder="02:00 PM" />
        <TextField {...f('endTime')} label="End Time" required placeholder="05:00 PM" />
        <TextField {...f('capacity')} label="Slot Capacity" type="number" required min={1} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

function IssuePassModal({ bootcamp, slotId, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ candidateName: '', candidateEmail: '', candidatePhone: '' });
  const f = form.field;

  const handleRegister = async (v) => {
    const res = await api.post(`/growth/bootcamps/${bootcamp._id}/register`, {
      candidateName: v.candidateName.trim(),
      candidateEmail: v.candidateEmail.trim(),
      candidatePhone: v.candidatePhone.trim(),
      slotId: slotId || bootcamp.slots?.[0]?._id
    });
    toast.success(`Pass generated: ${res.data.passCode}`);
    onDone();
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="issue-pass-modal"
      title="Generate Admission Pass"
      description={`Issue authenticated ticket for ${bootcamp.title}.`}
      submitLabel="Generate Pass"
      form={form}
      rules={{
        candidateName: rules.required('Candidate name'),
        candidateEmail: [rules.required('Email'), rules.email('Email')]
      }}
      onSubmit={handleRegister}
      onDone={() => {}}
    >
      <FormGrid>
        <TextField {...f('candidateName')} label="Candidate Full Name" required className="sm:col-span-2" />
        <TextField {...f('candidateEmail')} label="Email Address" type="email" required className="sm:col-span-2" />
        <TextField {...f('candidatePhone')} label="Phone" className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

function CheckInScanModal({ onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ passCode: '' });
  const [errorMsg, setErrorMsg] = useState(null);

  const handleScan = async (v) => {
    setErrorMsg(null);
    try {
      const res = await api.post('/growth/passes/check-in', { passCode: v.passCode.trim() });
      toast.success(`Checked in: ${res.data.candidateName}`);
      onDone();
    } catch (err) {
      setErrorMsg(err.message || 'Check-in failed');
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="scan-checkin-modal"
      title="Scan Entrance Pass"
      submitLabel="Verify Check-in"
      form={form}
      rules={{ passCode: rules.required('Pass Code') }}
      onSubmit={handleScan}
      onDone={() => {}}
    >
      <TextField {...form.field('passCode')} label="Pass Code" required placeholder="TMT-PASS-XXXXXX-XXXX" autoFocus />
      {errorMsg && <InlineAlert tone="error" className="mt-3">{errorMsg}</InlineAlert>}
    </FormModal>
  );
}

function UploadAttachmentModal({ bootcampId, onClose, onDone }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (description.trim()) fd.append('description', description.trim());
      await api.post(`/growth/bootcamps/${bootcampId}/attachments`, fd);
      toast.success('Attachment uploaded successfully');
      onDone();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      testId="upload-attachment-modal"
      title="Add Attachment / Media"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={handleUpload} loading={loading} data-testid="upload-attachment-btn">Upload</Button>
        </div>
      }
    >
      <form onSubmit={handleUpload} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            File (Images, GIFs, Media, PDFs)
          </label>
          <input
            type="file"
            accept="image/*,image/gif,application/pdf"
            onChange={(e) => setFile(e.target.files[0] || null)}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
            data-testid="attachment-file-input"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Description (Optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Schedule Graphic, Promotional GIF"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </form>
    </Modal>
  );
}

function SocialVerificationModal({ pass, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    linkedInUrl: pass?.linkedInUrl || '',
    instagramUrl: pass?.instagramUrl || '',
    status: pass?.socialVerificationStatus || 'NOT_SUBMITTED',
    notes: pass?.socialVerificationNotes || ''
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    if (v.linkedInUrl && !/^https?:\/\/(www\.)?linkedin\.com\/.+/i.test(v.linkedInUrl.trim())) {
      throw new Error('Please enter a valid LinkedIn URL (https://linkedin.com/...)');
    }
    if (v.instagramUrl && !/^https?:\/\/(www\.)?instagram\.com\/.+/i.test(v.instagramUrl.trim())) {
      throw new Error('Please enter a valid Instagram URL (https://instagram.com/...)');
    }
    await api.patch(`/growth/passes/${pass._id}/social-verification`, {
      linkedInUrl: v.linkedInUrl.trim(),
      instagramUrl: v.instagramUrl.trim(),
      status: v.status,
      notes: v.notes.trim()
    });
    toast.success('Social verification updated');
    onDone();
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="social-verification-modal"
      title={`Social Verification — ${pass.candidateName}`}
      submitLabel="Save Verification"
      form={form}
      onSubmit={handleSubmit}
      onDone={() => {}}
    >
      <FormGrid>
        <TextField
          {...f('linkedInUrl')}
          label="LinkedIn Profile URL"
          placeholder="https://linkedin.com/in/username"
          className="sm:col-span-2"
        />
        <TextField
          {...f('instagramUrl')}
          label="Instagram Profile URL"
          placeholder="https://instagram.com/username"
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Verification Status
          </label>
          <select
            value={form.values.status}
            onChange={(e) => form.setValue('status', e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
            data-testid="verification-status-select"
          >
            <option value="NOT_SUBMITTED">Not Submitted</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <TextField
          {...f('notes')}
          label="Verification Notes"
          placeholder="Notes on profile authenticity or review findings"
          className="sm:col-span-2"
        />
      </FormGrid>
    </FormModal>
  );
}

function PassCertificatePreviewModal({ pass, onClose }) {
  const toast = useToast();
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let url = null;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/growth/passes/${pass._id}/certificate?inline=1`, { responseType: 'blob' });
        if (!active) return;

        // Ensure we handle Blob correctly without corrupting via new Blob([undefined])
        const blob = res instanceof Blob
          ? res
          : (res?.data instanceof Blob ? res.data : new Blob([res], { type: 'application/pdf' }));

        if (blob.type === 'application/json' || (blob.type !== 'application/pdf' && blob.size < 500)) {
          const text = await blob.text();
          try {
            const errObj = JSON.parse(text);
            throw new Error(errObj.error?.message || errObj.message || 'Certificate PDF generation failed');
          } catch (e) {
            if (e.message && !e.message.includes('PDF generation failed')) throw e;
          }
        }

        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load certificate preview');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [pass._id]);

  const handleDownload = async () => {
    try {
      await downloadFile(`/growth/passes/${pass._id}/certificate`, `${pass.candidateName.replace(/\s+/g, '_')}_Certificate.pdf`);
      toast.success('Certificate downloaded');
    } catch (e) {
      toast.error(e.message || 'Download failed');
    }
  };

  const handleEmail = async () => {
    try {
      const res = await api.post(`/growth/passes/${pass._id}/send-certificate`);
      toast.success(res.message || `Certificate sent to ${pass.candidateEmail}`);
    } catch (e) {
      toast.error(e.message || 'Failed to send certificate');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Bootcamp Certificate: ${pass.candidateName} (${pass.certificateId || 'TMT'})`}
      testId="pass-cert-preview-modal"
      footer={(
        <div className="flex w-full items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <div className="flex gap-2">
            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open Tab
              </a>
            )}
            <Button variant="outline" size="sm" icon={Send} onClick={handleEmail}>Email to Candidate</Button>
            <Button variant="primary" size="sm" icon={Download} onClick={handleDownload}>Download PDF</Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="min-h-[460px] h-[65vh] w-full rounded-lg bg-slate-900 flex flex-col items-center justify-center overflow-hidden border border-slate-200 relative">
          {loading && <LoadingBlock label="Rendering certificate preview..." />}
          {error && (
            <div className="text-center p-6 space-y-2 bg-slate-50 w-full h-full flex flex-col items-center justify-center">
              <p className="text-sm font-medium text-rose-800">{error}</p>
              <Button size="sm" variant="outline" icon={Download} onClick={handleDownload}>Download PDF</Button>
            </div>
          )}
          {!loading && !error && blobUrl && (
            <object
              data={`${blobUrl}#toolbar=0&navpanes=0`}
              type="application/pdf"
              className="w-full h-full rounded-lg"
            >
              <iframe
                src={`${blobUrl}#toolbar=0`}
                title={`Preview of ${pass.candidateName} Certificate`}
                className="w-full h-full border-0 rounded-lg"
              />
            </object>
          )}
        </div>
      </div>
    </Modal>
  );
}

function BulkCertificatesResultModal({ result, onClose }) {
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      testId="bulk-cert-result-modal"
      title="Certificate Generation Result"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
            <span className="block text-2xl font-bold text-emerald-800">{result.successfulCount}</span>
            <span className="text-xs font-medium text-emerald-600 uppercase">Successful</span>
          </div>
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
            <span className="block text-2xl font-bold text-rose-800">{result.failedCount}</span>
            <span className="text-xs font-medium text-rose-600 uppercase">Failed</span>
          </div>
        </div>

        {result.failed && result.failed.length > 0 && (
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <p className="text-xs font-bold text-slate-700 uppercase">Failures</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {result.failed.map((f, i) => (
                <div key={i} className="rounded border border-rose-100 bg-rose-50/60 p-2 text-xs text-rose-900">
                  <p className="font-semibold">{f.candidateName}</p>
                  <p className="text-slate-600">Reason: {f.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.successful && result.successful.length > 0 && (
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <p className="text-xs font-bold text-slate-700 uppercase">Generated Certificates</p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {result.successful.map((s, i) => (
                <div key={i} className="flex justify-between items-center rounded border border-emerald-100 bg-emerald-50/60 p-2 text-xs text-emerald-900">
                  <span className="font-semibold">{s.candidateName}</span>
                  <span className="font-mono text-[11px]">{s.certificateId}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function GoogleFormsPanel({ bootcamp, onReload }) {
  const toast = useToast();
  const existingConfig = bootcamp.googleForm || {};
  const [formUrl, setFormUrl] = useState(existingConfig.formUrl || '');
  const [sheetUrl, setSheetUrl] = useState(existingConfig.sheetUrl || '');
  const [mapping, setMapping] = useState({
    candidateName: existingConfig.fieldMapping?.fullName || existingConfig.fieldMapping?.candidateName || 'Full Name',
    candidateEmail: existingConfig.fieldMapping?.email || existingConfig.fieldMapping?.candidateEmail || 'Email Address',
    candidatePhone: existingConfig.fieldMapping?.phone || existingConfig.fieldMapping?.candidatePhone || 'Phone Number',
    college: existingConfig.fieldMapping?.college || 'College',
    course: existingConfig.fieldMapping?.course || 'Course',
    resumeUrl: existingConfig.fieldMapping?.resume || existingConfig.fieldMapping?.resumeUrl || 'Resume Link'
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [syncingCsv, setSyncingCsv] = useState(false);

  const handleValidateUrl = () => {
    if (!formUrl.trim()) {
      setValidationResult({ valid: false, message: 'Please enter a Google Form or Spreadsheet URL.' });
      return;
    }
    const match = formUrl.match(/(?:forms\/d\/(?:e\/)?|spreadsheets\/d\/(?:e\/)?)([a-zA-Z0-9_-]+)/);
    if (!match) {
      setValidationResult({ valid: false, message: 'URL does not match a standard Google Form or Google Sheet format.' });
    } else {
      setValidationResult({ valid: true, formId: match[1], message: `Valid Google Docs link detected (ID: ${match[1].slice(0, 10)}...)` });
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!formUrl.trim()) {
      toast.error('Google Form URL is required');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/growth/bootcamps/${bootcamp._id}/google-form`, {
        formUrl: formUrl.trim(),
        sheetUrl: sheetUrl.trim(),
        fieldMapping: mapping
      });
      toast.success('Google Form integration configuration saved');
      onReload();
    } catch (err) {
      toast.error(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncResponses = async () => {
    setSyncing(true);
    try {
      const res = await api.post(`/growth/bootcamps/${bootcamp._id}/google-form/sync`, {});
      toast.success(res.message || 'Google Forms responses synced successfully');
      onReload();
    } catch (err) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncCsv = async (e) => {
    e.preventDefault();
    if (!csvText.trim()) {
      toast.error('Please paste or upload your Google Form responses CSV');
      return;
    }
    setSyncingCsv(true);
    try {
      const res = await api.post(`/growth/bootcamps/${bootcamp._id}/google-form/sync`, {
        csvData: csvText.trim()
      });
      toast.success(res.message || 'CSV responses ingested successfully');
      setCsvModalOpen(false);
      setCsvText('');
      onReload();
    } catch (err) {
      toast.error(err.message || 'Failed to sync CSV');
    } finally {
      setSyncingCsv(false);
    }
  };

  const handleCsvFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target?.result || '');
      toast.success(`Loaded file: ${file.name}`);
    };
    reader.readAsText(file);
  };

  const stats = bootcamp.googleForm?.syncStats || { newResponses: 0, updatedResponses: 0, duplicates: 0, failed: 0 };

  return (
    <div className="space-y-6" data-testid="google-forms-panel">
      {/* Overview & Live Sync Status Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Google Forms Registration Ingestion</h3>
              <p className="text-xs text-slate-500">Collect candidate applications via Google Forms with automated field mapping & pass generation.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={FileText}
              onClick={() => setCsvModalOpen(true)}
              data-testid="import-csv-btn"
            >
              Import / Paste CSV
            </Button>
            <Button
              variant="primary"
              icon={RefreshCw}
              loading={syncing}
              disabled={!bootcamp.googleForm?.formUrl}
              onClick={handleSyncResponses}
              data-testid="sync-google-forms-btn"
            >
              Sync Responses
            </Button>
          </div>
        </div>

        {/* Sync Stats KPIs */}
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">New Responses</span>
            <p className="mt-1 text-2xl font-bold text-emerald-700" data-testid="sync-stat-new">{stats.newResponses || 0}</p>
            <span className="text-[11px] text-slate-400">Newly registered passes</span>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Updated</span>
            <p className="mt-1 text-2xl font-bold text-blue-700" data-testid="sync-stat-updated">{stats.updatedResponses || 0}</p>
            <span className="text-[11px] text-slate-400">Refreshed details</span>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Duplicates</span>
            <p className="mt-1 text-2xl font-bold text-amber-700" data-testid="sync-stat-duplicates">{stats.duplicates || 0}</p>
            <span className="text-[11px] text-slate-400">Existing email / phone matched</span>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Failed / Skipped</span>
            <p className="mt-1 text-2xl font-bold text-rose-700" data-testid="sync-stat-failed">{stats.failed || 0}</p>
            <span className="text-[11px] text-slate-400">Invalid records</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <span>
            Last synced: <strong className="text-slate-700">{bootcamp.googleForm?.lastSyncedAt ? fmtDateTime(bootcamp.googleForm.lastSyncedAt) : 'Never synced'}</strong>
          </span>
          {stats.lastError && (
            <span className="flex items-center gap-1 text-rose-600 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" /> {stats.lastError}
            </span>
          )}
        </div>
      </div>

      {/* Form URL & Field Mapping Configuration */}
      <form onSubmit={handleSaveConfig} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">1. Google Form Connection</h4>
          <p className="text-xs text-slate-500 mt-0.5">Enter the public or edit URL of your Google Form created for this bootcamp cohort.</p>

          <div className="mt-3 flex gap-2">
            <div className="flex-1">
              <input
                type="url"
                value={formUrl}
                onChange={(e) => { setFormUrl(e.target.value); setValidationResult(null); }}
                placeholder="https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                data-testid="google-form-url-input"
              />
            </div>
            <Button type="button" variant="outline" onClick={handleValidateUrl} data-testid="validate-form-url-btn">
              Validate Form
            </Button>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Linked Google Sheet URL (Optional - For Automatic Real-Time Sync)
            </label>
            <input
              type="url"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
              data-testid="google-sheet-url-input"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              In Google Forms, click <strong>Responses &rarr; Link to Sheets</strong>. Set share access to &quot;Anyone with the link can view&quot; to sync live submissions.
            </p>
          </div>

          {validationResult && (
            <div className={`mt-2 text-xs flex items-center gap-1.5 font-medium ${validationResult.valid ? 'text-emerald-700' : 'text-rose-600'}`}>
              {validationResult.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {validationResult.message}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-5">
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">2. Form Field Mapping</h4>
          <p className="text-xs text-slate-500 mt-0.5">Map Google Form question titles to IMS candidate profile fields for automated ingestion.</p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Full Name Field</label>
              <input
                type="text"
                value={mapping.candidateName}
                onChange={(e) => setMapping((m) => ({ ...m, candidateName: e.target.value }))}
                placeholder="Full Name"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                data-testid="mapping-name-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Email Address Field</label>
              <input
                type="text"
                value={mapping.candidateEmail}
                onChange={(e) => setMapping((m) => ({ ...m, candidateEmail: e.target.value }))}
                placeholder="Email Address"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                data-testid="mapping-email-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Phone Number Field</label>
              <input
                type="text"
                value={mapping.candidatePhone}
                onChange={(e) => setMapping((m) => ({ ...m, candidatePhone: e.target.value }))}
                placeholder="Phone Number"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                data-testid="mapping-phone-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">College / University Field</label>
              <input
                type="text"
                value={mapping.college}
                onChange={(e) => setMapping((m) => ({ ...m, college: e.target.value }))}
                placeholder="College"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                data-testid="mapping-college-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Course / Branch Field</label>
              <input
                type="text"
                value={mapping.course}
                onChange={(e) => setMapping((m) => ({ ...m, course: e.target.value }))}
                placeholder="Course"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                data-testid="mapping-course-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Resume Link Field</label>
              <input
                type="text"
                value={mapping.resumeUrl}
                onChange={(e) => setMapping((m) => ({ ...m, resumeUrl: e.target.value }))}
                placeholder="Resume Link"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                data-testid="mapping-resume-input"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button type="submit" variant="primary" loading={saving} data-testid="save-google-form-config-btn">
            Save Form Configuration
          </Button>
        </div>
      </form>

      {/* Modal to Import / Paste CSV directly */}
      {csvModalOpen && (
        <Modal
          open
          onClose={() => setCsvModalOpen(false)}
          size="lg"
          title="Import Google Form Responses (CSV)"
          description="In Google Forms: Responses &rarr; 3 dots &rarr; 'Download responses (.csv)', or copy directly from the linked Google Sheet."
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCsvModalOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={syncingCsv} onClick={handleSyncCsv} data-testid="submit-csv-sync-btn">
                Ingest Responses CSV
              </Button>
            </div>
          )}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Upload CSV File</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileUpload}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Or Paste CSV Content Directly</label>
              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={'Timestamp,Full Name,Email Address,Phone Number,College,Course,Resume Link\n2026-10-22 10:00,John Doe,john@example.com,9876543210,IIT,CSE,https://drive...'}
                className="w-full font-mono text-xs rounded-md border border-slate-300 p-2.5 text-slate-900 focus:border-brand-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Candidate passes will be created using your mapped field names. Existing emails will be updated instead of duplicated.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function BootcampFormBuilderPanel({ bootcamp, onReload }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [isEnabled, setIsEnabled] = useState(bootcamp.customForm?.isEnabled ?? true);
  const [instructions, setInstructions] = useState(bootcamp.customForm?.instructions || 'Please complete the registration form below.');
  const [feeType, setFeeType] = useState(bootcamp.feeType || 'FREE');
  const [feeAmount, setFeeAmount] = useState(bootcamp.feeAmount || 0);
  const [paymentUpiId, setPaymentUpiId] = useState(bootcamp.paymentUpiId || 'techmechatorque@upi');
  const [paymentInstructions, setPaymentInstructions] = useState(bootcamp.paymentInstructions || '');
  const [fields, setFields] = useState(bootcamp.customForm?.fields || [
    { id: 'q1', label: 'Why are you interested in this bootcamp?', fieldType: 'TEXTAREA', required: true, options: [], placeholder: 'Tell us your career goals...' }
  ]);

  const publicUrl = `${window.location.origin}/bootcamp-form/${bootcamp._id}`;

  const copyPublicLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    toast.success('Public form URL copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const addField = () => {
    const newField = {
      id: `q_${Date.now()}`,
      label: 'New Question',
      fieldType: 'TEXT',
      required: false,
      placeholder: '',
      options: ['Option 1', 'Option 2']
    };
    setFields([...fields, newField]);
  };

  const removeField = (index) => {
    setFields(fields.filter((_, idx) => idx !== index));
  };

  const updateField = (index, updates) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...updates };
    setFields(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/growth/bootcamps/${bootcamp._id}/form-builder`, {
        customForm: {
          isEnabled,
          instructions,
          fields
        },
        feeType,
        feeAmount: feeType === 'PAID' ? Number(feeAmount) : 0,
        paymentUpiId,
        paymentInstructions
      });
      toast.success('Form Builder configuration saved successfully');
      onReload();
    } catch (err) {
      toast.error(err.message || 'Failed to save Form Builder settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="bootcamp-form-builder-panel">
      {/* Public Share Card */}
      <div className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-indigo-50 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800">
              <Link2 className="h-3.5 w-3.5" /> Public Registration Link
            </span>
            <h3 className="text-lg font-bold text-slate-900">Share Form with Candidates</h3>
            <p className="text-xs text-slate-600">Candidates can register, select slots, complete payments, and download their admission pass.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={copiedLink ? Check : Copy}
              onClick={copyPublicLink}
              data-testid="copy-form-url-btn"
            >
              {copiedLink ? 'Copied' : 'Copy Public URL'}
            </Button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 shadow-sm"
              data-testid="preview-public-form-btn"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Form
            </a>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-white/80 p-2.5 border border-brand-200/60 font-mono text-xs text-slate-700 truncate">
          {publicUrl}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Fee & Enrollment Settings */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">1. Program Fee & Payment Settings</h4>
          <p className="text-xs text-slate-500">Configure whether this bootcamp requires a candidate registration fee or is free of charge.</p>

          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">Fee Type</label>
              <select
                value={feeType}
                onChange={(e) => setFeeType(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
              >
                <option value="FREE">Free Bootcamp (No Candidate Fee)</option>
                <option value="PAID">Paid Bootcamp (Fee Required)</option>
              </select>
            </div>

            {feeType === 'PAID' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">Fee Amount (₹ INR)</label>
                <input
                  type="number"
                  min="0"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {feeType === 'PAID' && (
            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">UPI ID for Candidate Payment</label>
                <input
                  type="text"
                  value={paymentUpiId}
                  onChange={(e) => setPaymentUpiId(e.target.value)}
                  placeholder="techmechatorque@upi"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">Payment Instructions / Note</label>
                <input
                  type="text"
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  placeholder="e.g. Scan QR code or pay via GPay/PhonePe and paste UTR"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Custom Form Questions */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">2. Form Builder Questions</h4>
              <p className="text-xs text-slate-500">Add custom questions for candidates (Full Name, Email, Phone, and Slot are included by default).</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Plus}
              onClick={addField}
              data-testid="add-form-question-btn"
            >
              Add Question
            </Button>
          </div>

          <div className="space-y-4">
            {fields.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center italic">No custom questions added. Click "Add Question" to build your form.</p>
            ) : (
              fields.map((f, idx) => (
                <div key={f.id || idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Question Title</label>
                        <input
                          type="text"
                          value={f.label}
                          onChange={(e) => updateField(idx, { label: e.target.value })}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Response Type</label>
                        <select
                          value={f.fieldType}
                          onChange={(e) => updateField(idx, { fieldType: e.target.value })}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                        >
                          <option value="TEXT">Short Text</option>
                          <option value="TEXTAREA">Paragraph / Long Text</option>
                          <option value="NUMBER">Number</option>
                          <option value="SELECT">Dropdown Menu</option>
                          <option value="RADIO">Multiple Choice (Radio)</option>
                          <option value="CHECKBOX">Checkboxes</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeField(idx)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                      title="Remove question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {['SELECT', 'RADIO', 'CHECKBOX'].includes(f.fieldType) && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Options (comma separated)</label>
                      <input
                        type="text"
                        value={(f.options || []).join(', ')}
                        onChange={(e) => updateField(idx, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="Option 1, Option 2, Option 3"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => updateField(idx, { required: e.target.checked })}
                        className="h-3.5 w-3.5 rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span>Required field</span>
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            data-testid="save-form-builder-btn"
          >
            Save Form Builder Configuration
          </Button>
        </div>
      </form>
    </div>
  );
}

export function BootcampDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState(null);
  const [selectedPasses, setSelectedPasses] = useState([]);
  const state = useFetch(() => api.get(`/growth/bootcamps/${id}`), [id]);

  return (
    <StateView state={state} loadingLabel="Loading bootcamp details...">
      {(bootcamp) => {
        const slots = bootcamp.slots || [];
        const passes = bootcamp.passes || [];
        const totalBooked = slots.reduce((sum, s) => sum + (s.bookedCount || 0), 0);
        const totalCheckedIn = slots.reduce((sum, s) => sum + (s.checkedInCount || 0), 0);
        const totalCap = bootcamp.totalCapacity || 1;
        const pctBooked = Math.min(100, Math.round((totalBooked / totalCap) * 100));

        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: 'Bootcamps', to: '/admin/bootcamps' }, { label: bootcamp.title }]}
              title={<span data-testid="bootcamp-detail-title">{bootcamp.title}</span>}
              description={bootcamp.description || 'Educational Acquisition Cohort'}
              actions={
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setModal({ type: 'preview' })} data-testid="bootcamp-preview-btn">
                    Preview
                  </Button>
                  <Button variant="primary" icon={Plus} onClick={() => setModal({ type: 'issue' })} data-testid="detail-register-btn">
                    Register Candidate
                  </Button>
                </div>
              }
            />

            {/* Operational Preview Banner */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4" data-testid="bootcamp-operational-preview">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex flex-wrap items-center gap-6 text-sm text-slate-700">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Calendar className="h-4 w-4 text-brand-600" />
                    {fmtDate(bootcamp.date)}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <MapPin className="h-4 w-4 text-brand-600" />
                    {bootcamp.venue || 'Virtual Campus'}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Users className="h-4 w-4 text-brand-600" />
                    {slots.length} Active {slots.length === 1 ? 'Slot' : 'Slots'}
                  </span>
                </div>
                <StatusBadge status={bootcamp.status || 'SCHEDULED'} />
              </div>

              {/* Visual Capacity Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-slate-900">Capacity & Booking Status</span>
                  <span className="font-medium text-slate-700">
                    {totalBooked} / {totalCap} Booked ({pctBooked}%) &bull; <strong className="text-emerald-700">{totalCheckedIn} Attended</strong>
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-300 ${pctBooked >= 100 ? 'bg-amber-500' : 'bg-brand-600'}`}
                    style={{ width: `${pctBooked}%` }}
                    data-testid="capacity-progress-bar"
                  />
                </div>
              </div>
            </div>

            <Tabs
              label="Bootcamp sections"
              active={tab}
              onChange={setTab}
              tabs={[
                { id: 'overview', label: 'Overview' },
                { id: 'slots', label: 'Slots', count: slots.length },
                { id: 'schedule', label: 'Schedule' },
                { id: 'formBuilder', label: 'Form Builder' },
                { id: 'googleForms', label: 'Google Forms' },
                { id: 'passes', label: 'Check-in Passes', count: passes.length }
              ]}
            />

            <TabPanel id="overview" active={tab}>
              <div className="space-y-6">
                <SectionCard title="Cohort Overview & Details">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scheduled Date</p>
                      <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-brand-600" />
                        {fmtDate(bootcamp.date)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Location / Venue</p>
                      <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-brand-600" />
                        {bootcamp.venue || 'Virtual Campus / Zoom'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Capacity & Attendance</p>
                      <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-brand-600" />
                        {totalBooked} / {totalCap} Enrolled ({totalCheckedIn} Attended)
                      </p>
                    </div>
                  </div>
                  {bootcamp.description && (
                    <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-700 space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">About this Bootcamp</p>
                      <p className="leading-relaxed">{bootcamp.description}</p>
                    </div>
                  )}
                </SectionCard>

                {/* Attachments & Media inside Overview */}
                <SectionCard
                  title="Bootcamp Media & Attachments"
                  actions={
                    can('bootcamps.manage') && (
                      <Button size="sm" variant="outline" icon={Plus} onClick={() => setModal({ type: 'uploadAttachment' })} data-testid="add-attachment-btn">
                        Add Attachment
                      </Button>
                    )
                  }
                >
                  {(bootcamp.attachments || []).length === 0 ? (
                    <div className="py-6 text-center text-slate-500 text-xs">
                      <Paperclip className="h-6 w-6 mx-auto mb-1.5 text-slate-400" />
                      <p>No media or files attached yet.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {bootcamp.attachments.map((att) => {
                        const isImageOrGif = att.mimeType?.startsWith('image/');
                        return (
                          <div key={att._id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                            {isImageOrGif && (
                              <div className="h-28 w-full rounded bg-slate-50 overflow-hidden flex items-center justify-center border border-slate-100">
                                <img
                                  src={`${API_BASE_URL}/api/v1/growth/bootcamps/${bootcamp._id}/attachments/${att._id}?inline=1`}
                                  alt={att.originalName}
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                            )}
                            <p className="font-semibold text-slate-900 text-xs truncate" title={att.originalName}>{att.originalName}</p>
                            <div className="flex gap-2 pt-1 border-t border-slate-100">
                              <a
                                href={`${API_BASE_URL}/api/v1/growth/bootcamps/${bootcamp._id}/attachments/${att._id}?inline=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 text-center py-1 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                              >
                                View Media
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              </div>
            </TabPanel>

            <TabPanel id="slots" active={tab}>
              <div className="space-y-6">
                <SectionCard
                  title="Scheduled Time Slots"
                  actions={
                    can('bootcamps.manage') && (
                      <Button size="sm" variant="primary" icon={Plus} onClick={() => setModal({ type: 'addSlot' })} data-testid="add-slot-btn">
                        Add Slot
                      </Button>
                    )
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {slots.map((slot) => {
                      const avail = Math.max(0, slot.capacity - slot.bookedCount);
                      const isFull = slot.bookedCount >= slot.capacity;
                      return (
                        <div key={slot._id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-slate-900">{slot.slotName}</p>
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Clock className="h-3.5 w-3.5" />
                                {slot.startTime} – {slot.endTime}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${isFull ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {isFull ? 'FULL' : `${avail} open`}
                            </span>
                          </div>

                          <div className="space-y-1 text-xs text-slate-600 border-t border-slate-200 pt-2">
                            <div className="flex justify-between">
                              <span>Total Slot Capacity:</span>
                              <strong>{slot.capacity}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Booked Seats:</span>
                              <strong>{slot.bookedCount}</strong>
                            </div>
                            <div className="flex justify-between text-emerald-700">
                              <span>Checked In:</span>
                              <strong>{slot.checkedInCount}</strong>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            disabled={isFull}
                            onClick={() => setModal({ type: 'issue', slotId: slot._id })}
                            data-testid={`slot-book-${slot._id}`}
                          >
                            {isFull ? 'Slot Full' : 'Book Seat in Slot'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              </div>
            </TabPanel>

            <TabPanel id="schedule" active={tab}>
              <div className="space-y-6">
                <SectionCard
                  title="Bootcamp Schedule & Agenda Timeline"
                  actions={
                    can('bootcamps.manage') && (
                      <Button size="sm" variant="outline" icon={Plus} onClick={() => setModal({ type: 'addSlot' })} data-testid="schedule-add-session-btn">
                        Add Session Slot
                      </Button>
                    )
                  }
                >
                  {slots.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-sm">
                      <Clock className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                      <p>No schedule sessions defined yet.</p>
                      <p className="text-xs text-slate-400 mt-1">Add slots to generate the daily bootcamp agenda.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {slots.map((slot, idx) => (
                        <div key={slot._id} className="flex gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-300 transition shadow-xs">
                          <div className="flex flex-col items-center justify-center px-3 py-2 rounded-lg bg-brand-50 border border-brand-100 text-brand-900 min-w-[100px] text-center">
                            <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Session {idx + 1}</span>
                            <span className="font-mono text-sm font-semibold mt-0.5">{slot.startTime}</span>
                            <span className="text-[10px] text-slate-500">to {slot.endTime}</span>
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-slate-900 text-base">{slot.slotName}</h4>
                              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700">
                                {slot.bookedCount} / {slot.capacity} Enrolled
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              Venue: <strong className="text-slate-800">{bootcamp.venue || 'Virtual Campus / Zoom'}</strong> &bull; Date: <strong>{fmtDate(bootcamp.date)}</strong>
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Attendance: <span className="font-semibold text-emerald-700">{slot.checkedInCount} participants checked in</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            </TabPanel>

            <TabPanel id="passes" active={tab}>
              {(() => {
                const checkedInPasses = passes.filter((p) => p.status === 'CHECKED_IN');
                const allCheckedInSelected = checkedInPasses.length > 0 && checkedInPasses.every((p) => selectedPasses.includes(p._id));
                const toggleSelectAll = () => {
                  if (allCheckedInSelected) {
                    setSelectedPasses([]);
                  } else {
                    setSelectedPasses(checkedInPasses.map((p) => p._id));
                  }
                };
                const toggleSelect = (pid) => {
                  setSelectedPasses((prev) => prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]);
                };
                const handleBulkCertificates = async () => {
                  try {
                    const payload = selectedPasses.length > 0 ? { passIds: selectedPasses } : {};
                    const res = await api.post(`/growth/bootcamps/${bootcamp._id}/bulk-certificates`, payload);
                    setModal({ type: 'bulkCertResult', result: res.data });
                    toast.success(res.message || 'Bulk certificates processed');
                    setSelectedPasses([]);
                    state.reload();
                  } catch (err) {
                    toast.error(err.message || 'Failed to generate bulk certificates');
                  }
                };

                const handleBulkSendCertificates = async () => {
                  try {
                    const payload = selectedPasses.length > 0 ? { passIds: selectedPasses } : {};
                    const res = await api.post(`/growth/bootcamps/${bootcamp._id}/bulk-send-certificates`, payload);
                    toast.success(res.message || 'Bulk certificates sent successfully');
                    setSelectedPasses([]);
                    state.reload();
                  } catch (err) {
                    toast.error(err.message || 'Failed to email certificates');
                  }
                };

                return (
                  <SectionCard
                    title="Issued Passes & Check-In History"
                    actions={
                      <div className="flex flex-wrap gap-2">
                        {can('bootcamps.manage') && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              icon={QrCode}
                              onClick={() => setModal({ type: 'checkin' })}
                              data-testid="scan-pass-header-btn"
                            >
                              Scan Pass
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              icon={Plus}
                              onClick={() => setModal({ type: 'issue' })}
                              data-testid="issue-pass-header-btn"
                            >
                              Issue Pass
                            </Button>
                          </>
                        )}
                        {can('certificates.manage') && passes.length > 0 && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              icon={Award}
                              onClick={handleBulkCertificates}
                              data-testid="bulk-generate-certs-btn"
                            >
                              {selectedPasses.length > 0 ? `Generate Certificates (${selectedPasses.length})` : 'Generate All Checked-in Certificates'}
                            </Button>
                            {passes.some(p => p.certificateId) && (
                              <Button
                                size="sm"
                                variant="outline"
                                icon={Send}
                                onClick={handleBulkSendCertificates}
                                data-testid="bulk-send-certs-btn"
                              >
                                {selectedPasses.length > 0 ? `Email Certificates (${selectedPasses.length})` : 'Email All Issued Certificates'}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    }
                  >
                    {passes.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">No passes issued yet for this bootcamp.</p>
                    ) : (
                      <div className="overflow-x-auto space-y-4">
                        {/* Company Header with Logo */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-3">
                            <img
                              src="/letters/tmt-logo.png"
                              alt="TechMecha Torque"
                              className="h-8 w-auto object-contain"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            <div>
                              <p className="font-bold text-slate-900 text-xs sm:text-sm">TechMecha Torque Pvt. Ltd. &bull; Registrant Directory</p>
                              <p className="text-[11px] text-slate-500">Official registry of passes, candidate form responses, and fee tax invoices.</p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-slate-700 border border-slate-200 self-start sm:self-auto">
                            Total Registrants: <strong>{passes.length}</strong>
                          </span>
                        </div>

                        <table className="w-full text-left text-sm" data-testid="passes-table">
                          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                            <tr>
                              <th className="p-3 w-8">
                                <input
                                  type="checkbox"
                                  checked={allCheckedInSelected}
                                  onChange={toggleSelectAll}
                                  title="Select all checked-in participants"
                                  className="rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                                />
                              </th>
                              <th className="p-3">Pass Code</th>
                              <th className="p-3">Candidate</th>
                              <th className="p-3">College & Course</th>
                              <th className="p-3">Fee & Receipt</th>
                              <th className="p-3">Source</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Call Status</th>
                              <th className="p-3">Checked In At</th>
                              <th className="p-3">Social Verification</th>
                              <th className="p-3">Certificate</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {passes.map((p) => (
                              <tr key={p._id} className="hover:bg-slate-50">
                                <td className="p-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedPasses.includes(p._id)}
                                    onChange={() => toggleSelect(p._id)}
                                    disabled={p.status !== 'CHECKED_IN'}
                                    title={p.status !== 'CHECKED_IN' ? 'Only checked-in participants are eligible' : 'Select for certificate'}
                                    className="rounded border-slate-300 text-brand-700 focus:ring-brand-500 disabled:opacity-30"
                                  />
                                </td>
                                <td className="p-3 font-mono font-medium text-slate-900">{p.passCode}</td>
                                <td className="p-3">
                                  <span className="font-medium text-slate-900 block">{p.candidateName}</span>
                                  <span className="text-xs text-slate-500">{p.candidateEmail}</span>
                                  {p.candidatePhone && <span className="text-xs text-slate-400 block">{p.candidatePhone}</span>}
                                  {p.customResponses && Object.keys(p.customResponses).length > 0 && (
                                    <div className="mt-1 pt-1 border-t border-slate-100 text-[11px] text-slate-600 max-w-[220px]">
                                      <span className="font-semibold text-brand-700 block text-[10px] uppercase">Form Responses:</span>
                                      {Object.entries(p.customResponses).map(([k, v]) => (
                                        <span key={k} className="block truncate text-[11px] text-slate-600" title={`${k}: ${Array.isArray(v) ? v.join(', ') : v}`}>
                                          &bull; <strong className="text-slate-700">{k}:</strong> {Array.isArray(v) ? v.join(', ') : String(v)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 text-xs text-slate-600">
                                  {p.college || p.course ? (
                                    <>
                                      <span className="font-medium text-slate-800 block truncate max-w-[150px]" title={p.college}>{p.college || '-'}</span>
                                      <span className="text-slate-500 truncate max-w-[150px] block" title={p.course}>{p.course || '-'}</span>
                                    </>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                  {p.resumeUrl && (
                                    <a href={p.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline inline-flex items-center gap-0.5 mt-0.5 text-[11px]">
                                      Resume <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                  )}
                                </td>
                                <td className="p-3 text-xs">
                                  {p.candidateFee?.feeType === 'PAID' || bootcamp.feeType === 'PAID' ? (
                                    <div className="space-y-1">
                                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                                        Paid: ₹{p.candidateFee?.amountPaid ?? bootcamp.feeAmount ?? 0}
                                      </span>
                                      {p.candidateFee?.paymentReference && (
                                        <span className="text-[10px] text-slate-500 block truncate max-w-[130px]" title={`Ref: ${p.candidateFee.paymentReference}`}>
                                          Ref: {p.candidateFee.paymentReference}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await downloadFile(`/growth/passes/${p._id}/receipt`, `Receipt-${p.passCode}.pdf`);
                                            toast.success('Fee receipt downloaded');
                                          } catch (e) {
                                            toast.error(e.message || 'Download failed');
                                          }
                                        }}
                                        className="text-brand-700 font-semibold hover:underline inline-flex items-center gap-0.5 text-[11px]"
                                        data-testid={`receipt-download-${p.passCode}`}
                                      >
                                        <Download className="h-2.5 w-2.5" /> Receipt PDF
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 text-xs font-medium">Free Pass</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded ${
                                    p.source === 'GOOGLE_FORM' ? 'bg-purple-100 text-purple-800' : p.source === 'FORM_BUILDER' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {p.source === 'GOOGLE_FORM' ? 'Google Form' : p.source === 'FORM_BUILDER' ? 'Public Form' : 'Direct'}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                                    p.status === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-800' :
                                    p.status === 'APPROVED' ? 'bg-teal-100 text-teal-800' :
                                    p.status === 'WAITLISTED' ? 'bg-amber-100 text-amber-800' :
                                    p.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}>
                                    {p.status}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="space-y-1 min-w-[145px]">
                                    <select
                                      value={p.callStatus || 'NOT_CALLED'}
                                      onChange={async (e) => {
                                        const newCallStatus = e.target.value;
                                        try {
                                          await api.patch(`/growth/passes/${p._id}/call-status`, { callStatus: newCallStatus });
                                          toast.success(`Call status updated to ${newCallStatus === 'ANSWERED' ? 'Call Answered' : newCallStatus === 'NOT_ANSWERED' ? 'Call Not Answered' : 'Not Called'}`);
                                          state.reload({ silent: true });
                                        } catch (err) {
                                          toast.error(err.message || 'Failed to update call status');
                                        }
                                      }}
                                      className={`w-full text-xs font-semibold rounded-md border px-2 py-1 focus:outline-none transition-colors ${
                                        p.callStatus === 'ANSWERED'
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                          : p.callStatus === 'NOT_ANSWERED'
                                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                                          : 'bg-slate-50 text-slate-700 border-slate-200'
                                      }`}
                                      data-testid={`call-status-dropdown-${p.passCode}`}
                                    >
                                      <option value="NOT_CALLED">Not Called</option>
                                      <option value="ANSWERED">Call Answered</option>
                                      <option value="NOT_ANSWERED">Call Not Answered</option>
                                    </select>
                                    {p.candidatePhone && (
                                      <a
                                        href={`tel:${p.candidatePhone}`}
                                        className="text-[11px] text-brand-700 hover:underline flex items-center gap-1 font-medium"
                                        title={`Call ${p.candidatePhone}`}
                                      >
                                        <PhoneCall className="h-3 w-3" /> Dial {p.candidatePhone}
                                      </a>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-xs text-slate-500">
                                  {p.checkedInAt ? fmtDateTime(p.checkedInAt) : '-'}
                                </td>
                                <td className="p-3">
                                  <div className="space-y-1.5 min-w-[170px]">
                                    <select
                                      value={p.socialVerificationStatus || 'NOT_SUBMITTED'}
                                      onChange={async (e) => {
                                        const newStatus = e.target.value;
                                        try {
                                          await api.patch(`/growth/passes/${p._id}/social-verification`, { status: newStatus });
                                          toast.success(`Social verification set to ${newStatus}`);
                                          state.reload({ silent: true });
                                        } catch (err) {
                                          toast.error(err.message || 'Failed to update social verification');
                                        }
                                      }}
                                      className={`w-full text-xs font-semibold rounded-md border px-2 py-1 focus:outline-none transition-colors ${
                                        p.socialVerificationStatus === 'VERIFIED'
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                          : p.socialVerificationStatus === 'REJECTED'
                                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                                          : p.socialVerificationStatus === 'UNDER_REVIEW' || p.socialVerificationStatus === 'SUBMITTED'
                                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                                          : 'bg-slate-50 text-slate-700 border-slate-200'
                                      }`}
                                      data-testid={`social-verification-dropdown-${p.passCode}`}
                                    >
                                      <option value="NOT_SUBMITTED">Not Submitted</option>
                                      <option value="SUBMITTED">Submitted</option>
                                      <option value="UNDER_REVIEW">Under Review</option>
                                      <option value="VERIFIED">Verified</option>
                                      <option value="REJECTED">Rejected</option>
                                    </select>

                                    <div className="flex items-center justify-between gap-1 text-[11px]">
                                      <div className="flex items-center gap-1.5">
                                        {p.linkedInUrl ? (
                                          <a
                                            href={p.linkedInUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-0.5 font-medium text-blue-700 hover:underline"
                                            title={p.linkedInUrl}
                                          >
                                            LinkedIn <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        ) : (
                                          <span className="text-slate-400">No LI</span>
                                        )}
                                        <span className="text-slate-300">&bull;</span>
                                        {p.instagramUrl ? (
                                          <a
                                            href={p.instagramUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-0.5 font-medium text-pink-700 hover:underline"
                                            title={p.instagramUrl}
                                          >
                                            Insta <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        ) : (
                                          <span className="text-slate-400">No IG</span>
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => setModal({ type: 'socialVerification', pass: p })}
                                        className="text-[10px] font-semibold text-slate-500 hover:text-brand-700 underline"
                                        title="Edit LinkedIn / Instagram Profile URLs & Review Notes"
                                        data-testid={`edit-socials-${p.passCode}`}
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 text-xs">
                                  {p.certificateId ? (
                                    <div className="space-y-1">
                                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                        <Award className="h-3 w-3" /> {p.certificateId}
                                      </span>
                                      <div className="flex items-center gap-2 text-[11px]">
                                        <button
                                          type="button"
                                          onClick={() => setModal({ type: 'previewCert', pass: p })}
                                          className="text-brand-700 font-medium hover:underline inline-flex items-center gap-0.5"
                                          data-testid={`cert-preview-${p.passCode}`}
                                        >
                                          <Eye className="h-2.5 w-2.5" /> Preview
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              await downloadFile(`/growth/passes/${p._id}/certificate`, `${p.candidateName.replace(/\s+/g, '_')}_Certificate.pdf`);
                                              toast.success('Certificate downloaded');
                                            } catch (e) {
                                              toast.error(e.message || 'Download failed');
                                            }
                                          }}
                                          className="text-slate-600 font-medium hover:underline inline-flex items-center gap-0.5"
                                          data-testid={`cert-download-${p.passCode}`}
                                        >
                                          <Download className="h-2.5 w-2.5" /> PDF
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              const res = await api.post(`/growth/passes/${p._id}/send-certificate`);
                                              toast.success(res.message || `Certificate emailed to ${p.candidateEmail}`);
                                            } catch (e) {
                                              toast.error(e.message || 'Failed to email certificate');
                                            }
                                          }}
                                          className="text-brand-600 font-semibold hover:underline inline-flex items-center gap-0.5"
                                          data-testid={`cert-send-${p.passCode}`}
                                        >
                                          <Send className="h-2.5 w-2.5" /> Email
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">None</span>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex flex-col items-end gap-1.5">
                                    <div className="flex gap-1.5">
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() => setModal({ type: 'previewPass', pass: p })}
                                        data-testid={`preview-pass-${p.passCode}`}
                                      >
                                        Preview
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="primary"
                                        onClick={() => setModal({ type: 'sendPass', pass: p })}
                                        data-testid={`send-pass-${p.passCode}`}
                                      >
                                        Send
                                      </Button>
                                    </div>
                                    {can('bootcamps.manage') && p.status !== 'CHECKED_IN' && (
                                      <div className="flex gap-1 text-[10px]">
                                        {p.status !== 'APPROVED' && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              await api.patch(`/growth/passes/${p._id}/status`, { status: 'APPROVED' });
                                              toast.success('Pass approved');
                                              state.reload();
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold"
                                            data-testid={`approve-pass-${p.passCode}`}
                                          >
                                            Approve
                                          </button>
                                        )}
                                        {p.status !== 'WAITLISTED' && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              await api.patch(`/growth/passes/${p._id}/status`, { status: 'WAITLISTED' });
                                              toast.success('Pass waitlisted');
                                              state.reload();
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold"
                                            data-testid={`waitlist-pass-${p.passCode}`}
                                          >
                                            Waitlist
                                          </button>
                                        )}
                                        {p.status !== 'REJECTED' && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              await api.patch(`/growth/passes/${p._id}/status`, { status: 'REJECTED' });
                                              toast.success('Pass rejected');
                                              state.reload();
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold"
                                            data-testid={`reject-pass-${p.passCode}`}
                                          >
                                            Reject
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </SectionCard>
                );
              })()}
            </TabPanel>

            <TabPanel id="formBuilder" active={tab}>
              <BootcampFormBuilderPanel bootcamp={bootcamp} onReload={state.reload} />
            </TabPanel>

            <TabPanel id="googleForms" active={tab}>
              <GoogleFormsPanel bootcamp={bootcamp} onReload={state.reload} />
            </TabPanel>



            {modal?.type === 'addSlot' && <AddSlotModal bootcampId={bootcamp._id} onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload(); }} />}
            {modal?.type === 'issue' && <IssuePassModal bootcamp={bootcamp} slotId={modal.slotId} onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload(); }} />}
            {modal?.type === 'checkin' && <CheckInScanModal onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload(); }} />}
            {modal?.type === 'uploadAttachment' && <UploadAttachmentModal bootcampId={bootcamp._id} onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload(); }} />}
            {modal?.type === 'socialVerification' && <SocialVerificationModal pass={modal.pass} onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload(); }} />}
            {modal?.type === 'bulkCertResult' && <BulkCertificatesResultModal result={modal.result} onClose={() => setModal(null)} />}
            {modal?.type === 'previewCert' && <PassCertificatePreviewModal pass={modal.pass} onClose={() => setModal(null)} />}
            {modal?.type === 'preview' && (
              <BootcampPreviewModal
                bootcamp={bootcamp}
                onClose={() => setModal(null)}
                onOpenSendPass={(pass) => setModal({ type: 'sendPass', pass })}
              />
            )}
            {modal?.type === 'previewPass' && (
              <PassPreviewModal
                pass={modal.pass}
                onClose={() => setModal(null)}
                onOpenSend={(pass) => setModal({ type: 'sendPass', pass })}
              />
            )}
            {modal?.type === 'sendPass' && (
              <SendBootcampPassModal
                pass={modal.pass}
                bootcamp={bootcamp}
                onClose={() => setModal(null)}
                onDone={() => { setModal(null); state.reload(); }}
              />
            )}
          </>
        );
      }}
    </StateView>
  );
}
