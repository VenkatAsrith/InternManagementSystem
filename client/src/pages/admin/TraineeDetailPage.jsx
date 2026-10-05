import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  GraduationCap, CheckCircle2, Clock, Calendar, Award, Star, BookOpen, CheckSquare,
  AlertTriangle, ShieldAlert, ArrowLeft, Plus, ExternalLink, MessageSquare, Download, Check
} from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, fmtDateTime, fullName, humanize } from '../../lib/format';
import {
  Button, DetailList, FormGrid, FormModal, Modal, PageHeader, SectionCard,
  StateView, StatusBadge, Tabs, TabPanel, TextField, TextAreaField, SelectField, StatCard, InlineAlert
} from '../../components/ui';

function AssignTaskModal({ engagementId, modules, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    title: '',
    description: '',
    moduleId: modules?.[0]?._id || '',
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    priority: 'HIGH'
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    return await api.post(`/training/trainees/${engagementId}/tasks`, {
      title: v.title.trim(),
      description: v.description.trim(),
      moduleId: v.moduleId || undefined,
      dueDate: v.dueDate,
      priority: v.priority
    });
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="assign-task-modal"
      title="Assign Trainee Task (§48)"
      description="Create a curriculum-linked task for the trainee."
      submitLabel="Assign Task"
      form={form}
      rules={{ title: rules.required('Task title'), dueDate: rules.required('Due date') }}
      onSubmit={handleSubmit}
      onDone={() => {
        toast.success('Task assigned successfully');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Task Title" required placeholder="Build Authentication REST API" className="sm:col-span-2" />
        <SelectField
          {...f('priority')}
          label="Priority"
          options={[
            { value: 'HIGH', label: 'High' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'LOW', label: 'Low' }
          ]}
        />
        <TextField {...f('dueDate')} label="Due Date" type="date" required />
        <TextAreaField {...f('description')} label="Task Requirements & Acceptance Criteria" rows={3} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

function ReviewTaskModal({ task, engagementId, onClose, onDone }) {
  const toast = useToast();
  const [status, setStatus] = useState('APPROVED');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch(`/training/trainees/${engagementId}/tasks/${task._id}/review`, {
        status,
        feedback: feedback.trim()
      });
      toast.success(`Task ${status.toLowerCase()} successfully`);
      onDone();
    } catch (err) {
      toast.error(err.message || 'Review failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      testId="review-task-modal"
      title={`Review Task: ${task.title}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading} data-testid="save-task-review-btn">Save Review</Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {task.submission && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Trainee Submission Work</p>
            {task.submission.githubUrl && (
              <p className="text-xs">
                <strong>GitHub:</strong>{' '}
                <a href={task.submission.githubUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">
                  {task.submission.githubUrl}
                </a>
              </p>
            )}
            {task.submission.demoUrl && (
              <p className="text-xs">
                <strong>Live Demo:</strong>{' '}
                <a href={task.submission.demoUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">
                  {task.submission.demoUrl}
                </a>
              </p>
            )}
            {task.submission.notes && <p className="text-xs text-slate-600 italic">"{task.submission.notes}"</p>}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">Decision</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            data-testid="task-review-decision-select"
          >
            <option value="APPROVED">Approve (Task Completed)</option>
            <option value="REVISION_REQUIRED">Request Revision</option>
            <option value="REJECTED">Reject</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">Feedback & Notes</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="Feedback on code architecture, test coverage, or required adjustments..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      </form>
    </Modal>
  );
}

function MarkAttendanceModal({ engagementId, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    date: new Date().toISOString().slice(0, 10),
    status: 'PRESENT',
    minutesAttended: 120,
    notes: 'Regular scheduled training session.'
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    return await api.post(`/training/trainees/${engagementId}/attendance`, {
      date: v.date,
      status: v.status,
      minutesAttended: Number(v.minutesAttended),
      notes: v.notes.trim()
    });
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="sm"
      testId="mark-attendance-modal"
      title="Record Attendance (§50)"
      submitLabel="Record Attendance"
      form={form}
      rules={{ date: rules.required('Date') }}
      onSubmit={handleSubmit}
      onDone={() => {
        toast.success('Attendance recorded');
        onDone();
      }}
    >
      <TextField {...f('date')} label="Date" type="date" required />
      <SelectField
        {...f('status')}
        label="Attendance Status"
        options={[
          { value: 'PRESENT', label: 'Present' },
          { value: 'LATE', label: 'Late' },
          { value: 'ABSENT', label: 'Absent' },
          { value: 'EXCUSED', label: 'Excused' }
        ]}
      />
      <TextField {...f('minutesAttended')} label="Minutes Attended" type="number" min={0} />
      <TextField {...f('notes')} label="Notes" placeholder="Lecture / Lab Session" />
    </FormModal>
  );
}

function RecordAssessmentModal({ engagementId, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    title: 'Mid-Program Core Assessment',
    assessmentDate: new Date().toISOString().slice(0, 10),
    score: 85,
    maxScore: 100,
    passingScore: 70,
    feedback: 'Strong grasp of core architectural principles.'
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    return await api.post(`/training/trainees/${engagementId}/assessments`, {
      title: v.title.trim(),
      assessmentDate: v.assessmentDate,
      score: Number(v.score),
      maxScore: Number(v.maxScore),
      passingScore: Number(v.passingScore),
      feedback: v.feedback.trim()
    });
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="record-assessment-modal"
      title="Record Assessment Result (§51)"
      submitLabel="Save Result"
      form={form}
      rules={{
        title: rules.required('Assessment title'),
        score: rules.required('Score'),
        maxScore: rules.required('Max score')
      }}
      onSubmit={handleSubmit}
      onDone={() => {
        toast.success('Assessment result saved');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Assessment Title" required className="sm:col-span-2" />
        <TextField {...f('assessmentDate')} label="Date" type="date" required />
        <TextField {...f('passingScore')} label="Passing Score" type="number" required />
        <TextField {...f('score')} label="Score Achieved" type="number" required />
        <TextField {...f('maxScore')} label="Maximum Score" type="number" required />
        <TextAreaField {...f('feedback')} label="Trainer Feedback" rows={2} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

function MentorFeedbackModal({ engagementId, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    technicalSkills: 4,
    communication: 4,
    problemSolving: 5,
    taskCompletion: 4,
    professionalism: 5,
    overallFeedback: 'Consistently completes tasks on time and shows strong collaborative attitude.'
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    return await api.post(`/training/trainees/${engagementId}/mentor-feedback`, {
      technicalSkills: Number(v.technicalSkills),
      communication: Number(v.communication),
      problemSolving: Number(v.problemSolving),
      taskCompletion: Number(v.taskCompletion),
      professionalism: Number(v.professionalism),
      overallFeedback: v.overallFeedback.trim()
    });
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="mentor-feedback-modal"
      title="Record Mentor Review (§54)"
      submitLabel="Save Review"
      form={form}
      onSubmit={handleSubmit}
      onDone={() => {
        toast.success('Mentor review recorded');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('technicalSkills')} label="Technical Skills (1-5)" type="number" min={1} max={5} required />
        <TextField {...f('problemSolving')} label="Problem Solving (1-5)" type="number" min={1} max={5} required />
        <TextField {...f('communication')} label="Communication (1-5)" type="number" min={1} max={5} required />
        <TextField {...f('taskCompletion')} label="Task Completion (1-5)" type="number" min={1} max={5} required />
        <TextField {...f('professionalism')} label="Professionalism (1-5)" type="number" min={1} max={5} required className="sm:col-span-2" />
        <TextAreaField {...f('overallFeedback')} label="Mentor Narrative Review" rows={3} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

export function TraineeDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState(null);
  const [completing, setCompleting] = useState(false);

  const state = useFetch(() => api.get(`/training/trainees/${id}`), [id]);

  return (
    <StateView state={state} loadingLabel="Loading trainee profile...">
      {(data) => {
        const { engagement, tasks = [], attendance = [], assessments = [], project, activities = [] } = data;
        const trainee = engagement.userId;
        const program = engagement.programId;
        const modules = program?.modules || [];
        const progressPct = Math.round(engagement.overallProgress || 0);
        const attendanceRate = Math.round(engagement.attendanceRate || 0);

        // Completion criteria calculation (§57)
        const attendanceEligible = attendanceRate >= 80;
        const tasksApproved = tasks.length > 0 && tasks.every((t) => t.status === 'APPROVED');
        const assessmentPassed = assessments.length > 0 && assessments.every((a) => a.status === 'PASSED');
        const projectSubmitted = !!project && ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(project.status);
        const canComplete = attendanceEligible && tasksApproved && assessmentPassed && projectSubmitted && engagement.status !== 'COMPLETED';

        const handleCompleteProgram = async () => {
          if (!window.confirm('Complete this trainee program and issue official completion certificate?')) return;
          setCompleting(true);
          try {
            const res = await api.post(`/training/trainees/${engagement._id}/complete`, {});
            toast.success(res.message || 'Program marked completed and certificate generated!');
            state.reload();
          } catch (err) {
            toast.error(err.message || 'Failed to complete program');
          } finally {
            setCompleting(false);
          }
        };

        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: 'Trainees', to: '/admin/trainees' }, { label: fullName(trainee) }]}
              title={<span data-testid="trainee-detail-name">{fullName(trainee)}</span>}
              description={`${program?.title} (${program?.durationWeeks} Weeks) - Enrolled ${fmtDate(engagement.enrolledAt)}`}
              actions={
                <div className="flex items-center gap-2">
                  <StatusBadge status={engagement.status || 'ENROLLED'} />
                  {engagement.status !== 'COMPLETED' && can('training.manage') && (
                    <Button
                      variant="primary"
                      icon={Award}
                      loading={completing}
                      disabled={!canComplete}
                      onClick={handleCompleteProgram}
                      data-testid="complete-program-btn"
                    >
                      Complete & Issue Certificate
                    </Button>
                  )}
                  {engagement.status === 'COMPLETED' && engagement.certificateId && (
                    <a
                      href={`/api/v1/certificates/${engagement.certificateId._id || engagement.certificateId}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      data-testid="download-certificate-link"
                    >
                      <Download className="h-4 w-4" /> Download Certificate
                    </a>
                  )}
                </div>
              }
            />

            {/* At Risk Rule Banner (§60) */}
            {engagement.atRisk && (
              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 shadow-sm flex items-start gap-3" data-testid="at-risk-alert-banner">
                <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Trainee Flagged At Risk</h4>
                  <p className="text-xs text-rose-800 mt-0.5">
                    Signal reason: <strong>{engagement.atRiskReason || 'Low attendance or overdue tasks.'}</strong> Requires mentor review and support.
                  </p>
                </div>
              </div>
            )}

            <Tabs
              label="Trainee details"
              active={tab}
              onChange={setTab}
              tabs={[
                { id: 'overview', label: 'Overview & Mentor' },
                { id: 'modules', label: 'Curriculum Modules', count: modules.length },
                { id: 'tasks', label: 'Tasks & Reviews', count: tasks.length },
                { id: 'attendance', label: 'Attendance Log', count: attendance.length },
                { id: 'assessments', label: 'Assessments', count: assessments.length },
                { id: 'project', label: 'Capstone Project' },
                { id: 'timeline', label: 'Activity Timeline', count: activities.length }
              ]}
            />

            {/* TAB: OVERVIEW */}
            <TabPanel id="overview" active={tab}>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard label="Overall Progress" value={`${progressPct}%`} hint={`${engagement.completedModules?.length || 0} / ${modules.length} Modules`} />
                  <StatCard label="Attendance Rate" value={`${attendanceRate}%`} hint={attendanceRate >= 80 ? 'Requirement met' : 'Below 80% threshold'} />
                  <StatCard label="Tasks Completed" value={`${tasks.filter((t) => t.status === 'APPROVED').length} / ${tasks.length}`} />
                  <StatCard label="Assessments Passed" value={`${assessments.filter((a) => a.status === 'PASSED').length} / ${assessments.length}`} />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <SectionCard title="Trainee Profile & Program">
                    <DetailList
                      items={[
                        { label: 'Full Name', value: fullName(trainee) },
                        { label: 'Email', value: trainee?.email },
                        { label: 'Intern ID', value: engagement.internId?.internId || '-' },
                        { label: 'Program', value: program?.title },
                        { label: 'Mode', value: program?.mode },
                        { label: 'Duration', value: `${program?.durationWeeks} Weeks` },
                        { label: 'Status', value: humanize(engagement.status) }
                      ]}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Mentor & Review Feedback (§53-§54)"
                    actions={
                      can('training.manage') && (
                        <Button size="xs" variant="outline" icon={Plus} onClick={() => setModal('mentorFeedback')} data-testid="record-mentor-review-btn">
                          Record Review
                        </Button>
                      )
                    }
                  >
                    <DetailList
                      items={[
                        { label: 'Assigned Mentor', value: engagement.mentorId ? fullName(engagement.mentorId) : 'Unassigned' },
                        { label: 'Last Review', value: engagement.mentorFeedback?.submittedAt ? fmtDate(engagement.mentorFeedback.submittedAt) : 'None recorded' },
                        { label: 'Technical Rating', value: engagement.mentorFeedback?.technicalSkills ? `${engagement.mentorFeedback.technicalSkills} / 5` : '-' },
                        { label: 'Problem Solving', value: engagement.mentorFeedback?.problemSolving ? `${engagement.mentorFeedback.problemSolving} / 5` : '-' }
                      ]}
                    />
                    {engagement.mentorFeedback?.overallFeedback && (
                      <div className="mt-4 rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-700 italic">
                        "{engagement.mentorFeedback.overallFeedback}"
                      </div>
                    )}
                  </SectionCard>
                </div>
              </div>
            </TabPanel>

            {/* TAB: MODULES */}
            <TabPanel id="modules" active={tab}>
              <SectionCard title="Program Curriculum Modules (§44)">
                {modules.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No modules configured for this training program.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {modules.map((m, idx) => {
                      const isCompleted = (engagement.completedModules || []).includes(m._id || m.title);
                      return (
                        <div key={idx} className="p-4 flex items-center justify-between gap-4 bg-white hover:bg-slate-50">
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                              {idx + 1}
                            </span>
                            <div>
                              <h4 className="font-semibold text-slate-900 text-sm">{m.title}</h4>
                              {m.description && <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>}
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                            isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {isCompleted ? 'Completed' : 'In Progress'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </TabPanel>

            {/* TAB: TASKS */}
            <TabPanel id="tasks" active={tab}>
              <SectionCard
                title="Trainee Tasks & Reviews (§48-§49)"
                actions={
                  can('training.manage') && (
                    <Button size="sm" variant="primary" icon={Plus} onClick={() => setModal('assignTask')} data-testid="assign-task-btn">
                      Assign Task
                    </Button>
                  )
                }
              >
                {tasks.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No tasks assigned to this trainee yet.</p>
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
                              Feedback: {task.feedback}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'ASSIGNED'].includes(task.status) && can('training.manage') && (
                            <Button size="xs" variant="outline" onClick={() => setModal({ type: 'reviewTask', task })} data-testid={`review-task-${task._id}`}>
                              Review Work
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </TabPanel>

            {/* TAB: ATTENDANCE */}
            <TabPanel id="attendance" active={tab}>
              <SectionCard
                title="Trainee Attendance History (§50)"
                actions={
                  can('training.manage') && (
                    <Button size="sm" variant="outline" icon={Plus} onClick={() => setModal('markAttendance')} data-testid="mark-attendance-btn">
                      Record Attendance
                    </Button>
                  )
                }
              >
                {attendance.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No attendance logged yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm" data-testid="trainee-attendance-table">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Duration</th>
                          <th className="p-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendance.map((att) => (
                          <tr key={att._id} className="hover:bg-slate-50">
                            <td className="p-3 font-medium text-slate-900">{fmtDate(att.date)}</td>
                            <td className="p-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                att.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' :
                                att.status === 'LATE' ? 'bg-amber-100 text-amber-800' :
                                'bg-rose-100 text-rose-800'
                              }`}>
                                {att.status}
                              </span>
                            </td>
                            <td className="p-3 text-xs text-slate-600">{att.minutesAttended} mins</td>
                            <td className="p-3 text-xs text-slate-500">{att.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </TabPanel>

            {/* TAB: ASSESSMENTS */}
            <TabPanel id="assessments" active={tab}>
              <SectionCard
                title="Program Assessments (§51)"
                actions={
                  can('training.manage') && (
                    <Button size="sm" variant="outline" icon={Plus} onClick={() => setModal('recordAssessment')} data-testid="record-assessment-btn">
                      Record Assessment
                    </Button>
                  )
                }
              >
                {assessments.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No assessments recorded yet.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {assessments.map((a) => (
                      <div key={a._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-slate-900 text-sm">{a.title}</h4>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            a.status === 'PASSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {a.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-600">
                          <span>Score: <strong>{a.score} / {a.maxScore}</strong> ({Math.round(a.percentage)}%)</span>
                          <span>Passing: {a.passingScore}</span>
                        </div>
                        {a.feedback && <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2">"{a.feedback}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </TabPanel>

            {/* TAB: PROJECT */}
            <TabPanel id="project" active={tab}>
              <SectionCard title="Capstone Final Project (§52)">
                {!project ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No capstone project registered for this trainee yet.</p>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{project.title}</h4>
                        <p className="text-xs text-slate-500">{project.description}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">{project.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs">
                      {project.repoUrl && (
                        <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline font-medium">
                          GitHub Repository
                        </a>
                      )}
                      {project.demoUrl && (
                        <a href={project.demoUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline font-medium">
                          Live Application Demo
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </SectionCard>
            </TabPanel>

            {/* TAB: TIMELINE */}
            <TabPanel id="timeline" active={tab}>
              <SectionCard title="Chronological Activity Timeline (§55, §91)">
                {activities.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No timeline activity logged yet.</p>
                ) : (
                  <div className="space-y-4 border-l-2 border-slate-200 ml-3 pl-4">
                    {activities.map((act) => (
                      <div key={act._id} className="relative space-y-1">
                        <div className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full bg-brand-600 border-2 border-white ring-2 ring-brand-100" />
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900">{humanize(act.activityType)}</span>
                          <span className="text-slate-400">{fmtDateTime(act.createdAt)}</span>
                        </div>
                        <p className="text-xs text-slate-600">{act.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </TabPanel>

            {modal === 'assignTask' && (
              <AssignTaskModal
                engagementId={engagement._id}
                modules={modules}
                onClose={() => setModal(null)}
                onDone={() => { setModal(null); state.reload(); }}
              />
            )}
            {modal?.type === 'reviewTask' && (
              <ReviewTaskModal
                task={modal.task}
                engagementId={engagement._id}
                onClose={() => setModal(null)}
                onDone={() => { setModal(null); state.reload(); }}
              />
            )}
            {modal === 'markAttendance' && (
              <MarkAttendanceModal
                engagementId={engagement._id}
                onClose={() => setModal(null)}
                onDone={() => { setModal(null); state.reload(); }}
              />
            )}
            {modal === 'recordAssessment' && (
              <RecordAssessmentModal
                engagementId={engagement._id}
                onClose={() => setModal(null)}
                onDone={() => { setModal(null); state.reload(); }}
              />
            )}
            {modal === 'mentorFeedback' && (
              <MentorFeedbackModal
                engagementId={engagement._id}
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
