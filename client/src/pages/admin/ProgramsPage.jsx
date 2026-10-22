import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { useDepartments, usePrograms } from '../../hooks/useRefData';
import { fmtDate, todayISO, addDaysISO } from '../../lib/format';
import {
  Button, DataTable, FormGrid, FormModal, PageHeader, SelectField, StatusBadge, TabPanel, Tabs, TextAreaField, TextField, useConfirm
} from '../../components/ui';

const WORK_MODES = [{ value: 'REMOTE', label: 'Remote' }, { value: 'HYBRID', label: 'Hybrid' }, { value: 'ON_SITE', label: 'On site' }];
const lines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);

function ProgramModal({ open, onClose, program, departments, onSaved }) {
  const toast = useToast();
  const edit = !!program;
  const form = useForm({
    title: program?.title || '',
    departmentId: program?.departmentId?._id || program?.departmentId || '',
    description: program?.description || '',
    durationDays: program?.durationDays ?? 60,
    attendanceRequirementPercent: program?.attendanceRequirementPercent ?? 85,
    minimumTasksCompleted: program?.completionRequirements?.minimumTasksCompleted ?? 5,
    feeType: program?.feeType || 'FREE',
    feeAmount: program?.feeAmount ?? '',
    feeInclusions: (program?.feeInclusions || []).join(', '),
    feeDescription: program?.feeDescription || ''
  });
  const f = form.field;
  return (
    <FormModal
      open={open}
      onClose={onClose}
      testId="program-modal"
      title={edit ? 'Edit program' : 'New internship program'}
      submitLabel={edit ? 'Save changes' : 'Create program'}
      form={form}
      rules={{
        title: [rules.required('Title'), rules.max(150, 'Title')],
        departmentId: rules.required('Department'),
        durationDays: [rules.required('Duration'), rules.number('Duration', { min: 1, max: 730 })],
        attendanceRequirementPercent: rules.number('Attendance requirement', { min: 0, max: 100 }),
        minimumTasksCompleted: rules.number('Minimum tasks', { min: 0, max: 500 }),
        feeAmount: (v, a) => a.feeType === 'PAID' ? rules.number('Program fee', { min: 0 })(v) : null
      }}
      onSubmit={async (v) => {
        const body = {
          title: v.title.trim(),
          departmentId: v.departmentId,
          description: v.description.trim(),
          durationDays: Number(v.durationDays),
          attendanceRequirementPercent: Number(v.attendanceRequirementPercent),
          feeType: v.feeType,
          feeAmount: v.feeType === 'PAID' ? Number(v.feeAmount || 0) : 0,
          feeInclusions: v.feeInclusions ? v.feeInclusions.split(',').map((s) => s.trim()).filter(Boolean) : [],
          feeDescription: v.feeDescription.trim(),
          completionRequirements: {
            minimumTasksCompleted: Number(v.minimumTasksCompleted),
            minimumAttendancePercent: Number(v.attendanceRequirementPercent)
          }
        };
        return edit ? api.patch(`/recruitment/programs/${program._id}`, body) : api.post('/recruitment/programs', body);
      }}
      onDone={() => { toast.success(edit ? 'Program updated' : 'Program created'); onSaved(); }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Program title" required className="sm:col-span-2" placeholder="e.g. Software Development Track" />
        <SelectField {...f('departmentId')} label="Department" required placeholder="Select a department" options={departments.map((d) => ({ value: d._id, label: d.name }))} />
        <TextField {...f('durationDays')} label="Duration (days)" type="number" min="1" max="730" required />
        <TextField {...f('attendanceRequirementPercent')} label="Attendance required (%)" type="number" min="0" max="100" />
        <TextField {...f('minimumTasksCompleted')} label="Minimum approved tasks" type="number" min="0" hint="Used by the certificate eligibility check." />
        <SelectField
          {...f('feeType')}
          label="Fee Type"
          options={[{ value: 'FREE', label: 'Free Program' }, { value: 'PAID', label: 'Paid Program' }]}
        />
        {form.values.feeType === 'PAID' && (
          <>
            <TextField {...f('feeAmount')} label="Program Fee (₹)" type="number" min="0" required placeholder="10000" />
            <TextField {...f('feeInclusions')} label="Fee Inclusions (comma-separated)" className="sm:col-span-2" placeholder="Mentorship, Certificate, LMS Course Access, Project Review, Placement Assistance" hint="List of features, services and resources included in the fee." />
            <TextField {...f('feeDescription')} label="Fee Notes / Policy" className="sm:col-span-2" placeholder="Includes GST; non-refundable after induction." />
          </>
        )}
        <TextAreaField {...f('description')} label="Description" rows={3} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

function OpeningModal({ open, onClose, opening, departments, programs, onSaved }) {
  const toast = useToast();
  const edit = !!opening;
  const initialDept = opening?.departmentId?._id || opening?.departmentId || (departments[0]?._id || '');
  const form = useForm({
    title: opening?.title || '', departmentId: initialDept, programId: opening?.programId?._id || opening?.programId || '',
    description: opening?.description || '', responsibilities: (opening?.responsibilities || []).join('\n'),
    requiredSkills: (opening?.requiredSkills || []).join(', '), preferredSkills: (opening?.preferredSkills || []).join(', '),
    eligibility: opening?.eligibility || '', duration: opening?.duration || '60 Days', workMode: opening?.workMode || 'REMOTE', location: opening?.location || '',
    stipend: opening?.stipend || '', stipendAmount: opening?.stipendAmount ?? '',
    openPositions: opening?.openPositions ?? 1,
    deadline: opening?.deadline ? String(opening.deadline).slice(0, 10) : addDaysISO(todayISO(), 30)
  });
  const f = form.field;
  const programOptions = programs.filter((p) => !form.values.departmentId || String(p.departmentId?._id || p.departmentId) === String(form.values.departmentId));
  return (
    <FormModal
      open={open} onClose={onClose} size="lg" testId="opening-modal" title={edit ? 'Edit Internship Opening' : 'New Internship Opening'} submitLabel={edit ? 'Save Changes' : 'Publish Internship Opening'} form={form}
      rules={{
        title: [rules.required('Title'), rules.max(150, 'Title')],
        description: [rules.required('Description'), rules.min(10, 'Description')],
        deadline: rules.required('Deadline'),
        openPositions: [rules.required('Positions'), rules.number('Positions', { min: 1, max: 500 })],
        stipendAmount: rules.number('Stipend amount', { min: 0 })
      }}
      onSubmit={async (v) => {
        const body = {
          title: v.title.trim(), departmentId: v.departmentId, description: v.description.trim(),
          responsibilities: lines(v.responsibilities).join('\n'), requiredSkills: v.requiredSkills, preferredSkills: v.preferredSkills,
          eligibility: v.eligibility.trim(), duration: v.duration.trim(), workMode: (v.workMode || 'REMOTE').toUpperCase(), location: v.location.trim(),
          stipend: v.stipend.trim(), feeType: 'FREE',
          feeAmount: 0,
          feeInclusions: [],
          openPositions: Number(v.openPositions), deadline: v.deadline
        };
        if (v.programId) body.programId = v.programId;
        if (v.stipendAmount !== '' && v.stipendAmount !== null && v.stipendAmount !== undefined) {
          body.stipendAmount = Number(v.stipendAmount);
        }
        Object.keys(body).forEach((k) => { if (body[k] === '' && !edit) delete body[k]; });
        return edit ? api.patch(`/recruitment/openings/${opening._id}`, body) : api.post('/recruitment/openings', body);
      }}
      onDone={() => { toast.success(edit ? 'Opening updated' : 'Opening published successfully'); onSaved(); }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Internship Title" placeholder="e.g. Full Stack Developer Intern" required className="sm:col-span-2" />
        {departments.length > 0 && (
          <SelectField {...f('departmentId')} label="Department" placeholder="Select a department" options={departments.map((d) => ({ value: d._id, label: d.name }))} />
        )}
        {programOptions.length > 0 && (
          <SelectField {...f('programId')} label="Program Track (Optional)" placeholder="Auto-managed program track" options={programOptions.map((p) => ({ value: p._id, label: p.title }))} hint="Leave as auto-managed if not needed." />
        )}
        <TextAreaField {...f('description')} label="Description" placeholder="Job details and learning outcomes..." required rows={4} className="sm:col-span-2" />
        <TextAreaField {...f('responsibilities')} label="Responsibilities" rows={3} hint="One per line." className="sm:col-span-2" />
        <TextField {...f('requiredSkills')} label="Required skills" hint="Separate with commas." />
        <TextField {...f('preferredSkills')} label="Preferred skills" hint="Separate with commas." />
        <SelectField {...f('workMode')} label="Work mode" options={WORK_MODES} />
        <TextField {...f('location')} label="Location" placeholder="Remote / On-site location" />
        <TextField {...f('duration')} label="Duration (display)" placeholder="60 Days" />
        <TextField {...f('openPositions')} label="Open positions" type="number" min="1" required />
        <TextField {...f('stipend')} label="Stipend (display text)" placeholder="INR 10,000 / month" />
        <TextField {...f('stipendAmount')} label="Stipend amount (₹)" type="number" min="0" hint="Pre-fills offers; the display text above is shown publicly." />
        <TextField {...f('deadline')} label="Apply by" type="date" required min={edit ? undefined : todayISO()} />
        <TextField {...f('eligibility')} label="Eligibility" placeholder="e.g. Any graduate / B.Tech / MCA" />
      </FormGrid>
    </FormModal>
  );
}

export function ProgramsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('openings');
  const [programModal, setProgramModal] = useState(null); // null | 'new' | program
  const [openingModal, setOpeningModal] = useState(null);
  const { departments } = useDepartments();
  const programsState = usePrograms();
  const openings = useFetch(() => api.get('/recruitment/openings'), [], { enabled: can('openings.read') });
  const canPrograms = can('programs.manage');
  const canOpenings = can('openings.manage');

  const setOpeningStatus = async (o, status) => {
    try {
      await api.patch(`/recruitment/openings/${o._id}`, { status });
      toast.success(status === 'CLOSED' ? 'Opening closed' : 'Opening reopened');
      openings.reload({ silent: true });
    } catch (e) { toast.error(e.message); }
  };
  const archive = async (p) => {
    if (!(await confirm({ title: `Archive "${p.title}"?`, message: 'Archived programs cannot be used for new openings. Programs still used by open openings or active interns cannot be archived.', confirmLabel: 'Archive', tone: 'danger' }))) return;
    try {
      await api.post(`/recruitment/programs/${p._id}/archive`);
      toast.success('Program archived');
      programsState.reload({ silent: true });
    } catch (e) { toast.error(e.message); }
  };

  const openingCols = [
    { key: 'title', header: 'Opening', render: (o) => <div><p className="font-medium text-slate-900">{o.title}</p><p className="text-xs text-slate-600">{o.departmentId?.name} - {o.programId?.title}</p></div> },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    { key: 'positions', header: 'Positions', render: (o) => o.openPositions },
    {
      key: 'fees',
      header: 'Fee & Inclusions',
      render: (o) => (
        <div>
          <span className="font-medium text-slate-900">
            {o.feeType === 'PAID' ? `₹${(o.feeAmount || 0).toLocaleString('en-IN')}` : 'Free'}
          </span>
          {o.feeInclusions?.length > 0 && (
            <p className="text-xs text-slate-500 max-w-[180px] truncate" title={o.feeInclusions.join(', ')}>
              {o.feeInclusions.join(', ')}
            </p>
          )}
        </div>
      )
    },
    { key: 'deadline', header: 'Apply by', render: (o) => fmtDate(o.deadline) },
    { key: 'actions', header: 'Actions', align: 'right', render: (o) => canOpenings && (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpeningModal(o)} data-testid={`opening-edit-${o._id}`}>Edit</Button>
        {o.status === 'OPEN' && <Button size="sm" variant="outline" onClick={() => setOpeningStatus(o, 'CLOSED')} data-testid={`opening-close-${o._id}`}>Close</Button>}
        {o.status === 'CLOSED' && <Button size="sm" variant="outline" onClick={() => setOpeningStatus(o, 'OPEN')} data-testid={`opening-reopen-${o._id}`}>Reopen</Button>}
        {o.status === 'DRAFT' && <Button size="sm" variant="outline" onClick={() => setOpeningStatus(o, 'OPEN')} data-testid={`opening-publish-${o._id}`}>Publish</Button>}
      </div>
    ) }
  ];

  const programCols = [
    { key: 'title', header: 'Program', render: (p) => <div><p className="font-medium text-slate-900">{p.title}</p><p className="text-xs text-slate-600">{p.departmentId?.name}</p></div> },
    { key: 'durationDays', header: 'Duration', render: (p) => `${p.durationDays} days` },
    {
      key: 'fees',
      header: 'Fee & Inclusions',
      render: (p) => (
        <div>
          <span className="font-medium text-slate-900">
            {p.feeType === 'PAID' ? `₹${(p.feeAmount || 0).toLocaleString('en-IN')}` : 'Free'}
          </span>
          {p.feeInclusions?.length > 0 && (
            <p className="text-xs text-slate-500 max-w-[200px] truncate" title={p.feeInclusions.join(', ')}>
              Incl: {p.feeInclusions.join(', ')}
            </p>
          )}
        </div>
      )
    },
    { key: 'attendance', header: 'Attendance rule', render: (p) => `${p.attendanceRequirementPercent}%` },
    { key: 'tasks', header: 'Min. tasks', render: (p) => p.completionRequirements?.minimumTasksCompleted ?? '-' },
    { key: 'actions', header: 'Actions', align: 'right', render: (p) => canPrograms && (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setProgramModal(p)} data-testid={`program-edit-${p._id}`}>Edit</Button>
        <Button size="sm" variant="outline" onClick={() => archive(p)} data-testid={`program-archive-${p._id}`}>Archive</Button>
      </div>
    ) }
  ];

  return (
    <>
      <PageHeader
        title="Internship Programs & Openings"
        description="Create and manage career opportunities, curriculum tracks and fee inclusions for candidate applications."
        actions={
          <div className="flex gap-2">
            {tab === 'openings' && canOpenings && (
              <Button icon={Plus} onClick={() => setOpeningModal('new')} data-testid="new-opening">
                New Internship Opening
              </Button>
            )}
            {tab === 'programs' && canPrograms && (
              <Button icon={Plus} onClick={() => setProgramModal('new')} data-testid="new-program">
                New Internship Track
              </Button>
            )}
          </div>
        }
      />
      <Tabs
        label="Recruitment setup"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'openings', label: 'Internship Openings', count: openings.data?.length },
          { id: 'programs', label: 'Internship Programs', count: programsState.programs.length }
        ]}
      />
      <TabPanel id="openings" active={tab}>
        <DataTable testId="openings-table" columns={openingCols} rows={openings.data || []} loading={openings.loading} error={openings.error} onRetry={openings.reload} emptyTitle="No openings yet" emptyDescription="Publish an opening to start receiving applications." caption="Internship openings" />
      </TabPanel>
      <TabPanel id="programs" active={tab}>
        <DataTable testId="programs-table" columns={programCols} rows={programsState.programs} loading={programsState.loading} error={programsState.error} onRetry={programsState.reload} emptyTitle="No programs yet" emptyDescription="A program describes duration, attendance rule, fee inclusions and completion requirements." caption="Internship programs" />
      </TabPanel>

      {programModal && <ProgramModal open onClose={() => setProgramModal(null)} program={programModal === 'new' ? null : programModal} departments={departments} onSaved={() => { setProgramModal(null); programsState.reload({ silent: true }); }} />}
      {openingModal && <OpeningModal open onClose={() => setOpeningModal(null)} opening={openingModal === 'new' ? null : openingModal} departments={departments} programs={programsState.programs} onSaved={() => { setOpeningModal(null); openings.reload({ silent: true }); }} />}
    </>
  );
}
