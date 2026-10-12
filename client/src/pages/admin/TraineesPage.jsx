import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, GraduationCap, AlertTriangle, CheckCircle2, UserCheck, UserPlus, BookOpen,
  Clock, ShieldAlert, Key, Copy, Check, Video, IndianRupee, Layers, Briefcase
} from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { useStaffUsers } from '../../hooks/useRefData';
import { fullName, humanize, fmtDate, todayISO } from '../../lib/format';
import {
  Button, DataTable, FilterBar, FormGrid, FormModal, Modal, PageHeader, SectionCard,
  SelectField, StatCard, StatusBadge, TabPanel, Tabs, TextField, TextAreaField
} from '../../components/ui';

function CreateTraineeModal({ programs, onClose, onDone }) {
  const toast = useToast();
  const { mentors } = useStaffUsers();
  const [enrollMode, setEnrollMode] = useState('NEW'); // 'NEW' | 'EXISTING_INTERN'
  const [source, setSource] = useState('APPLICATION');
  const [compensationType, setCompensationType] = useState('UNPAID');
  const [feeType, setFeeType] = useState('PAID');
  const [hasConcession, setHasConcession] = useState(false);
  const internsFetch = useFetch(() => api.get('/interns', { params: { limit: 100 } }), []);

  const defaultProgram = programs[0];
  const form = useForm({
    internId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    programId: defaultProgram?._id || '',
    institution: '',
    degree: '',
    graduationYear: new Date().getFullYear().toString(),
    location: '',
    workMode: 'REMOTE',
    startDate: new Date().toISOString().slice(0, 10),
    expectedEndDate: new Date(Date.now() + 86400000 * ((defaultProgram?.durationWeeks || 8) * 7)).toISOString().slice(0, 10),
    mentorId: '',
    // Referral fields
    referredById: '',
    referralName: '',
    referralEmail: '',
    relationship: 'College Senior / Colleague',
    referralNotes: '',
    referralDate: new Date().toISOString().slice(0, 10),
    // Candidate Payment / Program Fee fields
    feeAmount: defaultProgram?.grossFee || 10000,
    amountPaid: 0,
    paymentStatus: 'PENDING',
    paymentMethod: 'UPI',
    paymentReference: '',
    paymentNotes: '',
    // Intern Stipend fields
    stipendAmount: 10000,
    currency: 'INR',
    stipendFrequency: 'MONTHLY',
    // Concessions
    concessionType: 'Fee Discount / Scholarship',
    amountOrPercentage: '50%',
    concessionReason: '',
    approvalStatus: 'APPROVED',
    internalRemarks: '',
    internalNotes: ''
  });
  const f = form.field;

  const handleSelectProgram = (e) => {
    const pId = e.target.value;
    form.set('programId', pId);
    const selProg = programs.find((p) => p._id === pId);
    if (selProg) {
      if (selProg.grossFee !== undefined) form.set('feeAmount', selProg.grossFee);
      if (selProg.feeType) setFeeType(selProg.feeType);
      const weeks = selProg.durationWeeks || 8;
      form.set('expectedEndDate', new Date(Date.now() + 86400000 * weeks * 7).toISOString().slice(0, 10));
    }
  };

  const handleSelectIntern = (e) => {
    const selId = e.target.value;
    form.set('internId', selId);
    if (!selId) return;
    const intern = (internsFetch.data || []).find((i) => i._id === selId);
    if (intern) {
      form.set('firstName', intern.userId?.firstName || '');
      form.set('lastName', intern.userId?.lastName || '');
      form.set('email', intern.userId?.email || '');
      form.set('phone', intern.userId?.phone || '');
      form.set('institution', intern.institution || '');
      form.set('degree', intern.degree || '');
      form.set('graduationYear', intern.graduationYear || '');
      form.set('location', intern.location || '');
      form.set('workMode', intern.workMode || 'REMOTE');
      if (intern.mentorId?._id) form.set('mentorId', intern.mentorId._id);
      if (intern.compensation?.type) setCompensationType(intern.compensation.type);
      if (intern.compensation?.amount) form.set('stipendAmount', intern.compensation.amount);
      if (intern.source) setSource(intern.source);
    }
  };

  const remainingFee = feeType === 'FREE' ? 0 : Math.max(0, Number(form.values.feeAmount || 0) - Number(form.values.amountPaid || 0));

  const handleSubmit = async (v) => {
    const payload = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      programId: v.programId,
      internId: enrollMode === 'EXISTING_INTERN' ? v.internId || undefined : undefined,
      institution: v.institution?.trim() || undefined,
      degree: v.degree?.trim() || undefined,
      graduationYear: v.graduationYear?.trim() || undefined,
      location: v.location?.trim() || undefined,
      workMode: v.workMode,
      startDate: v.startDate,
      expectedEndDate: v.expectedEndDate,
      source,
      mentorId: v.mentorId || undefined,
      internalNotes: v.internalNotes?.trim() || undefined,
      // Candidate payment (Fee candidate pays)
      candidatePayment: {
        feeType,
        feeAmount: feeType === 'PAID' ? Number(v.feeAmount || 0) : 0,
        amountPaid: feeType === 'PAID' ? Number(v.amountPaid || 0) : 0,
        paymentStatus: feeType === 'FREE' ? 'PAID' : v.paymentStatus,
        paymentMethod: v.paymentMethod,
        paymentReference: v.paymentReference?.trim() || '',
        paidAt: Number(v.amountPaid) > 0 ? new Date() : undefined,
        notes: v.paymentNotes?.trim() || ''
      },
      // Compensation / Stipend (Company pays intern)
      compensation: {
        type: compensationType,
        amount: compensationType === 'PAID' ? Number(v.stipendAmount || 0) : 0,
        currency: v.currency || 'INR',
        frequency: v.stipendFrequency || 'MONTHLY',
        startDate: v.startDate
      }
    };

    if (source === 'REFERRAL') {
      payload.referral = {
        referredById: v.referredById || undefined,
        referralName: v.referralName?.trim() || undefined,
        referralEmail: v.referralEmail?.trim() || undefined,
        relationship: v.relationship?.trim() || undefined,
        notes: v.referralNotes?.trim() || undefined,
        date: v.referralDate ? new Date(v.referralDate) : new Date()
      };
    }

    if (hasConcession) {
      payload.concession = {
        concessionType: v.concessionType,
        amountOrPercentage: v.amountOrPercentage?.trim(),
        reason: v.concessionReason?.trim(),
        approvalStatus: v.approvalStatus,
        internalRemarks: v.internalRemarks?.trim()
      };
    }

    return await api.post('/training/trainees/create-and-enroll', payload);
  };

  const internOptions = [
    { value: '', label: 'Select an existing intern...' },
    ...((internsFetch.data || []).map((i) => ({
      value: i._id,
      label: `${fullName(i.userId)} (${i.internId} - ${i.userId?.email})`
    })))
  ];

  return (
    <FormModal
      open
      onClose={onClose}
      size="xl"
      testId="create-trainee-modal"
      title="Enroll Intern Trainee"
      description="Enroll candidate into a structured curriculum with complete intern profile, academic records, and candidate payment tracking."
      submitLabel="Enroll & Activate Curriculum"
      form={form}
      rules={{
        firstName: rules.required('First name'),
        lastName: rules.required('Last name'),
        email: rules.email('Email address'),
        programId: rules.required('Program'),
        startDate: rules.required('Start date'),
        expectedEndDate: rules.required('Expected end date'),
        feeAmount: (v) => feeType === 'PAID' ? rules.number('Program fee', { min: 0 })(v) : null,
        amountPaid: rules.number('Amount paid', { min: 0 })
      }}
      onSubmit={handleSubmit}
      onDone={(res) => {
        toast.success('Intern trainee enrolled & curriculum activated!');
        onDone(res?.credentials || res?.data?.credentials);
      }}
    >
      <FormGrid>
        {/* Source Mode Toggle */}
        <div className="sm:col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-indigo-900 mb-2">
            Enrollment Pathway
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-medium ${
                enrollMode === 'NEW' ? 'border-indigo-600 bg-white shadow-xs text-indigo-950 font-semibold' : 'border-slate-200 bg-white/60 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="enrollMode"
                value="NEW"
                checked={enrollMode === 'NEW'}
                onChange={() => setEnrollMode('NEW')}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              New Trainee Candidate
            </label>
            <label
              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-medium ${
                enrollMode === 'EXISTING_INTERN' ? 'border-indigo-600 bg-white shadow-xs text-indigo-950 font-semibold' : 'border-slate-200 bg-white/60 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="enrollMode"
                value="EXISTING_INTERN"
                checked={enrollMode === 'EXISTING_INTERN'}
                onChange={() => setEnrollMode('EXISTING_INTERN')}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              Enroll Existing Intern
            </label>
          </div>
        </div>

        {enrollMode === 'EXISTING_INTERN' && (
          <div className="sm:col-span-2">
            <SelectField
              label="Select Active Intern"
              value={form.values.internId}
              onChange={handleSelectIntern}
              options={internOptions}
              hint="Autofills personal, academic, and compensation details directly from the intern record."
            />
          </div>
        )}

        {/* Section 1: Basic Identity */}
        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">1. Candidate Identity</h4>
        </div>
        <TextField {...f('firstName')} label="First Name" required placeholder="e.g. John" />
        <TextField {...f('lastName')} label="Last Name" required placeholder="e.g. Doe" />
        <TextField {...f('email')} label="Email Address" type="email" required placeholder="john.doe@example.com" />
        <TextField {...f('phone')} label="Phone Number" placeholder="+91 98765 43210" />

        <div className="sm:col-span-2">
          <SelectField
            label="Training Program Curriculum"
            value={form.values.programId}
            onChange={handleSelectProgram}
            required
            options={programs.map((p) => ({ value: p._id, label: `${p.title} (${p.durationWeeks || 8} Wks - ${p.mode || 'ONLINE'} - ${p.feeType === 'FREE' ? 'Free' : '₹' + (p.grossFee || 0)})` }))}
          />
        </div>

        {/* Section 2: Academic Background */}
        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">2. Academic Background</h4>
        </div>
        <TextField {...f('institution')} label="College / University" placeholder="e.g. National Institute of Technology" />
        <TextField {...f('degree')} label="Degree & Branch" placeholder="e.g. B.Tech Computer Science" />
        <TextField {...f('graduationYear')} label="Graduation Year" placeholder="2026" />
        <TextField {...f('location')} label="Location / City" placeholder="e.g. Hyderabad, India" />

        {/* Section 3: Engagement Schedule */}
        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">3. Engagement Schedule & Supervision</h4>
        </div>
        <SelectField
          {...f('workMode')}
          label="Learning Mode"
          options={[
            { value: 'REMOTE', label: 'Remote' },
            { value: 'HYBRID', label: 'Hybrid' },
            { value: 'ON_SITE', label: 'On Site' }
          ]}
        />
        <SelectField
          {...f('mentorId')}
          label="Assigned Trainer / Mentor"
          placeholder="Select mentor/trainer"
          options={mentors.map((m) => ({ value: m._id, label: fullName(m) }))}
        />
        <TextField {...f('startDate')} label="Start Date" type="date" required />
        <TextField {...f('expectedEndDate')} label="Expected End Date" type="date" required />

        {/* Section 4: Source & Referral */}
        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">4. Acquisition Source & Referral</h4>
        </div>
        <div className="sm:col-span-2">
          <SelectField
            label="Acquisition Source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            options={[
              { value: 'APPLICATION', label: 'Job Portal / Application' },
              { value: 'REFERRAL', label: 'Employee / Candidate Referral' },
              { value: 'CAMPUS', label: 'Campus Placement Drive' },
              { value: 'WALK_IN', label: 'Walk-in Candidate' },
              { value: 'PARTNER', label: 'Partner Institution' },
              { value: 'INTERNAL_TRANSFER', label: 'Internal Transfer' },
              { value: 'OTHER', label: 'Other Source' }
            ]}
          />
        </div>
        {source === 'REFERRAL' && (
          <>
            <TextField {...f('referralName')} label="Referred By Name" placeholder="Referrer Name" />
            <TextField {...f('referralEmail')} label="Referrer Email" type="email" placeholder="referrer@company.com" />
            <TextField {...f('relationship')} label="Relationship" placeholder="College Senior / Colleague" />
            <TextField {...f('referralNotes')} label="Referral Notes" placeholder="Special recommendation notes..." />
          </>
        )}

        {/* Section 5: Candidate Payment (Fee candidate pays for training) */}
        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
              5. Candidate Payment (Training Fee Collection)
            </h4>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Fee Inclusion:</label>
              <select
                value={feeType}
                onChange={(e) => setFeeType(e.target.value)}
                className="text-xs font-semibold rounded border border-slate-300 py-1 px-2 text-slate-800 bg-white"
              >
                <option value="PAID">Paid Program</option>
                <option value="FREE">Free Program (Waived)</option>
              </select>
            </div>
          </div>
        </div>
        {feeType === 'PAID' && (
          <>
            <TextField {...f('feeAmount')} label="Program Fee (₹)" type="number" min="0" required placeholder="10000" />
            <TextField {...f('amountPaid')} label="Amount Collected / Paid (₹)" type="number" min="0" placeholder="0" />
            <SelectField
              {...f('paymentStatus')}
              label="Payment Status"
              options={[
                { value: 'PENDING', label: 'Pending (Unpaid)' },
                { value: 'PARTIAL', label: 'Partial Payment' },
                { value: 'PAID', label: 'Paid in Full' },
                { value: 'WAIVED', label: 'Waived / Scholarship' }
              ]}
            />
            <SelectField
              {...f('paymentMethod')}
              label="Payment Method"
              options={[
                { value: 'UPI', label: 'UPI / Google Pay / PhonePe' },
                { value: 'BANK_TRANSFER', label: 'Bank Transfer / NEFT' },
                { value: 'CARD', label: 'Credit / Debit Card' },
                { value: 'CASH', label: 'Cash Receipt' },
                { value: 'OTHER', label: 'Other Mode' }
              ]}
            />
            <TextField {...f('paymentReference')} label="Transaction ID / UTR" placeholder="UTR-2026-987654" />
            <div className="flex flex-col justify-center px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-xs text-emerald-700 font-medium">Outstanding Balance</span>
              <span className="text-base font-bold text-emerald-950">₹{remainingFee.toLocaleString('en-IN')}</span>
            </div>
          </>
        )}

        {/* Section 6: Intern Stipend / Compensation */}
        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              6. Intern Stipend / Allowance (Optional)
            </h4>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Stipend Plan:</label>
              <select
                value={compensationType}
                onChange={(e) => setCompensationType(e.target.value)}
                className="text-xs font-semibold rounded border border-slate-300 py-1 px-2 text-slate-800 bg-white"
              >
                <option value="UNPAID">Unpaid (No stipend)</option>
                <option value="PAID">Paid Stipend</option>
              </select>
            </div>
          </div>
        </div>
        {compensationType === 'PAID' && (
          <>
            <TextField {...f('stipendAmount')} label="Stipend Amount (₹)" type="number" min="0" placeholder="10000" />
            <SelectField
              {...f('stipendFrequency')}
              label="Payment Frequency"
              options={[
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'WEEKLY', label: 'Weekly' },
                { value: 'ONE_TIME', label: 'One Time Completion' }
              ]}
            />
          </>
        )}

        {/* Section 7: Concessions & Special Waivers */}
        <div className="sm:col-span-2 pt-2 border-t border-slate-200">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-800">
            <input
              type="checkbox"
              checked={hasConcession}
              onChange={(e) => setHasConcession(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            Apply Special Concession / Merit Scholarship
          </label>
        </div>

        {hasConcession && (
          <>
            <SelectField
              {...f('concessionType')}
              label="Concession Type"
              options={[
                { value: 'Fee Discount / Scholarship', label: 'Fee Discount / Merit Scholarship' },
                { value: 'Full Fee Waiver', label: 'Full Fee Waiver (100%)' },
                { value: 'Special Deadline Extension', label: 'Special Deadline Extension' },
                { value: 'Financial Aid / Hardship', label: 'Financial Aid / Hardship' },
                { value: 'Other Authorized Arrangement', label: 'Other Authorized Arrangement' }
              ]}
            />
            <TextField {...f('amountOrPercentage')} label="Discount / Concession Value" placeholder="e.g. 50% or ₹15,000" />
            <TextField {...f('concessionReason')} label="Justification / Academic Reason" required placeholder="Academic merit approved by Department Head" className="sm:col-span-2" />
            <SelectField
              {...f('approvalStatus')}
              label="Approval Status"
              options={[
                { value: 'APPROVED', label: 'Approved (Management Authorized)' },
                { value: 'PENDING', label: 'Pending Verification' }
              ]}
            />
            <TextField {...f('internalRemarks')} label="Internal Remarks (Private)" placeholder="Internal tracking notes..." className="sm:col-span-2" />
          </>
        )}

        <TextAreaField {...f('internalNotes')} label="Internal Tracking Notes" rows={2} className="sm:col-span-2" placeholder="Private internal comments..." />
      </FormGrid>
    </FormModal>
  );
}

