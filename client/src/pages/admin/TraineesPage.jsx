import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, GraduationCap, AlertTriangle, CheckCircle2, UserCheck, BookOpen, Clock, ShieldAlert } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { fullName, humanize, fmtDate } from '../../lib/format';
import { Button, DataTable, FilterBar, FormGrid, FormModal, Modal, PageHeader, SectionCard, SelectField, StatCard, StatusBadge, TextField, TextAreaField } from '../../components/ui';

function CreateProgramModal({ onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    title: '',
    durationWeeks: 12,
    mode: 'HYBRID',
    description: '',
    skills: 'React, Node.js, Express, MongoDB, REST APIs',
    learningObjectives: 'Build scalable web applications and master agile engineering.',
    capacity: 30
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    return await api.post('/training/trainee/programs', {
      title: v.title.trim(),
      durationWeeks: Number(v.durationWeeks),
      mode: v.mode,
      description: v.description.trim(),
      skills: v.skills.split(',').map((s) => s.trim()).filter(Boolean),
      learningObjectives: v.learningObjectives.trim(),
      capacity: Number(v.capacity)
    });
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="create-trainee-program-modal"
      title="Create Training Program (§43)"
      description="Create a curriculum-based learning program with module milestones."
      submitLabel="Create Program"
      form={form}
      rules={{
        title: rules.required('Program title'),
        durationWeeks: rules.required('Duration in weeks')
      }}
      onSubmit={handleSubmit}
      onDone={() => {
        toast.success('Training program created successfully');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Program Title" required placeholder="e.g. Full Stack Cloud & Node.js" className="sm:col-span-2" />
        <TextField {...f('durationWeeks')} label="Duration (Weeks)" type="number" min={1} required />
        <SelectField
          {...f('mode')}
          label="Learning Mode"
          options={[
            { value: 'HYBRID', label: 'Hybrid' },
            { value: 'REMOTE', label: 'Remote' },
            { value: 'ONSITE', label: 'Onsite' }
          ]}
        />
        <TextField {...f('capacity')} label="Cohort Capacity" type="number" min={1} className="sm:col-span-2" />
        <TextField {...f('skills')} label="Target Skills (comma-separated)" placeholder="React, Node.js, MongoDB" className="sm:col-span-2" />
        <TextAreaField {...f('learningObjectives')} label="Learning Objectives" rows={2} className="sm:col-span-2" />
        <TextAreaField {...f('description')} label="Program Description" rows={2} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

export function TraineesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [programId, setProgramId] = useState('');
  const [status, setStatus] = useState('');
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [modal, setModal] = useState(null);

  const programs = useFetch(() => api.get('/training/trainee/programs'), []);
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

  const trainees = traineesFetch.data || [];
  const activeCount = trainees.filter((t) => t.status === 'ACTIVE' || t.status === 'ENROLLED').length;
  const completedCount = trainees.filter((t) => t.status === 'COMPLETED').length;
  const atRiskCount = trainees.filter((t) => t.atRisk).length;

  const cols = [
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
        </div>
      )
    },
    {
      key: 'internId',
      header: 'Intern ID',
      render: (t) => <span className="font-mono text-xs text-slate-700">{t.internId?.internId || '-'}</span>
    },
    {
      key: 'program',
      header: 'Training Program',
      render: (t) => (
        <div>
          <span className="font-medium text-slate-800 block text-xs">{t.programId?.title}</span>
          <span className="text-[11px] text-slate-500">{t.programId?.durationWeeks} Weeks &bull; {t.programId?.mode}</span>
        </div>
      )
    },
    {
      key: 'progress',
      header: 'Overall Progress',
      render: (t) => {
        const pct = Math.min(100, Math.round(t.overallProgress || 0));
        return (
          <div className="w-32 space-y-1">
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
        const pct = Math.round(t.attendanceRate || 0);
        return (
          <span className={`font-semibold text-xs ${pct < 75 ? 'text-rose-600' : 'text-slate-800'}`}>
            {pct}%
          </span>
        );
      }
    },
    {
      key: 'atRisk',
      header: 'Tracking Signal',
      render: (t) => (
        <div>
          {t.atRisk ? (
            <span
              className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800"
              title={t.atRiskReason || 'Trainee flagged at risk based on activity and attendance rules'}
              data-testid={`at-risk-badge-${t._id}`}
            >
              <ShieldAlert className="h-3 w-3" /> At Risk
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3 w-3" /> On Track
            </span>
          )}
          {t.atRisk && t.atRiskReason && (
            <p className="text-[10px] text-rose-700 mt-0.5 truncate max-w-[140px]" title={t.atRiskReason}>
              {t.atRiskReason}
            </p>
          )}
        </div>
      )
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

  return (
    <>
      <PageHeader
        title="Intern Trainees (§40-§62)"
        description="Program-based learning, modular progress tracking, assignments, assessments, and completion certifications."
        actions={
          can('training.manage') && (
            <Button icon={Plus} onClick={() => setModal('createProgram')} data-testid="create-program-btn">
              Create Program
            </Button>
          )
        }
      />

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

      <SectionCard title="Enrolled Trainees">
        <DataTable
          testId="trainees-table"
          columns={cols}
          rows={trainees}
          loading={traineesFetch.loading}
          error={traineesFetch.error}
          onRetry={traineesFetch.reload}
          caption="Trainees"
          emptyTitle="No trainees found"
          emptyDescription="Interns who enroll in a training program will appear here with automated progress tracking."
        />
      </SectionCard>

      {modal === 'createProgram' && (
        <CreateProgramModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            programs.reload();
          }}
        />
      )}
    </>
  );
}
