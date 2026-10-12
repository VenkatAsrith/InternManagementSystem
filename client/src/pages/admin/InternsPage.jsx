import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, UserPlus, Users, KeyRound, FolderKanban, FileText, Video,
  CheckCircle2, XCircle, Clock, ExternalLink, RefreshCw, Send, Mail,
  Copy, Check, Shield, Rocket, GraduationCap, AlertCircle, FileCheck
} from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDebounced, useFetch } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { useForm, rules } from '../../hooks/useForm';
import { useStaffUsers, userLabel } from '../../hooks/useRefData';
import { fmtDate, fmtDateTime, fullName, humanize } from '../../lib/format';
import { INTERN_STATUS, ROLES } from '@shared/constants.js';
import {
  Button, CheckboxField, DataTable, FilterBar, FormGrid, FormModal,
  Modal, PageHeader, Pagination, SelectField, StatusBadge, TextField
} from '../../components/ui';
import { DocumentPreviewModal } from '../../components/domain/DocumentPreviewModal';

function CreateInternModal({ onClose, onDone }) {
  const toast = useToast();
  const { mentors } = useStaffUsers();
  const projectsFetch = useFetch(() => api.get('/projects', { params: { limit: 100 } }), []);
  const templatesFetch = useFetch(() => api.get('/documents/requirements/templates'), []);
  const [role, setRole] = useState('INTERN');
  const [source, setSource] = useState('APPLICATION');
  const [compensationType, setCompensationType] = useState('UNPAID');
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const form = useForm({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    institution: '',
    degree: '',
    graduationYear: new Date().getFullYear().toString(),
    location: '',
    projectId: '',
    workMode: 'REMOTE',
    startDate: new Date().toISOString().slice(0, 10),
    expectedEndDate: new Date(Date.now() + 86400000 * 90).toISOString().slice(0, 10),
    referredById: '',
    referralName: '',
    referralEmail: '',
    relationship: 'College Senior / Colleague',
    referralNotes: '',
    referralDate: new Date().toISOString().slice(0, 10),
    stipendAmount: 15000,
    currency: 'INR',
    stipendFrequency: 'MONTHLY',
    stipendStartDate: new Date().toISOString().slice(0, 10),
    documentTemplateId: '',
    internalNotes: ''
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    const payload = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      role,
      institution: v.institution?.trim() || undefined,
      degree: v.degree?.trim() || undefined,
      graduationYear: v.graduationYear?.trim() || undefined,
      location: v.location?.trim() || undefined,
      projectId: v.projectId || undefined,
      workMode: v.workMode,
      startDate: v.startDate,
      expectedEndDate: v.expectedEndDate,
      source,
      compensationType,
      stipendAmount: compensationType === 'PAID' ? Number(v.stipendAmount) || 0 : 0,
      currency: v.currency || 'INR',
      stipendFrequency: v.stipendFrequency || 'MONTHLY',
      stipendStartDate: v.stipendStartDate || v.startDate,
      documentTemplateId: v.documentTemplateId || undefined,
      internalNotes: v.internalNotes?.trim() || undefined
    };
    if (source === 'REFERRAL') {
      payload.referredById = v.referredById || undefined;
      payload.referralName = v.referralName?.trim() || undefined;
      payload.referralEmail = v.referralEmail?.trim() || undefined;
      payload.relationship = v.relationship?.trim() || undefined;
      payload.referralNotes = v.referralNotes?.trim() || undefined;
      payload.referralDate = v.referralDate || undefined;
    }
    const res = await api.post('/interns', payload);
    if (res.data?.tempPassword) {
      setCreatedCredentials({
        name: `${v.firstName} ${v.lastName}`,
        email: v.email,
        password: res.data.tempPassword,
        role
      });
    }
    return res;
  };

  if (createdCredentials) {
    return (
      <Modal
        open
        onClose={() => {
          onDone();
        }}
        size="md"
        title="Account & Credentials Dispatched"
        testId="credentials-success-modal"
        footer={
          <Button variant="primary" onClick={() => onDone()} data-testid="done-credentials-btn">
            Done
          </Button>
        }
      >
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Account Created & Credentials Emailed!</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                A welcome onboarding email with login instructions has been dispatched to <strong>{createdCredentials.email}</strong>.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Participant</p>
              <p className="font-semibold text-slate-900 text-sm mt-0.5">{createdCredentials.name} ({createdCredentials.role})</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Login Email</p>
              <p className="font-mono text-sm text-slate-800 mt-0.5">{createdCredentials.email}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Temporary Password</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="px-2.5 py-1 rounded bg-white border border-slate-300 font-mono font-bold text-sm text-emerald-800">
                  {createdCredentials.password}
                </code>
                <Button
                  size="xs"
                  variant="outline"
                  icon={Copy}
                  onClick={() => {
                    navigator.clipboard.writeText(`Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`);
                    toast.success('Credentials copied to clipboard');
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  const projectOptions = (projectsFetch.data || []).map((p) => ({
    value: p._id,
    label: `${p.name} (${p.code || 'PRJ'})`
  }));

  return (
    <FormModal
      open
      onClose={onClose}
      size="lg"
      testId="create-intern-modal"
      title="Create Intern / Trainee"
      description="Quick registration: Automatically generates user account, assigns onboarding checklist, and emails portal credentials."
      submitLabel="Create & Send Credentials"
      form={form}
      rules={{
        firstName: rules.required('First name'),
        lastName: rules.required('Last name'),
        email: [rules.required('Email'), rules.email('Email')]
      }}
      onSubmit={handleSubmit}
      onDone={(res) => {
        if (!res?.data?.tempPassword) {
          toast.success(res?.message || 'Participant created successfully.');
          onDone();
        }
      }}
    >
      <FormGrid>
        {/* Track Selection */}
        <div className="sm:col-span-2 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-brand-900 mb-2">
            Select Track & Role
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                role === 'INTERN' ? 'border-brand-600 bg-white shadow-xs' : 'border-slate-200 bg-white/60 hover:bg-white'
              }`}
            >
              <input
                type="radio"
                name="role"
                value="INTERN"
                checked={role === 'INTERN'}
                onChange={() => setRole('INTERN')}
                className="mt-0.5 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <p className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4 text-brand-600" /> Intern
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Project contributor, daily tasks, journals & evaluations</p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                role === 'INTERN_TRAINEE' ? 'border-indigo-600 bg-white shadow-xs' : 'border-slate-200 bg-white/60 hover:bg-white'
              }`}
            >
              <input
                type="radio"
                name="role"
                value="INTERN_TRAINEE"
                checked={role === 'INTERN_TRAINEE'}
                onChange={() => setRole('INTERN_TRAINEE')}
                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                  <Rocket className="h-4 w-4 text-indigo-600" /> Intern Trainee
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Curriculum-based modular training, learning tracks & stipend</p>
              </div>
            </label>
          </div>
        </div>

        <TextField {...f('firstName')} label="First Name" required placeholder="Aarav" />
        <TextField {...f('lastName')} label="Last Name" required placeholder="Sharma" />
        <TextField {...f('email')} label="Email Address" required type="email" placeholder="aarav.sharma@example.com" />
        <TextField {...f('phone')} label="Phone Number" placeholder="+91 98765 43210" />

        {/* Academic & College Background */}
        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Academic & Location Details</p>
        </div>
        <TextField {...f('institution')} label="College / University" placeholder="IIT Bombay / Anna University" />
        <TextField {...f('degree')} label="Degree & Branch" placeholder="B.Tech Computer Science" />
        <TextField {...f('graduationYear')} label="Graduation Year" placeholder="2026" />
        <TextField {...f('location')} label="Location / City" placeholder="Bengaluru, Karnataka" />

        {/* Source: Application vs Referral */}
        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Hiring Source
          </label>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label
              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition text-xs font-medium ${
                source === 'APPLICATION' ? 'border-brand-600 bg-brand-50/50 text-brand-900 font-semibold' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="source"
                value="APPLICATION"
                checked={source === 'APPLICATION'}
                onChange={() => setSource('APPLICATION')}
                className="text-brand-600 focus:ring-brand-500"
              />
              Direct Application / Campus
            </label>
            <label
              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition text-xs font-medium ${
                source === 'REFERRAL' ? 'border-brand-600 bg-brand-50/50 text-brand-900 font-semibold' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="source"
                value="REFERRAL"
                checked={source === 'REFERRAL'}
                onChange={() => setSource('REFERRAL')}
                className="text-brand-600 focus:ring-brand-500"
              />
              Employee / Partner Referral
            </label>
          </div>
        </div>

        {source === 'REFERRAL' && (
          <>
            <TextField {...f('referralName')} label="Referrer Name" required placeholder="Dr. Vikram Rao" />
            <TextField {...f('referralEmail')} label="Referrer Email" type="email" placeholder="vikram@techmecha.com" />
            <SelectField
              {...f('relationship')}
              label="Referral Relationship"
              options={[
                { value: 'College Senior / Colleague', label: 'College Senior / Colleague' },
                { value: 'Department Faculty / Professor', label: 'Department Faculty / Professor' },
                { value: 'Internal Employee', label: 'Internal Employee' },
                { value: 'Executive Network', label: 'Executive Network' },
                { value: 'Other', label: 'Other' }
              ]}
            />
            <TextField {...f('referralNotes')} label="Referral Notes" placeholder="Recommended for backend engineering team" />
          </>
        )}

        {/* Compensation & Stipend Model */}
        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Compensation Model
          </label>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label
              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition text-xs font-medium ${
                compensationType === 'UNPAID' ? 'border-slate-800 bg-slate-100 text-slate-900 font-semibold' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="compensationType"
                value="UNPAID"
                checked={compensationType === 'UNPAID'}
                onChange={() => setCompensationType('UNPAID')}
                className="text-slate-800 focus:ring-slate-700"
              />
              Unpaid Internship (Credits)
            </label>
            <label
              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition text-xs font-medium ${
                compensationType === 'PAID' ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="compensationType"
                value="PAID"
                checked={compensationType === 'PAID'}
                onChange={() => setCompensationType('PAID')}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              Paid / Stipend
            </label>
          </div>
        </div>

        {compensationType === 'PAID' && (
          <>
            <TextField {...f('stipendAmount')} label="Stipend Amount (INR)" type="number" required placeholder="15000" />
            <SelectField
              {...f('stipendFrequency')}
              label="Payment Frequency"
              options={[
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'WEEKLY', label: 'Weekly' },
                { value: 'ONE_TIME', label: 'One-Time Stipend' }
              ]}
            />
            <TextField {...f('stipendStartDate')} label="Stipend Start Date" type="date" />
          </>
        )}

        {/* Project & Schedule */}
        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Project & Timeline</p>
        </div>
        <SelectField
          {...f('projectId')}
          label="Assign Project (Optional)"
          placeholder="Select an active project"
          options={projectOptions}
        />
        <SelectField
          {...f('workMode')}
          label="Work Mode"
          options={[
            { value: 'REMOTE', label: 'Remote' },
            { value: 'HYBRID', label: 'Hybrid' },
            { value: 'ON_SITE', label: 'Onsite' }
          ]}
        />
        <TextField {...f('startDate')} label="Start Date" type="date" />
        <TextField {...f('expectedEndDate')} label="Expected End Date" type="date" />

        {/* Document Checklist Template */}
        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
          <SelectField
            {...f('documentTemplateId')}
            label="Onboarding Document Checklist Template"
            options={[
              { value: '', label: 'Standard Essential Checklist (Govt ID, College Proof, NDA)' },
              ...((templatesFetch.data || []).map((t) => ({
                value: t._id,
                label: `${t.name} (${t.requiredDocuments?.length || 0} documents)`
              })))
            ]}
          />
        </div>

        <div className="sm:col-span-2">
          <TextField {...f('internalNotes')} label="Internal Admin Notes (Optional)" placeholder="Additional notes for HR records..." />
        </div>

        <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center gap-2">
          <Mail className="h-4 w-4 text-brand-600 shrink-0" />
          <span>An auto-generated secure password and welcome login link will be emailed to the candidate upon submission.</span>
        </div>
      </FormGrid>
    </FormModal>
  );
}

function ResetPasswordModal({ intern, onClose, onDone }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleReset = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/interns/${intern._id}/reset-password`);
      setResult(res.data);
      toast.success('Password reset successfully and email sent');
    } catch (err) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Reset Intern Password"
      testId="reset-password-modal"
      footer={
        result ? (
          <Button variant="primary" onClick={() => { onDone(); onClose(); }}>
            Close
          </Button>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="danger" loading={loading} onClick={handleReset} data-testid="confirm-reset-pw-btn">
              Reset &amp; Email New Password
            </Button>
          </div>
        )
      }
    >
      {result ? (
        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
            <p className="font-semibold">Password Reset Complete</p>
            <p className="text-xs text-emerald-700 mt-1">
              New credentials were dispatched to <strong>{result.email}</strong>.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <p className="text-xs text-slate-500 uppercase font-semibold">New Temporary Password</p>
            <p className="font-mono text-base font-bold text-slate-900">{result.newPassword}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 py-2 text-sm text-slate-700">
          <p>
            Are you sure you want to reset the password for <strong>{fullName(intern.userId)}</strong> ({intern.userId?.email})?
          </p>
          <p className="text-xs text-slate-500">
            A new random temporary password will be generated, updated on their account, and immediately emailed to them.
          </p>
        </div>
      )}
    </Modal>
  );
}

function AssignProjectModal({ intern, onClose, onDone }) {
  const toast = useToast();
  const projectsFetch = useFetch(() => api.get('/projects', { params: { limit: 100 } }), []);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAssign = async () => {
    if (!selectedProjectId) return toast.error('Please select a project');
    setLoading(true);
    try {
      await api.post(`/interns/${intern._id}/assign-project`, { projectId: selectedProjectId });
      toast.success('Project assigned successfully');
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to assign project');
    } finally {
      setLoading(false);
    }
  };

  const projectOptions = (projectsFetch.data || []).map((p) => ({
    value: p._id,
    label: `${p.name} (${p.code || 'PRJ'})`
  }));

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`Assign Project to ${fullName(intern.userId)}`}
      testId="assign-project-modal"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={loading} onClick={handleAssign} data-testid="confirm-assign-proj-btn">
            Assign Project
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        <SelectField
          label="Select Project"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          placeholder="Choose project"
          options={projectOptions}
          required
        />
        {intern.projects && intern.projects.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">Currently Assigned:</p>
            <div className="flex flex-wrap gap-1.5">
              {intern.projects.map((p) => (
                <span key={p._id} className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-800 border border-slate-200">
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function InternDocumentsModal({ intern, onClose }) {
  const toast = useToast();
  const docsFetch = useFetch(() => api.get(`/interns/${intern._id}/documents`), [intern._id]);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const handleAssignDoc = async (e) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return toast.error('Enter a document title');
    setAddingTask(true);
    try {
      await api.post(`/interns/${intern._id}/assign-document`, { title: newDocTitle.trim() });
      toast.success(`Assigned document task "${newDocTitle.trim()}" to intern`);
      setNewDocTitle('');
      docsFetch.reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Failed to assign document task');
    } finally {
      setAddingTask(false);
    }
  };

  const docs = docsFetch.data || [];

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        title={`Documents & Compliance: ${fullName(intern.userId)}`}
        testId="intern-documents-modal"
        footer={<Button variant="outline" onClick={onClose}>Close</Button>}
      >
        <div className="space-y-6 py-2">
          {/* Quick Assign Document Requirement */}
          <form onSubmit={handleAssignDoc} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Assign Required Document</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Bank Passbook / Degree Certificate / Signed NDA"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                className="flex-1 text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <Button size="sm" variant="primary" loading={addingTask} icon={Plus}>
                Assign Task
              </Button>
            </div>
          </form>

          {/* Uploaded Documents List */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Uploaded Files &amp; Status</h4>
            {docsFetch.loading ? (
              <p className="text-xs text-slate-500 py-4 text-center">Loading documents...</p>
            ) : docs.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center border border-dashed rounded-lg border-slate-200">
                No documents uploaded yet by this intern.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {docs.map((d) => (
                  <div key={d._id} className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 text-xs">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="font-semibold text-slate-900 truncate">{d.title || d.originalName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{humanize(d.type || 'DOCUMENT')} • {fmtDateTime(d.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={d.status || 'UPLOADED'} />
                      <Button
                        size="xs"
                        variant="outline"
                        icon={FileText}
                        onClick={() => setPreviewDoc(d)}
                        data-testid={`preview-doc-${d._id}`}
                      >
                        Preview
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </>
  );
}

function GoogleMeetModal({ intern, onClose }) {
  const toast = useToast();
  const [title, setTitle] = useState(`Sync with ${fullName(intern.userId)}`);
  const [loading, setLoading] = useState(false);
  const [meetData, setMeetData] = useState(null);

  const handleStartMeet = async () => {
    setLoading(true);
    try {
      const res = await api.post('/integrations/google/instant-meet', {
        title: title.trim() || 'Intern Discussion Sync',
        participants: [intern.userId?._id],
        saveAsMeeting: true
      });
      setMeetData(res.data);
      toast.success('Google Meet room created and link dispatched');
    } catch (err) {
      toast.error(err.message || 'Failed to start Google Meet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Start Google Meet"
      testId="intern-gmeet-modal"
      footer={
        meetData ? (
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <a
              href={meetData.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700"
            >
              <Video className="h-4 w-4" /> Join Google Meet
            </a>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <a
              href="https://meet.google.com/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium text-xs hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Instant Meet URL
            </a>
            <Button variant="primary" icon={Video} loading={loading} onClick={handleStartMeet} data-testid="launch-gmeet-btn">
              Create & Invite
            </Button>
          </div>
        )
      }
    >
      {meetData ? (
        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
            <p className="font-semibold">Meeting Room Ready!</p>
            <p className="text-xs text-emerald-700 mt-1">
              Google Meet room has been generated and invitation sent to <strong>{intern.userId?.email}</strong>.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500 uppercase font-semibold">Google Meet Link</p>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="font-mono text-xs text-brand-800 truncate">{meetData.meetLink}</span>
              <Button
                size="xs"
                variant="outline"
                icon={Copy}
                onClick={() => {
                  navigator.clipboard.writeText(meetData.meetLink);
                  toast.success('Link copied');
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Meeting Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center gap-2">
            <Video className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Participant: <strong>{fullName(intern.userId)}</strong> ({intern.userId?.email})</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function InternsPage() {
  const { can } = useAuth();
  const [modal, setModal] = useState(null); // 'create' | { type: 'resetPw', intern } | { type: 'assignProj', intern } | { type: 'docs', intern } | { type: 'gmeet', intern }
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [source, setSource] = useState('');
  const [mentorId, setMentorId] = useState('');
  const [unassigned, setUnassigned] = useState(false);
  const q = useDebounced(search.trim());
  const { mentors } = useStaffUsers();

  const list = useList('/interns', {
    filters: {
      search: q,
      status,
      source,
      mentorId: unassigned ? '' : mentorId,
      unassigned: unassigned ? 'true' : ''
    }
  });

  const filtered = !!(q || status || source || mentorId || unassigned || roleFilter);

  // Filter rows by role if roleFilter is set
  const rows = roleFilter
    ? (list.rows || []).filter((i) => i.userId?.role === roleFilter)
    : (list.rows || []);

  const cols = [
    {
      key: 'internId',
      header: 'Intern ID',
      render: (i) => (
        <Link to={`/admin/interns/${i._id}`} className="font-mono text-xs font-semibold text-brand-800 underline" data-testid={`intern-link-${i.internId}`}>
          {i.internId}
        </Link>
      )
    },
    {
      key: 'name',
      header: 'Name & Role',
      render: (i) => (
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-slate-900">{fullName(i.userId)}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
              i.userId?.role === 'INTERN_TRAINEE' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 text-slate-700'
            }`}>
              {i.userId?.role === 'INTERN_TRAINEE' ? 'Trainee' : 'Intern'}
            </span>
          </div>
          <p className="text-xs text-slate-500">{i.userId?.email}</p>
        </div>
      )
    },
    {
      key: 'projects',
      header: 'Assigned Project',
      render: (i) => (
        <div className="space-y-1">
          {i.projects && i.projects.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {i.projects.map((p) => (
                <span key={p._id} className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {p.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-slate-400">None assigned</span>
          )}
          <button
            type="button"
            onClick={() => setModal({ type: 'assignProj', intern: i })}
            className="text-[11px] text-brand-700 hover:underline block font-medium"
            data-testid={`assign-project-btn-${i.internId}`}
          >
            + Assign Project
          </button>
        </div>
      )
    },
    {
      key: 'documents',
      header: 'Documents',
      render: (i) => {
        const docCount = (i.documents || []).length;
        const approvedCount = (i.documents || []).filter((d) => d.status === 'APPROVED').length;
        return (
          <div className="space-y-1">
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
              docCount > 0 ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-600'
            }`}>
              <FileCheck className="h-3 w-3" />
              {docCount > 0 ? `${approvedCount}/${docCount} Verified` : '0 Uploaded'}
            </span>
            <button
              type="button"
              onClick={() => setModal({ type: 'docs', intern: i })}
              className="text-[11px] text-brand-700 hover:underline block font-medium"
              data-testid={`manage-docs-btn-${i.internId}`}
            >
              Manage &amp; Assign Docs
            </button>
          </div>
        );
      }
    },
    {
      key: 'mentor',
      header: 'Mentor',
      render: (i) => (i.mentorId ? fullName(i.mentorId) : <span className="text-amber-800 text-xs font-medium">Unassigned</span>)
    },
    {
      key: 'status',
      header: 'Status',
      render: (i) => <StatusBadge status={i.status} />
    },
    {
      key: 'actions',
      header: 'Quick Actions',
      render: (i) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="outline"
            icon={KeyRound}
            onClick={() => setModal({ type: 'resetPw', intern: i })}
            data-testid={`reset-pw-btn-${i.internId}`}
            title="Reset Password & Mail Credentials"
          >
            Reset PW
          </Button>
          <Button
            size="xs"
            variant="outline"
            icon={Video}
            onClick={() => setModal({ type: 'gmeet', intern: i })}
            data-testid={`gmeet-btn-${i.internId}`}
            title="Start Google Meet"
          >
            Meet
          </Button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Interns &amp; Trainees"
        description="Comprehensive workspace for managing internships, projects, documents verification, and Google Meet sync."
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={UserPlus}
              onClick={() => setModal('create')}
              data-testid="create-intern-btn"
            >
              Create Intern / Trainee
            </Button>
          </div>
        }
      />

      <FilterBar>
        <TextField
          name="search"
          label="Search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, email or intern ID"
        />
        <SelectField
          name="roleFilter"
          label="Track / Role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          placeholder="All Roles"
          options={[
            { value: 'INTERN', label: 'Interns' },
            { value: 'INTERN_TRAINEE', label: 'Intern Trainees' }
          ]}
        />
        <SelectField
          name="status"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="All statuses"
          options={Object.values(INTERN_STATUS).map((s) => ({ value: s, label: humanize(s) }))}
        />
        <SelectField
          name="mentorId"
          label="Mentor"
          value={mentorId}
          disabled={unassigned}
          onChange={(e) => setMentorId(e.target.value)}
          placeholder="All mentors"
          options={mentors.map((m) => ({ value: m._id, label: userLabel(m) }))}
        />
        <div className="pb-2">
          <CheckboxField
            name="unassigned"
            label="Without a mentor"
            checked={unassigned}
            onChange={(e) => setUnassigned(e.target.checked)}
          />
        </div>
      </FilterBar>

      <DataTable
        testId="interns-table"
        columns={cols}
        rows={rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        rowKey={(i) => i.internId}
        caption="Interns"
        emptyTitle={filtered ? 'No interns match these filters' : 'No interns yet'}
        emptyDescription="Create an intern or recruit candidate to begin."
      />
      <Pagination pagination={list.pagination} onPage={list.setPage} />

      {modal === 'create' && (
        <CreateInternModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            list.reload();
          }}
        />
      )}

      {modal?.type === 'resetPw' && (
        <ResetPasswordModal
          intern={modal.intern}
          onClose={() => setModal(null)}
          onDone={() => list.reload()}
        />
      )}

      {modal?.type === 'assignProj' && (
        <AssignProjectModal
          intern={modal.intern}
          onClose={() => setModal(null)}
          onDone={() => list.reload()}
        />
      )}

      {modal?.type === 'docs' && (
        <InternDocumentsModal
          intern={modal.intern}
          onClose={() => {
            setModal(null);
            list.reload();
          }}
        />
      )}

      {modal?.type === 'gmeet' && (
        <GoogleMeetModal
          intern={modal.intern}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