function CredentialModal({ creds, onClose }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(`Email: ${creds.email}\nTemporary Password: ${creds.temporaryPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal open onClose={onClose} size="md" title="Trainee Credentials Generated">
      <div className="space-y-4">
        <p className="text-xs text-slate-600">
          A welcome email with login instructions has been dispatched to <strong>{creds.email}</strong>.
          You can also copy the temporary password directly below:
        </p>

        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-500">Login Email:</span>
            <span className="font-mono font-bold text-slate-900">{creds.email}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-500">Temporary Password:</span>
            <span className="font-mono font-bold text-brand-700 bg-white px-2 py-1 rounded border border-brand-200">
              {creds.temporaryPassword}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button icon={copied ? Check : Copy} variant="outline" size="sm" onClick={handleCopy}>
            {copied ? 'Copied to Clipboard' : 'Copy Credentials'}
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TrainingProgramModal({ open, onClose, program, onSaved }) {
  const toast = useToast();
  const edit = !!program;
  const form = useForm({
    title: program?.title || '',
    code: program?.code || '',
    duration: program?.duration || '3 Months',
    durationWeeks: program?.durationWeeks ?? 12,
    startDate: program?.startDate ? String(program.startDate).slice(0, 10) : '',
    endDate: program?.endDate ? String(program.endDate).slice(0, 10) : '',
    feeType: program?.feeType || 'PAID',
    grossFee: program?.grossFee ?? 5000,
    amountPaid: program?.amountPaid ?? 0,
    paymentStatus: program?.paymentStatus || 'PENDING',
    trainer: program?.trainer || '',
    description: program?.description || '',
    capacity: program?.capacity ?? 50,
    eligibility: program?.eligibility || '',
    location: program?.location || '',
    mode: program?.mode || 'ONLINE',
    status: program?.status || 'ACTIVE'
  });
  const f = form.field;
  const remaining = form.values.feeType === 'FREE' ? 0 : Math.max(0, Number(form.values.grossFee || 0) - Number(form.values.amountPaid || 0));

  return (
    <FormModal
      open={open}
      onClose={onClose}
      size="lg"
      testId="training-program-modal"
      title={edit ? `Training Details — ${program.title}` : 'New Training Program'}
      submitLabel={edit ? 'Save Training' : 'Create Training'}
      form={form}
      rules={{
        title: [rules.required('Title'), rules.max(150, 'Title')],
        code: [rules.required('Code'), rules.max(50, 'Code')],
        duration: rules.required('Duration'),
        grossFee: (v, a) => a.feeType === 'PAID' ? rules.number('Fee', { min: 0 })(v) : null,
        amountPaid: rules.number('Amount paid', { min: 0 }),
        capacity: rules.number('Capacity', { min: 1, max: 1000 })
      }}
      onSubmit={async (v) => {
        if (v.startDate && v.endDate && new Date(v.endDate) < new Date(v.startDate)) {
          throw new Error('End date cannot be earlier than start date');
        }
        const body = {
          title: v.title.trim(),
          code: v.code.trim().toUpperCase(),
          duration: v.duration.trim(),
          durationWeeks: Number(v.durationWeeks) || 8,
          startDate: v.startDate ? new Date(v.startDate) : undefined,
          endDate: v.endDate ? new Date(v.endDate) : undefined,
          feeType: v.feeType,
          grossFee: v.feeType === 'FREE' ? 0 : Number(v.grossFee || 0),
          amountPaid: Number(v.amountPaid || 0),
          paymentStatus: v.feeType === 'FREE' ? 'PAID' : v.paymentStatus,
          trainer: v.trainer.trim(),
          description: v.description.trim(),
          capacity: Number(v.capacity) || 50,
          eligibility: v.eligibility.trim(),
          location: v.location.trim(),
          mode: v.mode,
          status: v.status
        };
        return edit ? api.patch(`/training/programs/${program._id}`, body) : api.post('/training/programs', body);
      }}
      onDone={() => {
        toast.success(edit ? 'Training program updated' : 'Training program created');
        onSaved();
      }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Program Name" required className="sm:col-span-2" placeholder="Full Stack Development" />
        <TextField {...f('code')} label="Code" required placeholder="FSD-2026" />
        <TextField {...f('duration')} label="Duration (Display)" required placeholder="3 Months" />
        <TextField {...f('durationWeeks')} label="Duration in Weeks" type="number" min="1" max="104" />
        <TextField {...f('trainer')} label="Trainer" placeholder="Lead Instructor" />
        <TextField {...f('startDate')} label="Start Date" type="date" />
        <TextField {...f('endDate')} label="End Date" type="date" />
        <SelectField
          {...f('mode')}
          label="Mode"
          options={[{ value: 'ONLINE', label: 'Online' }, { value: 'OFFLINE', label: 'Offline / In-person' }, { value: 'HYBRID', label: 'Hybrid' }]}
        />
        <SelectField
          {...f('status')}
          label="Program Status"
          options={[{ value: 'UPCOMING', label: 'Upcoming' }, { value: 'ACTIVE', label: 'Active' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'ARCHIVED', label: 'Archived' }]}
        />
        <SelectField
          {...f('feeType')}
          label="Fee Type"
          options={[{ value: 'FREE', label: 'Free' }, { value: 'PAID', label: 'Paid' }]}
        />
        {form.values.feeType === 'PAID' && (
          <>
            <TextField {...f('grossFee')} label="Fee (₹)" type="number" min="0" required />
            <SelectField
              {...f('paymentStatus')}
              label="Payment Status"
              options={[{ value: 'PENDING', label: 'Pending' }, { value: 'PARTIAL', label: 'Partial' }, { value: 'PAID', label: 'Paid' }]}
            />
            <TextField {...f('amountPaid')} label="Amount Paid (₹)" type="number" min="0" />
            <div className="flex flex-col justify-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs text-slate-500 font-medium">Remaining Balance</span>
              <span className="text-base font-semibold text-slate-900">₹{remaining.toLocaleString('en-IN')}</span>
            </div>
          </>
        )}
        <TextField {...f('capacity')} label="Capacity" type="number" min="1" />
        <TextField {...f('location')} label="Location / Venue" placeholder="Online Zoom / Tech Campus" />
        <TextField {...f('eligibility')} label="Eligibility" className="sm:col-span-2" placeholder="Prerequisites or target audience" />
        <TextAreaField {...f('description')} label="Description & Curriculum" rows={3} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

export function TraineesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'programs' ? 'programs' : 'trainees';
  const [tab, setTab] = useState(initialTab);

  const [programId, setProgramId] = useState('');
  const [status, setStatus] = useState('');
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [modal, setModal] = useState(null);
  const [trainingProgramModal, setTrainingProgramModal] = useState(null);
  const [newCreds, setNewCreds] = useState(null);

  const programs = useFetch(() => api.get('/training/trainee/programs'), []);
  const allTrainingPrograms = useFetch(() => api.get('/training/programs'), []);

  const traineesFetch = useFetch(
    () =>
      api.get('/training/trainees', {
        params: {
          programId: programId || undefined,
          status: status || undefined,
          atRisk: atRiskOnly ? 'true' : undefined
        }
      }),
    [programId, status, atRiskOnly]
  );

  const handleTabChange = (t) => {
    setTab(t);
    setSearchParams(t === 'programs' ? { tab: 'programs' } : {});
  };

  const trainees = traineesFetch.data || [];
  const activeCount = trainees.filter((t) => t.status === 'ACTIVE' || t.status === 'ENROLLED').length;
  const completedCount = trainees.filter((t) => t.status === 'COMPLETED').length;
  const atRiskCount = trainees.filter((t) => t.atRisk).length;

  const traineeCols = [
    {
      key: 'name',
      header: 'Trainee',
      render: (t) => (
        <div>
          <Link
            to={`/admin/trainees/${t._id}`}
            className="font-semibold text-slate-900 hover:text-brand-800"
            data-testid={`trainee-link-${t._id}`}
          >
            {fullName(t.userId)}
          </Link>
          <p className="text-xs text-slate-500">{t.userId?.email}</p>
          {t.institution && <p className="text-[11px] text-slate-400 truncate max-w-[180px]">{t.institution}</p>}
        </div>
      )
    },
    {
      key: 'traineeId',
      header: 'ID & Source',
      render: (t) => (
        <div>
          <span className="font-mono text-xs font-semibold text-slate-800 block">
            {t.traineeId || t.internId?.internId || '-'}
          </span>
          <span className="text-[11px] text-slate-500">{humanize(t.source || 'APPLICATION')} &bull; {t.workMode || 'REMOTE'}</span>
        </div>
      )
    },
    {
      key: 'program',
      header: 'Training Program',
      render: (t) => (
        <div>
          <span className="font-medium text-slate-800 block text-xs">{t.programId?.title}</span>
          <span className="text-[11px] text-slate-500">{t.programId?.durationWeeks || 8} Weeks &bull; {t.programId?.mode || 'ONLINE'}</span>
        </div>
      )
    },
    {
      key: 'candidatePayment',
      header: 'Candidate Payment',
      render: (t) => {
        const cp = t.candidatePayment || {};
        const pStatus = cp.paymentStatus || (cp.feeType === 'FREE' ? 'PAID' : 'PENDING');
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-900">
                {cp.feeType === 'FREE' ? 'Free' : `₹${(cp.amountPaid || 0).toLocaleString('en-IN')}`}
              </span>
              <StatusBadge status={pStatus} />
            </div>
            {cp.feeType === 'PAID' && (
              <span className="text-[11px] text-slate-500 block">
                Total: ₹{(cp.feeAmount || 0).toLocaleString('en-IN')}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'progress',
      header: 'Overall Progress',
      render: (t) => {
        const pct = Math.min(100, Math.round(t.overallProgress || 0));
        return (
          <div className="w-28 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-900">{pct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full ${pct >= 100 ? 'bg-emerald-600' : 'bg-brand-600'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      }
    },
    {
      key: 'attendance',
      header: 'Attendance',
      render: (t) => {
        const pct = Math.round(t.attendanceRate ?? t.attendancePercent ?? 100);
        return (
          <span className={`font-semibold text-xs ${pct < 75 ? 'text-rose-600' : 'text-slate-800'}`}>
            {pct}%
          </span>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <StatusBadge status={t.status || 'ENROLLED'} />
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/admin/trainees/${t._id}`)}
          data-testid={`manage-trainee-btn-${t._id}`}
        >
          Manage Trainee
        </Button>
      )
    }
  ];

  const programCols = [
    {
      key: 'title',
      header: 'Training Program',
      render: (p) => (
        <div>
          <p className="font-medium text-slate-900">{p.title}</p>
          <p className="text-xs text-slate-600 font-mono">{p.code} • {p.mode || 'ONLINE'}</p>
        </div>
      )
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (p) => p.duration || `${p.durationWeeks || 8} Weeks`
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (p) => (p.startDate && p.endDate) ? `${fmtDate(p.startDate)} – ${fmtDate(p.endDate)}` : (p.startDate ? fmtDate(p.startDate) : 'Flexible')
    },
    {
      key: 'fees',
      header: 'Fees & Payment Structure',
      render: (p) => (
        <div>
          <span className="font-medium text-slate-900">
            {p.feeType === 'FREE' ? 'Free Program' : `₹${(p.grossFee || 0).toLocaleString('en-IN')}`}
          </span>
          {p.feeType !== 'FREE' && (
            <p className="text-xs text-slate-500">
              Paid: ₹{(p.amountPaid || 0).toLocaleString('en-IN')} | Rem: ₹{Math.max(0, (p.grossFee || 0) - (p.amountPaid || 0)).toLocaleString('en-IN')}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge status={p.status || (p.isActive ? 'ACTIVE' : 'COMPLETED')} />
    },
    {
      key: 'trainer',
      header: 'Lead Trainer',
      render: (p) => p.trainer || 'Unassigned'
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => can('training.manage') && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setTrainingProgramModal(p)} data-testid={`training-edit-${p._id}`}>
            Edit Details
          </Button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Training Programs & Intern Trainees"
        description="Comprehensive training curriculum management, modular milestone tracking, candidate payment collection, and trainee progress."
        actions={
          <div className="flex items-center gap-2">
            {tab === 'trainees' && can('training.manage') && (
              <Button
                variant="primary"
                icon={UserPlus}
                onClick={() => setModal('createTrainee')}
                disabled={(programs.data || []).length === 0}
                data-testid="enroll-trainee-btn"
              >
                Enroll Trainee
              </Button>
            )}
            {can('training.manage') && (
              <Button
                variant={tab === 'programs' ? 'primary' : 'outline'}
                icon={Plus}
                onClick={() => setTrainingProgramModal('new')}
                data-testid="new-training-program-btn"
              >
                New Training Program
              </Button>
            )}
          </div>
        }
      />

      <Tabs
        label="Training navigation"
        active={tab}
        onChange={handleTabChange}
        tabs={[
          { id: 'trainees', label: 'Intern Trainees', count: trainees.length },
          { id: 'programs', label: 'Training Programs', count: allTrainingPrograms.data?.length }
        ]}
      />

      <TabPanel id="trainees" active={tab}>
        {/* KPI Stats (§59) */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="trainee-kpis">
          <StatCard label="Total Trainees" value={trainees.length} />
          <StatCard label="Active Enrolled" value={activeCount} />
          <StatCard label="Programs Completed" value={completedCount} />
          <StatCard
            label="At Risk"
            value={atRiskCount}
            hint={atRiskCount > 0 ? 'Requires mentor attention' : 'All trainees on track'}
          />
        </div>

        <FilterBar>
          <SelectField
            name="programId"
            label="Program"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            placeholder="All programs"
            options={(programs.data || []).map((p) => ({ value: p._id, label: p.title }))}
          />
          <SelectField
            name="status"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="All statuses"
            options={[
              { value: 'ENROLLED', label: 'Enrolled' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'PAUSED', label: 'Paused' },
              { value: 'DROPPED', label: 'Dropped' }
            ]}
          />
          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={atRiskOnly}
                onChange={(e) => setAtRiskOnly(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500"
                data-testid="at-risk-filter-toggle"
              />
              Show At-Risk Only (§60)
            </label>
          </div>
        </FilterBar>

        <SectionCard title="Enrolled Intern Trainees">
          <DataTable
            testId="trainees-table"
            columns={traineeCols}
            rows={trainees}
            loading={traineesFetch.loading}
            error={traineesFetch.error}
            onRetry={traineesFetch.reload}
            caption="Trainees"
            emptyTitle="No trainees found"
            emptyDescription="Interns who enroll in a training program will appear here with automated progress and payment tracking."
          />
        </SectionCard>
      </TabPanel>

      <TabPanel id="programs" active={tab}>
        <SectionCard title="Curriculum Training Programs">
          <DataTable
            testId="training-programs-table"
            columns={programCols}
            rows={allTrainingPrograms.data || []}
            loading={allTrainingPrograms.loading}
            error={allTrainingPrograms.error}
            onRetry={allTrainingPrograms.reload}
            emptyTitle="No training programs yet"
            emptyDescription="Create structured training programs with duration, fees, and syllabus."
            caption="Training programs"
          />
        </SectionCard>
      </TabPanel>

      {modal === 'createTrainee' && (
        <CreateTraineeModal
          programs={programs.data || []}
          onClose={() => setModal(null)}
          onDone={(creds) => {
            setModal(null);
            traineesFetch.reload();
            if (creds) setNewCreds(creds);
          }}
        />
      )}

      {trainingProgramModal && (
        <TrainingProgramModal
          open
          onClose={() => setTrainingProgramModal(null)}
          program={trainingProgramModal === 'new' ? null : trainingProgramModal}
          onSaved={() => {
            setTrainingProgramModal(null);
            allTrainingPrograms.reload({ silent: true });
            programs.reload({ silent: true });
          }}
        />
      )}

      {newCreds && (
        <CredentialModal
          creds={newCreds}
          onClose={() => setNewCreds(null)}
        />
      )}
    </>
  );
}
