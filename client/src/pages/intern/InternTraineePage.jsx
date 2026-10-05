import React, { useState } from 'react';
import {
  GraduationCap, CheckCircle2, Clock, BookOpen, CheckSquare, Award,
  ExternalLink, Download, ArrowRight, Upload, AlertCircle, FileText
} from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, humanize } from '../../lib/format';
import {
  Button, FormGrid, FormModal, Modal, PageHeader, SectionCard,
  StateView, StatusBadge, Tabs, TabPanel, TextField, TextAreaField, StatCard
} from '../../components/ui';

function TaskSubmitModal({ task, engagementId, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    githubUrl: task.submission?.githubUrl || '',
    demoUrl: task.submission?.demoUrl || '',
    notes: task.submission?.notes || ''
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    return await api.post(`/training/trainees/${engagementId}/tasks/${task._id}/submit`, {
      githubUrl: v.githubUrl.trim(),
      demoUrl: v.demoUrl.trim(),
      notes: v.notes.trim()
    });
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="submit-task-modal"
      title={`Submit Work: ${task.title}`}
      description="Provide your repository, hosted demo link, and notes for mentor review."
      submitLabel="Submit Work"
      form={form}
      rules={{
        githubUrl: (v) => (v && !/^https?:\/\//i.test(v.trim()) ? 'Enter a valid URL (https://...)' : null),
        demoUrl: (v) => (v && !/^https?:\/\//i.test(v.trim()) ? 'Enter a valid URL (https://...)' : null)
      }}
      onSubmit={handleSubmit}
      onDone={() => {
        toast.success('Task submitted successfully for review');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('githubUrl')} label="GitHub Repository / Code Link" placeholder="https://github.com/username/project" className="sm:col-span-2" />
        <TextField {...f('demoUrl')} label="Live Application Demo URL" placeholder="https://my-app.vercel.app" className="sm:col-span-2" />
        <TextAreaField {...f('notes')} label="Implementation Notes & Summary" rows={3} placeholder="Notes on architecture, testing, challenges..." className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

function ProgramCatalog({ programs, onEnrolled }) {
  const toast = useToast();
  const [enrollingId, setEnrollingId] = useState(null);

  const handleEnroll = async (programId) => {
    setEnrollingId(programId);
    try {
      await api.post('/training/trainee/enroll', { programId });
      toast.success('Successfully enrolled in training program!');
      onEnrolled();
    } catch (err) {
      toast.error(err.message || 'Enrollment failed');
    } finally {
      setEnrollingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="program-catalog">
      <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-6 text-brand-900">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-brand-700" />
          Welcome to Intern Trainee Lifecycle
        </h3>
        <p className="text-sm text-brand-800 mt-1">
          Select an available organization training program to start your structured learning milestones, hands-on tasks, and earn your completion certificate.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {programs.map((p) => (
          <div key={p._id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-slate-900 text-base">{p.title}</h4>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-100">
                  {p.mode}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{p.durationWeeks} Weeks Cohort</p>
              {p.description && <p className="text-xs text-slate-600 mt-2 line-clamp-3">{p.description}</p>}

              {p.skills && p.skills.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Skills Covered
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {p.skills.map((s, i) => (
                      <span key={i} className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              variant="primary"
              className="w-full"
              loading={enrollingId === p._id}
              onClick={() => handleEnroll(p._id)}
              data-testid={`enroll-btn-${p._id}`}
            >
              Enroll in Program <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InternTraineePage() {
  const { user } = useAuth();
  const [modal, setModal] = useState(null);
  const myState = useFetch(() => api.get('/training/trainee/my'), []);
  const catalogState = useFetch(() => api.get('/training/trainee/programs'), []);

  return (
    <StateView state={myState} loadingLabel="Loading trainee dashboard...">
      {(data) => {
        const { engagement, tasks = [], attendance = [], assessments = [], project } = data || {};

        if (!engagement) {
          return (
            <>
              <PageHeader
                title="Trainee Program Catalog (§41-§42)"
                description="Explore available technical tracks and enroll to begin your modular training."
              />
              <StateView state={catalogState} loadingLabel="Loading programs...">
                {(programs) => <ProgramCatalog programs={programs || []} onEnrolled={() => myState.reload()} />}
              </StateView>
            </>
          );
        }

        const program = engagement.programId;
        const modules = program?.modules || [];
        const progressPct = Math.round(engagement.overallProgress || 0);
        const attendanceRate = Math.round(engagement.attendanceRate || 0);

        return (
          <>
            <PageHeader
              title={`Trainee Dashboard — ${program?.title}`}
              description={`${program?.durationWeeks} Weeks • ${program?.mode} • Enrolled ${fmtDate(engagement.enrolledAt)}`}
              actions={
                <div className="flex items-center gap-2">
                  <StatusBadge status={engagement.status || 'ACTIVE'} />
                  {engagement.status === 'COMPLETED' && engagement.certificateId && (
                    <a
                      href={`/api/v1/certificates/${engagement.certificateId._id || engagement.certificateId}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      data-testid="trainee-download-cert-btn"
                    >
                      <Download className="h-4 w-4" /> Download Certificate
                    </a>
                  )}
                </div>
              }
            />

            {/* Trainee Progress Overview KPIs (§46) */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="trainee-dashboard-kpis">
              <StatCard label="Overall Progress" value={`${progressPct}%`} hint={`${engagement.completedModules?.length || 0} / ${modules.length} Modules`} />
              <StatCard label="Attendance" value={`${attendanceRate}%`} hint={attendanceRate >= 80 ? 'Threshold met (80%)' : 'Needs attention'} />
              <StatCard label="Tasks Done" value={`${tasks.filter((t) => t.status === 'APPROVED').length} / ${tasks.length}`} />
              <StatCard label="Assessments" value={`${assessments.filter((a) => a.status === 'PASSED').length} / ${assessments.length}`} />
            </div>

            <div className="space-y-6">
              {/* Modules Progress */}
              <SectionCard title="Curriculum Modules Progress (§47)">
                {modules.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No modules configured yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {modules.map((m, idx) => {
                      const isDone = (engagement.completedModules || []).includes(m._id || m.title);
                      return (
                        <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Module {idx + 1}</span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                              isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {isDone ? 'Completed' : 'In Progress'}
                            </span>
                          </div>
                          <h4 className="font-semibold text-slate-900 text-sm">{m.title}</h4>
                          {m.description && <p className="text-xs text-slate-500 line-clamp-2">{m.description}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              {/* Tasks Checklist */}
              <SectionCard title="Assigned Learning Tasks & Submissions (§48-§49)">
                {tasks.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No tasks currently assigned.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {tasks.map((task) => (
                      <div key={task._id} className="p-4 flex flex-wrap items-center justify-between gap-4 bg-white hover:bg-slate-50">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm">{task.title}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              task.priority === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {task.priority}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              task.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                              task.status === 'REVISION_REQUIRED' ? 'bg-amber-100 text-amber-800' :
                              task.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {humanize(task.status)}
                            </span>
                          </div>
                          {task.description && <p className="text-xs text-slate-600">{task.description}</p>}
                          <p className="text-[11px] text-slate-400">Due: {fmtDate(task.dueDate)}</p>
                          {task.feedback && (
                            <p className="text-xs text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-100">
                              Mentor Feedback: {task.feedback}
                            </p>
                          )}
                        </div>

                        {task.status !== 'APPROVED' && (
                          <Button
                            size="sm"
                            variant={task.status === 'REVISION_REQUIRED' ? 'danger' : 'primary'}
                            icon={Upload}
                            onClick={() => setModal({ type: 'submitTask', task })}
                            data-testid={`submit-task-btn-${task._id}`}
                          >
                            {task.status === 'SUBMITTED' ? 'Update Work' : task.status === 'REVISION_REQUIRED' ? 'Resubmit' : 'Submit Work'}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Assessments Overview */}
              <div className="grid gap-6 sm:grid-cols-2">
                <SectionCard title="Assessment Results (§51)">
                  {assessments.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No assessments recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {assessments.map((a) => (
                        <div key={a._id} className="rounded-lg border border-slate-200 p-3 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-semibold text-slate-900">{a.title}</p>
                            <p className="text-slate-500">Score: {a.score} / {a.maxScore} ({Math.round(a.percentage)}%)</p>
                          </div>
                          <span className={`font-bold px-2 py-0.5 rounded ${a.status === 'PASSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {a.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* Final Project Status */}
                <SectionCard title="Final Capstone Project (§52)">
                  {!project ? (
                    <p className="text-xs text-slate-500 py-4 text-center">Capstone project will be assigned by your mentor.</p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900 text-sm">{project.title}</span>
                        <span className="font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">{project.status}</span>
                      </div>
                      <p className="text-slate-600">{project.description}</p>
                      {project.repoUrl && (
                        <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline font-medium block">
                          Project Repository
                        </a>
                      )}
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>

            {modal?.type === 'submitTask' && (
              <TaskSubmitModal
                task={modal.task}
                engagementId={engagement._id}
                onClose={() => setModal(null)}
                onDone={() => { setModal(null); myState.reload(); }}
              />
            )}
          </>
        );
      }}
    </StateView>
  );
}
