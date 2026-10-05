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
  Button, DataTable, FormGrid, FormModal, InlineAlert, PageHeader, SelectField, StatusBadge, TabPanel, Tabs, TextAreaField, TextField, useConfirm
} from '../../components/ui';

const WORK_MODES = [{ value: 'REMOTE', label: 'Remote' }, { value: 'HYBRID', label: 'Hybrid' }, { value: 'ON_SITE', label: 'On site' }];
const lines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);

function ProgramModal({ open, onClose, program, departments, onSaved }) {
  const toast = useToast();
  const edit = !!program;
  const form = useForm({
    title: program?.title || '', departmentId: program?.departmentId?._id || program?.departmentId || '', description: program?.description || '',
    durationDays: program?.durationDays ?? 60, attendanceRequirementPercent: program?.attendanceRequirementPercent ?? 85,
    minimumTasksCompleted: program?.completionRequirements?.minimumTasksCompleted ?? 5
  });
  const f = form.field;
  return (
    <FormModal
      open={open} onClose={onClose} testId="program-modal" title={edit ? 'Edit program' : 'New internship program'} submitLabel={edit ? 'Save changes' : 'Create program'} form={form}
      rules={{
        title: [rules.required('Title'), rules.max(150, 'Title')], departmentId: rules.required('Department'),
        durationDays: [rules.required('Duration'), rules.number('Duration', { min: 1, max: 730 })],
        attendanceRequirementPercent: rules.number('Attendance requirement', { min: 0, max: 100 }),
        minimumTasksCompleted: rules.number('Minimum tasks', { min: 0, max: 500 })
      }}
      onSubmit={async (v) => {
        const body = {
          title: v.title.trim(), departmentId: v.departmentId, description: v.description.trim(),
          durationDays: Number(v.durationDays), attendanceRequirementPercent: Number(v.attendanceRequirementPercent),
          completionRequirements: { minimumTasksCompleted: Number(v.minimumTasksCompleted), minimumAttendancePercent: Number(v.attendanceRequirementPercent) }
        };
        return edit ? api.patch(`/recruitment/programs/${program._id}`, body) : api.post('/recruitment/programs', body);
      }}
      onDone={() => { toast.success(edit ? 'Program updated' : 'Program created'); onSaved(); }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Program title" required className="sm:col-span-2" />
        <SelectField {...f('departmentId')} label="Department" required placeholder="Select a department" options={departments.map((d) => ({ value: d._id, label: d.name }))} />
        <TextField {...f('durationDays')} label="Duration (days)" type="number" min="1" max="730" required />
        <TextField {...f('attendanceRequirementPercent')} label="Attendance required (%)" type="number" min="0" max="100" />
        <TextField {...f('minimumTasksCompleted')} label="Minimum approved tasks" type="number" min="0" hint="Used by the certificate eligibility check." />
        <TextAreaField {...f('description')} label="Description" rows={3} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

function OpeningModal({ open, onClose, opening, departments, programs, onSaved }) {
  const toast = useToast();
  const edit = !!opening;
  const form = useForm({
    title: opening?.title || '', departmentId: opening?.departmentId?._id || opening?.departmentId || '', programId: opening?.programId?._id || opening?.programId || '',
    description: opening?.description || '', responsibilities: (opening?.responsibilities || []).join('\n'),
    requiredSkills: (opening?.requiredSkills || []).join(', '), preferredSkills: (opening?.preferredSkills || []).join(', '),
    eligibility: opening?.eligibility || '', duration: opening?.duration || '60 Days', workMode: opening?.workMode || 'REMOTE', location: opening?.location || '',
    stipend: opening?.stipend || '', stipendAmount: opening?.stipendAmount ?? '', openPositions: opening?.openPositions ?? 1,
    deadline: opening?.deadline ? String(opening.deadline).slice(0, 10) : addDaysISO(todayISO(), 30)
  });
  const f = form.field;
  const programOptions = programs.filter((p) => !form.values.departmentId || String(p.departmentId?._id || p.departmentId) === String(form.values.departmentId));
  return (
    <FormModal
      open={open} onClose={onClose} size="lg" testId="opening-modal" title={edit ? 'Edit opening' : 'New internship opening'} submitLabel={edit ? 'Save changes' : 'Publish opening'} form={form}
      rules={{
        title: [rules.required('Title'), rules.max(150, 'Title')], departmentId: rules.required('Department'), programId: rules.required('Program'),
        description: [rules.required('Description'), rules.min(20, 'Description')], deadline: rules.required('Deadline'),
        openPositions: [rules.required('Positions'), rules.number('Positions', { min: 1, max: 500 })], stipendAmount: rules.number('Stipend amount', { min: 0 })
      }}
      onSubmit={async (v) => {
        const body = {
          title: v.title.trim(), departmentId: v.departmentId, programId: v.programId, description: v.description.trim(),
          responsibilities: lines(v.responsibilities).join('\n'), requiredSkills: v.requiredSkills, preferredSkills: v.preferredSkills,
          eligibility: v.eligibility.trim(), duration: v.duration.trim(), workMode: v.workMode, location: v.location.trim(),
          stipend: v.stipend.trim(), openPositions: Number(v.openPositions), deadline: v.deadline
        };
        if (v.stipendAmount !== '') body.stipendAmount = Number(v.stipendAmount);
        Object.keys(body).forEach((k) => { if (body[k] === '' && !edit) delete body[k]; });
        return edit ? api.patch(`/recruitment/openings/${opening._id}`, body) : api.post('/recruitment/openings', body);
      }}
      onDone={() => { toast.success(edit ? 'Opening updated' : 'Opening published'); onSaved(); }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Title" required className="sm:col-span-2" />
        <SelectField {...f('departmentId')} label="Department" required placeholder="Select a department" options={departments.map((d) => ({ value: d._id, label: d.name }))} />
        <SelectField {...f('programId')} label="Program" required placeholder="Select a program" options={programOptions.map((p) => ({ value: p._id, label: p.title }))} hint="Only programs of the chosen department are listed." />
        <TextAreaField {...f('description')} label="Description" required rows={4} className="sm:col-span-2" />
        <TextAreaField {...f('responsibilities')} label="Responsibilities" rows={3} hint="One per line." className="sm:col-span-2" />
        <TextField {...f('requiredSkills')} label="Required skills" hint="Separate with commas." />
        <TextField {...f('preferredSkills')} label="Preferred skills" hint="Separate with commas." />
        <SelectField {...f('workMode')} label="Work mode" options={WORK_MODES} />
        <TextField {...f('location')} label="Location" />
        <TextField {...f('duration')} label="Duration (display)" />
        <TextField {...f('openPositions')} label="Open positions" type="number" min="1" required />
        <TextField {...f('stipend')} label="Stipend (display text)" placeholder="INR 10,000 / month" />
        <TextField {...f('stipendAmount')} label="Stipend amount" type="number" min="0" hint="Pre-fills offers; the display text above is shown publicly." />
        <TextField {...f('deadline')} label="Apply by" type="date" required min={edit ? undefined : todayISO()} />
        <TextField {...f('eligibility')} label="Eligibility" />
      </FormGrid>
    </FormModal>
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

export function ProgramsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('openings');
  const [programModal, setProgramModal] = useState(null); // null | 'new' | program
  const [openingModal, setOpeningModal] = useState(null);
  const [trainingModal, setTrainingModal] = useState(null);
  const { departments } = useDepartments();
  const programsState = usePrograms();
  const openings = useFetch(() => api.get('/recruitment/openings'), [], { enabled: can('openings.read') });
  const trainingPrograms = useFetch(() => api.get('/training/programs'), [], { enabled: can('programs.manage') || can('training.manage') });
  const canPrograms = can('programs.manage');
  const canOpenings = can('openings.manage');
  const canTraining = can('programs.manage') || can('training.manage');

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
    { key: 'attendance', header: 'Attendance rule', render: (p) => `${p.attendanceRequirementPercent}%` },
    { key: 'tasks', header: 'Min. tasks', render: (p) => p.completionRequirements?.minimumTasksCompleted ?? '-' },
    { key: 'actions', header: 'Actions', align: 'right', render: (p) => canPrograms && (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setProgramModal(p)} data-testid={`program-edit-${p._id}`}>Edit</Button>
        <Button size="sm" variant="outline" onClick={() => archive(p)} data-testid={`program-archive-${p._id}`}>Archive</Button>
      </div>
    ) }
  ];

  const trainingCols = [
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
      header: 'Fees & Payment',
      render: (p) => (
        <div>
          <span className="font-medium text-slate-900">
            {p.feeType === 'FREE' ? 'Free' : `₹${(p.grossFee || 0).toLocaleString('en-IN')}`}
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
      header: 'Trainer',
      render: (p) => p.trainer || 'Unassigned'
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => canTraining && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setTrainingModal(p)} data-testid={`training-edit-${p._id}`}>
            Edit Details
          </Button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Programs & openings"
        description="Programs define the internship structure. Openings publish a program to the public portal."
        actions={(
          <>
            {tab === 'training' ? (
              canTraining && <Button icon={Plus} onClick={() => setTrainingModal('new')} data-testid="new-training-program">New training program</Button>
            ) : (
              <>
                {canPrograms && <Button variant="outline" icon={Plus} onClick={() => setProgramModal('new')} data-testid="new-program">New program</Button>}
                {canOpenings && <Button icon={Plus} onClick={() => setOpeningModal('new')} data-testid="new-opening">New opening</Button>}
              </>
            )}
          </>
        )}
      />
      {canOpenings && programsState.programs.length === 0 && !programsState.loading && (
        <InlineAlert tone="info" className="mb-4" testId="need-program">Create a program first. An opening must belong to a program.</InlineAlert>
      )}
      <Tabs
        label="Recruitment setup"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'openings', label: 'Openings', count: openings.data?.length },
          { id: 'programs', label: 'Internship Programs', count: programsState.programs.length },
          { id: 'training', label: 'Training Programs', count: trainingPrograms.data?.length }
        ]}
      />
      <TabPanel id="openings" active={tab}>
        <DataTable testId="openings-table" columns={openingCols} rows={openings.data || []} loading={openings.loading} error={openings.error} onRetry={openings.reload} emptyTitle="No openings yet" emptyDescription="Publish an opening to start receiving applications." caption="Internship openings" />
      </TabPanel>
      <TabPanel id="programs" active={tab}>
        <DataTable testId="programs-table" columns={programCols} rows={programsState.programs} loading={programsState.loading} error={programsState.error} onRetry={programsState.reload} emptyTitle="No programs yet" emptyDescription="A program describes duration, attendance rule and completion requirements." caption="Internship programs" />
      </TabPanel>
      <TabPanel id="training" active={tab}>
        <DataTable testId="training-programs-table" columns={trainingCols} rows={trainingPrograms.data || []} loading={trainingPrograms.loading} error={trainingPrograms.error} onRetry={trainingPrograms.reload} emptyTitle="No training programs yet" emptyDescription="Create structured training programs with duration, fees, and syllabus." caption="Training programs" />
      </TabPanel>

      {programModal && <ProgramModal open onClose={() => setProgramModal(null)} program={programModal === 'new' ? null : programModal} departments={departments} onSaved={() => { setProgramModal(null); programsState.reload({ silent: true }); }} />}
      {openingModal && <OpeningModal open onClose={() => setOpeningModal(null)} opening={openingModal === 'new' ? null : openingModal} departments={departments} programs={programsState.programs} onSaved={() => { setOpeningModal(null); openings.reload({ silent: true }); }} />}
      {trainingModal && <TrainingProgramModal open onClose={() => setTrainingModal(null)} program={trainingModal === 'new' ? null : trainingModal} onSaved={() => { setTrainingModal(null); trainingPrograms.reload({ silent: true }); }} />}
    </>
  );
}
