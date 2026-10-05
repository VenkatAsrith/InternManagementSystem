import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, UserPlus, Users } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDebounced } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { useForm, rules } from '../../hooks/useForm';
import { useStaffUsers, userLabel } from '../../hooks/useRefData';
import { fmtDate, fullName, humanize } from '../../lib/format';
import { INTERN_STATUS } from '@shared/constants.js';
import { Button, CheckboxField, DataTable, FilterBar, FormGrid, FormModal, PageHeader, Pagination, SelectField, StatusBadge, TextField } from '../../components/ui';

function CreateInternModal({ onClose, onDone }) {
  const toast = useToast();
  const { mentors } = useStaffUsers();
  const [source, setSource] = useState('APPLICATION');
  const form = useForm({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    workMode: 'REMOTE',
    startDate: new Date().toISOString().slice(0, 10),
    expectedEndDate: new Date(Date.now() + 86400000 * 90).toISOString().slice(0, 10),
    referredById: '',
    referralName: '',
    referralEmail: '',
    relationship: 'College Senior / Colleague'
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    const payload = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      workMode: v.workMode,
      startDate: v.startDate,
      expectedEndDate: v.expectedEndDate,
      source
    };
    if (source === 'REFERRAL') {
      payload.referral = {
        referredById: v.referredById || undefined,
        referralName: v.referralName?.trim() || undefined,
        referralEmail: v.referralEmail?.trim() || undefined,
        relationship: v.relationship?.trim() || undefined
      };
    }
    const res = await api.post('/interns', payload);
    return res;
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="lg"
      testId="create-intern-modal"
      title="Create New Intern"
      description="Register an intern into the organization with source tracking and onboarding initiation."
      submitLabel="Create Intern"
      form={form}
      rules={{
        firstName: rules.required('First name'),
        lastName: rules.required('Last name'),
        email: [rules.required('Email'), rules.email('Email')],
        startDate: rules.required('Start date'),
        expectedEndDate: rules.required('Expected end date')
      }}
      onSubmit={handleSubmit}
      onDone={() => {
        toast.success('Intern registered successfully with onboarding flow initiated.');
        onDone();
      }}
    >
      <FormGrid>
        {/* Source Selection Radios */}
        <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Intern Source (§24-§27)
          </label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
              <input
                type="radio"
                name="source"
                value="APPLICATION"
                checked={source === 'APPLICATION'}
                onChange={() => setSource('APPLICATION')}
                className="text-brand-600 focus:ring-brand-500"
                data-testid="source-radio-application"
              />
              Application
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
              <input
                type="radio"
                name="source"
                value="REFERRAL"
                checked={source === 'REFERRAL'}
                onChange={() => setSource('REFERRAL')}
                className="text-brand-600 focus:ring-brand-500"
                data-testid="source-radio-referral"
              />
              Referral
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
              <input
                type="radio"
                name="source"
                value="CAMPUS"
                checked={source === 'CAMPUS'}
                onChange={() => setSource('CAMPUS')}
                className="text-brand-600 focus:ring-brand-500"
              />
              Campus Drive
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
              <input
                type="radio"
                name="source"
                value="WALK_IN"
                checked={source === 'WALK_IN'}
                onChange={() => setSource('WALK_IN')}
                className="text-brand-600 focus:ring-brand-500"
              />
              Walk-in
            </label>
          </div>
        </div>

        {/* Candidate Information */}
        <TextField {...f('firstName')} label="First Name" required placeholder="Aarav" />
        <TextField {...f('lastName')} label="Last Name" required placeholder="Sharma" />
        <TextField {...f('email')} label="Email Address" type="email" required placeholder="aarav.sharma@example.com" className="sm:col-span-2" />
        <TextField {...f('phone')} label="Phone Number" placeholder="+91 98765 43210" className="sm:col-span-2" />

        {/* Referral Specific Inputs */}
        {source === 'REFERRAL' && (
          <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3" data-testid="referral-details-section">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-900">Referral Details (§27)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                {...f('referredById')}
                label="Referred By (Internal Staff)"
                placeholder="Select existing staff/mentor (optional)"
                options={mentors.map((m) => ({ value: m._id, label: userLabel(m) }))}
              />
              <TextField {...f('relationship')} label="Relationship" placeholder="College Senior / Colleague / Former Team" />
              <TextField {...f('referralName')} label="External Referrer Name (if outside IMS)" placeholder="e.g. Ramesh Gupta" />
              <TextField {...f('referralEmail')} label="External Referrer Email" placeholder="e.g. ramesh@partner.org" />
            </div>
          </div>
        )}

        <SelectField
          {...f('workMode')}
          label="Work Mode"
          options={[
            { value: 'REMOTE', label: 'Remote' },
            { value: 'HYBRID', label: 'Hybrid' },
            { value: 'ONSITE', label: 'Onsite' }
          ]}
        />
        <TextField {...f('startDate')} label="Start Date" type="date" required />
        <TextField {...f('expectedEndDate')} label="Expected End Date" type="date" required className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

export function InternsPage() {
  const { can } = useAuth();
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
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
  const filtered = !!(q || status || source || mentorId || unassigned);

  const cols = [
    { key: 'internId', header: 'Intern ID', render: (i) => <Link to={`/admin/interns/${i._id}`} className="font-mono text-xs font-semibold text-brand-800 underline" data-testid={`intern-link-${i.internId}`}>{i.internId}</Link> },
    { key: 'name', header: 'Name', render: (i) => <div><p className="font-medium text-slate-900">{fullName(i.userId)}</p><p className="text-xs text-slate-600">{i.userId?.email}</p></div> },
    {
      key: 'source',
      header: 'Source',
      render: (i) => (
        <div>
          <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded ${
            i.source === 'REFERRAL' ? 'bg-amber-100 text-amber-800' :
            i.source === 'CAMPUS' ? 'bg-purple-100 text-purple-800' :
            'bg-slate-100 text-slate-700'
          }`}>
            {humanize(i.source || 'APPLICATION')}
          </span>
          {i.source === 'REFERRAL' && (i.referral?.referredById || i.referral?.referralName) && (
            <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[130px]" title={i.referral.referredById ? fullName(i.referral.referredById) : i.referral.referralName}>
              via {i.referral.referredById ? fullName(i.referral.referredById) : i.referral.referralName}
            </p>
          )}
        </div>
      )
    },
    { key: 'program', header: 'Program', render: (i) => <div><p>{i.programId?.title}</p><p className="text-xs text-slate-600">{i.departmentId?.name}</p></div> },
    { key: 'mentor', header: 'Mentor', render: (i) => (i.mentorId ? fullName(i.mentorId) : <span className="text-amber-800">Unassigned</span>) },
    { key: 'dates', header: 'Internship', render: (i) => `${fmtDate(i.startDate)} to ${fmtDate(i.expectedEndDate)}` },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> }
  ];

  return (
    <>
      <PageHeader
        title="Interns"
        description="Every internship engagement in your organization. Mentors see only their own mentees."
        actions={
          can('interns.create') && (
            <Button icon={UserPlus} onClick={() => setModal('create')} data-testid="create-intern-btn">
              Create Intern
            </Button>
          )
        }
      />
      <FilterBar>
        <TextField name="search" label="Search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or intern ID" />
        <SelectField name="status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={Object.values(INTERN_STATUS).map((s) => ({ value: s, label: humanize(s) }))} />
        <SelectField
          name="source"
          label="Source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="All sources"
          options={[
            { value: 'APPLICATION', label: 'Application' },
            { value: 'REFERRAL', label: 'Referral' },
            { value: 'CAMPUS', label: 'Campus' },
            { value: 'WALK_IN', label: 'Walk-in' },
            { value: 'OTHER', label: 'Other' }
          ]}
        />
        <SelectField name="mentorId" label="Mentor" value={mentorId} disabled={unassigned} onChange={(e) => setMentorId(e.target.value)} placeholder="All mentors" options={mentors.map((m) => ({ value: m._id, label: userLabel(m) }))} />
        <div className="pb-2"><CheckboxField name="unassigned" label="Without a mentor" checked={unassigned} onChange={(e) => setUnassigned(e.target.checked)} /></div>
      </FilterBar>
      <DataTable testId="interns-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(i) => i.internId} caption="Interns"
        emptyTitle={filtered ? 'No interns match these filters' : 'No interns yet'} emptyDescription={filtered ? 'Clear a filter to see more.' : 'Interns appear here once an offer is accepted.'} />
      <Pagination pagination={list.pagination} onPage={list.setPage} />

      {modal === 'create' && <CreateInternModal onClose={() => setModal(null)} onDone={() => { setModal(null); list.reload(); }} />}
    </>
  );
}

