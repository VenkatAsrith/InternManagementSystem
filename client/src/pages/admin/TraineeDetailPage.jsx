import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  GraduationCap, CheckCircle2, Clock, Calendar, Award, Star, BookOpen, CheckSquare,
  AlertTriangle, ShieldAlert, ArrowLeft, Plus, ExternalLink, MessageSquare, Download, Check,
  CreditCard, Edit, DollarSign, Mail
} from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
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
    title: 'Module Core Assessment',
    status: 'PASSED',
    assessmentUrl: '',
    platformName: 'Learning Spaces',
    assessmentDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    score: 85,
    maxScore: 100,
    passingScore: 70,
    instructions: '',
    feedback: 'Strong grasp of core concepts and design principles.'
  });
  const f = form.field;

  const handleSubmit = async (v) => {
    return await api.post(`/training/trainees/${engagementId}/assessments`, {
      title: v.title.trim(),
      status: v.status,
      assessmentUrl: v.assessmentUrl?.trim() || undefined,
      platformName: v.platformName?.trim() || undefined,
      assessmentDate: v.assessmentDate || undefined,
      dueDate: v.dueDate || undefined,
      score: v.status === 'PENDING' ? 0 : Number(v.score || 0),
      maxScore: Number(v.maxScore || 100),
      passingScore: Number(v.passingScore || 70),
      instructions: v.instructions?.trim() || undefined,
      feedback: v.feedback?.trim() || undefined
    });
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="lg"
      testId="record-assessment-modal"
      title="Create / Record Trainee Assessment (§51)"
      description="Assign an assessment test link or record grades and evaluation feedback for the trainee."
      submitLabel="Save Assessment"
      form={form}
      rules={{
        title: rules.required('Assessment title'),
        maxScore: rules.required('Max score')
      }}
      onSubmit={handleSubmit}
      onDone={() => {
        toast.success('Assessment saved successfully');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Assessment Title" required placeholder="e.g. Module 3 — Backend API & Database Evaluation" className="sm:col-span-2" />

        <SelectField
          {...f('status')}
          label="Assessment State"
          options={[
            { value: 'PASSED', label: 'Passed / Approved (Graded)' },
            { value: 'FAILED', label: 'Needs Revision / Failed (Graded)' },
            { value: 'PENDING', label: 'Scheduled / Pending Trainee Submission' }
          ]}
        />

        <TextField
          {...f('platformName')}
          label="Assessment Platform"
          placeholder="e.g. Learning Spaces, HackerRank, Google Form"
        />

        <TextField
          {...f('assessmentUrl')}
          label="Assessment / Test Platform Link"
          placeholder="https://learningspaces.techmecha.com/assessment/101"
          hint="Direct URL where the intern trainee takes or submits this test"
          className="sm:col-span-2"
        />

        <TextField {...f('assessmentDate')} label="Assessment Date" type="date" required />
        <TextField {...f('dueDate')} label="Due Date (Optional)" type="date" />

        {form.values.status !== 'PENDING' ? (
          <>
            <TextField {...f('score')} label="Score Achieved" type="number" min="0" required />
            <TextField {...f('maxScore')} label="Maximum Score" type="number" min="1" required />
            <TextField {...f('passingScore')} label="Passing Score Threshold" type="number" min="0" required />
          </>
        ) : (
          <>
            <TextField {...f('passingScore')} label="Passing Score Threshold" type="number" min="0" required />
            <TextField {...f('maxScore')} label="Maximum Score" type="number" min="1" required />
          </>
        )}

        <TextAreaField
          {...f('instructions')}
          label="Instructions for Trainee"
          rows={2}
          placeholder="e.g. Complete test within 90 mins; submit your repository link or quiz submission before deadline."
          className="sm:col-span-2"
        />

        <TextAreaField
          {...f('feedback')}
          label="Trainer / Mentor Feedback & Notes"
          rows={2}
          className="sm:col-span-2"
        />
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

function UpdatePaymentModal({ engagement, onClose, onDone }) {
  const toast = useToast();
  const cp = engagement.candidatePayment || {};
  const form = useForm({
    feeType: cp.feeType || 'PAID',
    feeAmount: cp.feeAmount !== undefined ? cp.feeAmount : (engagement.programId?.grossFee || 10000),
    amountPaid: cp.amountPaid || 0,
    paymentStatus: cp.paymentStatus || 'PENDING',
    paymentMethod: cp.paymentMethod || 'UPI',
    paymentReference: cp.paymentReference || '',
    notes: cp.notes || ''
  });
  const f = form.field;
  const rem = form.values.feeType === 'FREE' ? 0 : Math.max(0, Number(form.values.feeAmount || 0) - Number(form.values.amountPaid || 0));

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="update-payment-modal"
      title="Update Candidate Payment & Fee Status"
      description="Record fees collected, payment method, transaction reference, or fee waiver."
      submitLabel="Save Payment Record"
      form={form}
      rules={{
        feeAmount: rules.number('Fee amount', { min: 0 }),
        amountPaid: rules.number('Amount paid', { min: 0 })
      }}
      onSubmit={async (v) => {
        return await api.patch(`/training/trainees/${engagement._id}`, {
          candidatePayment: {
            feeType: v.feeType,
            feeAmount: v.feeType === 'FREE' ? 0 : Number(v.feeAmount || 0),
            amountPaid: v.feeType === 'FREE' ? 0 : Number(v.amountPaid || 0),
            paymentStatus: v.feeType === 'FREE' ? 'PAID' : v.paymentStatus,
            paymentMethod: v.paymentMethod,
            paymentReference: v.paymentReference.trim(),
            paidAt: Number(v.amountPaid) > 0 ? new Date() : undefined,
            notes: v.notes.trim()
          }
        });
      }}
      onDone={() => {
        toast.success('Payment record updated successfully');
        onDone();
      }}
    >
      <FormGrid>
        <SelectField
          {...f('feeType')}
          label="Fee Type"
          options={[{ value: 'PAID', label: 'Paid Program' }, { value: 'FREE', label: 'Free / Waived' }]}
        />
        {form.values.feeType === 'PAID' && (
          <>
            <TextField {...f('feeAmount')} label="Program Gross Fee (₹)" type="number" min="0" required />
            <TextField {...f('amountPaid')} label="Amount Paid / Collected (₹)" type="number" min="0" required />
            <SelectField
              {...f('paymentStatus')}
              label="Payment Status"
              options={[
                { value: 'PENDING', label: 'Pending (Unpaid)' },
                { value: 'PARTIAL', label: 'Partial Payment' },
                { value: 'PAID', label: 'Paid in Full' },
                { value: 'WAIVED', label: 'Waived / Full Scholarship' }
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
            <TextField {...f('paymentReference')} label="Transaction ID / UTR" placeholder="UTR-2026-987654" className="sm:col-span-2" />
            <div className="sm:col-span-2 flex justify-between items-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs text-slate-600 font-medium">Outstanding Balance:</span>
              <span className="text-base font-bold text-slate-900">₹{rem.toLocaleString('en-IN')}</span>
            </div>
          </>
        )}
        <TextAreaField {...f('notes')} label="Payment Notes" rows={2} className="sm:col-span-2" placeholder="Receipt number, invoice details, remarks..." />
      </FormGrid>
    </FormModal>
  );
}

function ExtendTraineeModal({ engagement, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    expectedEndDate: engagement.expectedEndDate ? String(engagement.expectedEndDate).slice(0, 10) : '',
    reason: ''
  });
  const f = form.field;
  return (
    <FormModal
      open
      onClose={onClose}
      size="sm"
      testId="extend-trainee-modal"
      title="Extend Program End Date"
      description="Update curriculum deadline with authorized justification."
      submitLabel="Save End Date"
      form={form}
      rules={{
        expectedEndDate: rules.required('End date'),
        reason: [rules.required('Reason'), rules.min(3, 'Reason')]
      }}
      onSubmit={async (v) => {
        return await api.patch(`/training/trainees/${engagement._id}`, {
          expectedEndDate: v.expectedEndDate,
          reason: v.reason.trim()
        });
      }}
      onDone={() => {
        toast.success('Program end date extended');
        onDone();
      }}
    >
      <TextField {...f('expectedEndDate')} label="New Expected End Date" type="date" required />
      <TextAreaField {...f('reason')} label="Extension Reason / Academic Justification" required rows={2} />
    </FormModal>
  );
}

function EditTraineeModal({ engagement, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    institution: engagement.institution || '',
    degree: engagement.degree || '',
    graduationYear: engagement.graduationYear || '',
    location: engagement.location || '',
    workMode: engagement.workMode || 'REMOTE',
    learningSpacesUrl: engagement.learningSpacesUrl || engagement.programId?.learningSpacesUrl || '',
    learningSpacesName: engagement.learningSpacesName || engagement.programId?.learningSpacesName || 'TechMecha Learning Spaces',
    internalNotes: engagement.internalNotes || ''
  });
  const f = form.field;
  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="edit-trainee-modal"
      title="Edit Trainee Profile Details"
      description="Update academic records, location, learning spaces platform, and internal notes."
      submitLabel="Save Changes"
      form={form}
      onSubmit={async (v) => {
        return await api.patch(`/training/trainees/${engagement._id}`, {
          institution: v.institution.trim(),
          degree: v.degree.trim(),
          graduationYear: v.graduationYear.trim(),
          location: v.location.trim(),
          workMode: v.workMode,
          learningSpacesUrl: v.learningSpacesUrl.trim(),
          learningSpacesName: v.learningSpacesName.trim(),
          internalNotes: v.internalNotes.trim()
        });
      }}
      onDone={() => {
        toast.success('Trainee profile updated');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('institution')} label="College / University" />
        <TextField {...f('degree')} label="Degree & Branch" />
        <TextField {...f('graduationYear')} label="Graduation Year" />
        <TextField {...f('location')} label="Location / City" />
        <SelectField
          {...f('workMode')}
          label="Learning Mode"
          options={[
            { value: 'REMOTE', label: 'Remote' },
            { value: 'HYBRID', label: 'Hybrid' },
            { value: 'ON_SITE', label: 'On Site' }
          ]}
        />
        <TextField
          {...f('learningSpacesUrl')}
          label="Learning Spaces Platform URL"
          placeholder="https://learningspaces.techmecha.com/course/track"
          hint="External course platform link assigned to this trainee"
          className="sm:col-span-2"
        />
        <TextField
          {...f('learningSpacesName')}
          label="Platform Name"
          placeholder="TechMecha Learning Spaces"
          className="sm:col-span-2"
        />
        <TextAreaField {...f('internalNotes')} label="Internal Notes" rows={2} className="sm:col-span-2" />
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
                    <button
                      type="button"
                      onClick={async () => {
                        const certObj = engagement.certificateId;
                        const cId = certObj?._id || certObj;
                        const certNum = certObj?.certificateId || engagement.traineeId || 'completion';
                        try {
                          await downloadFile(`/certificates/${cId}/download`, `Certificate_${certNum}.pdf`);
                        } catch (err) {
                          window.open(`/verify/certificate/${certNum}`, '_blank');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      data-testid="download-certificate-link"
                    >
                      <Download className="h-4 w-4" /> Download Certificate
                    </button>
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
                  <SectionCard
                    title="Trainee Engagement & Supervision"
                    actions={
                      can('training.manage') && (
                        <div className="flex items-center gap-2">
                          <Button size="xs" variant="outline" icon={Edit} onClick={() => setModal('editProfile')} data-testid="edit-trainee-btn">
                            Edit Profile
                          </Button>
                          <Button size="xs" variant="outline" icon={Calendar} onClick={() => setModal('extend')} data-testid="extend-trainee-btn">
                            Extend
                          </Button>
                        </div>
                      )
                    }
                  >
                    <DetailList
                      items={[
                        { label: 'Trainee ID', value: engagement.traineeId || '-' },
                        { label: 'Full Name', value: fullName(trainee) },
                        { label: 'Email', value: trainee?.email },
                        { label: 'Linked Intern ID', value: engagement.internId?.internId ? (
                          <Link to={`/admin/interns/${engagement.internId._id}`} className="text-brand-600 hover:underline font-mono">
                            {engagement.internId.internId}
                          </Link>
                        ) : 'Independent Trainee' },
                        { label: 'Program Track', value: `${program?.title || '-'} (${program?.durationWeeks || 8} Weeks Cohort)` },
                        { label: 'Program Period', value: `${fmtDate(engagement.startDate || engagement.enrolledAt)} to ${fmtDate(engagement.expectedEndDate)} (${program?.durationWeeks || 8} Weeks)` },
                        { label: 'Department', value: engagement.departmentId?.name || '-' },
                        { label: 'Manager / Supervisor', value: engagement.managerId ? fullName(engagement.managerId) : '-' },
                        { label: 'Learning Mode', value: humanize(engagement.workMode || program?.mode) },
                        { label: 'Status', value: humanize(engagement.status) }
                      ]}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Candidate Payment & Program Fee"
                    actions={
                      <div className="flex items-center gap-1.5">
                        {(engagement.candidatePayment?.amountPaid || 0) > 0 && (
                          <>
                            <Button
                              size="xs"
                              variant="outline"
                              icon={Download}
                              onClick={async () => {
                                try {
                                  await downloadFile(`/training/trainees/${engagement._id}/receipt`, `TMT-Receipt-${engagement._id}.pdf`);
                                  toast.success('Official fee receipt downloaded');
                                } catch (e) {
                                  toast.error(e.message || 'Failed to download receipt');
                                }
                              }}
                              data-testid="download-receipt-pdf-btn"
                            >
                              Receipt PDF
                            </Button>
                            {can('training.manage') && (
                              <Button
                                size="xs"
                                variant="outline"
                                icon={Mail}
                                onClick={async () => {
                                  try {
                                    const res = await api.post(`/training/trainees/${engagement._id}/send-receipt`);
                                    toast.success(res.message || 'Fee receipt emailed to trainee');
                                  } catch (e) {
                                    toast.error(e.message || 'Failed to send receipt email');
                                  }
                                }}
                                data-testid="email-receipt-btn"
                              >
                                Email Receipt
                              </Button>
                            )}
                          </>
                        )}
                        {can('training.manage') && (
                          <Button size="xs" variant="outline" icon={CreditCard} onClick={() => setModal('updatePayment')} data-testid="update-trainee-payment-btn">
                            Update Payment
                          </Button>
                        )}
                      </div>
                    }
                  >
                    {(() => {
                      const pay = engagement.candidatePayment || {};
                      const feeAmt = pay.feeAmount ?? program?.feeAmount ?? 0;
                      const paidAmt = pay.amountPaid ?? 0;
                      const balance = Math.max(0, feeAmt - paidAmt);
                      const payStatus = pay.paymentStatus || (feeAmt === 0 ? 'WAIVED' : 'PENDING');
                      return (
                        <div className="space-y-3">
                          <DetailList
                            items={[
                              { label: 'Fee Type', value: pay.feeType || program?.feeType || 'FREE' },
                              { label: 'Program Fee', value: feeAmt > 0 ? `₹${feeAmt.toLocaleString()}` : 'Free / Waived' },
                              { label: 'Amount Paid', value: `₹${paidAmt.toLocaleString()}` },
                              { label: 'Remaining Balance', value: balance > 0 ? (
                                <span className="font-semibold text-rose-600">₹{balance.toLocaleString()}</span>
                              ) : (
                                <span className="font-semibold text-emerald-600">Cleared (₹0)</span>
                              ) },
                              { label: 'Payment Status', value: (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                  payStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                                  payStatus === 'PARTIAL' ? 'bg-blue-100 text-blue-800' :
                                  payStatus === 'WAIVED' ? 'bg-slate-100 text-slate-800' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {payStatus}
                                </span>
                              ) },
                              { label: 'Payment Method', value: humanize(pay.paymentMethod || 'NONE') },
                              { label: 'Reference / UTR', value: pay.paymentReference || '-' },
                              { label: 'Paid On', value: pay.paidAt ? fmtDate(pay.paidAt) : '-' },
                              { label: 'Payment Notes', value: pay.notes || '-' }
                            ]}
                          />
                        </div>
                      );
                    })()}
                  </SectionCard>

                  <SectionCard title="Academic Background & Demographics">
                    <DetailList
                      items={[
                        { label: 'College / University', value: engagement.institution || '-' },
                        { label: 'Degree & Branch', value: engagement.degree || '-' },
                        { label: 'Graduation Year', value: engagement.graduationYear || '-' },
                        { label: 'Location / City', value: engagement.location || '-' },
                        { label: 'Application Source', value: humanize(engagement.source || 'TRAINING_PROGRAM') },
                        { label: 'Internal Notes', value: engagement.internalNotes || '-' }
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

                  {engagement.extensionHistory && engagement.extensionHistory.length > 0 && (
                    <SectionCard title="End Date Extension History">
                      <div className="divide-y divide-slate-100">
                        {engagement.extensionHistory.map((ext, i) => (
                          <div key={i} className="py-2.5 text-xs">
                            <div className="flex justify-between items-center font-medium text-slate-800">
                              <span>Extended to {fmtDate(ext.newEndDate)} (from {fmtDate(ext.previousEndDate)})</span>
                              <span className="text-slate-400">{fmtDate(ext.extendedAt)}</span>
                            </div>
                            <p className="text-slate-500 mt-0.5">Reason: {ext.reason}</p>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  )}
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
                      <div key={a._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{a.title}</h4>
                            <p className="text-[11px] text-slate-500">
                              {a.assessmentDate ? fmtDate(a.assessmentDate) : 'Date unassigned'}
                              {a.dueDate ? ` • Due: ${fmtDate(a.dueDate)}` : ''}
                            </p>
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            a.status === 'PASSED' ? 'bg-emerald-100 text-emerald-800' :
                            a.status === 'FAILED' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {a.status}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                          {['PENDING', 'SCHEDULED'].includes(a.status) ? (
                            <span>Scheduled Assessment (Passing mark: {a.passingScore || 70}%)</span>
                          ) : (
                            <>
                              <span>Score: <strong>{a.score} / {a.maxScore}</strong> ({Math.round(a.percentage)}%)</span>
                              <span>Passing: {a.passingScore}%</span>
                            </>
                          )}
                        </div>

                        {a.assessmentUrl && (
                          <div className="pt-1">
                            <a
                              href={a.assessmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {a.platformName ? `Open on ${a.platformName}` : 'Open Assessment Link'}
                            </a>
                          </div>
                        )}

                        {a.instructions && (
                          <div className="text-xs text-slate-600 bg-amber-50/60 border border-amber-200/60 p-2 rounded-lg">
                            <span className="font-semibold text-amber-900">Instructions: </span>
                            {a.instructions}
                          </div>
                        )}

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
            {modal === 'updatePayment' && (
              <UpdatePaymentModal
                engagement={engagement}
                onClose={() => setModal(null)}
                onDone={() => { setModal(null); state.reload(); }}
              />
            )}
            {modal === 'extend' && (
              <ExtendTraineeModal
                engagement={engagement}
                onClose={() => setModal(null)}
                onDone={() => { setModal(null); state.reload(); }}
              />
            )}
            {modal === 'editProfile' && (
              <EditTraineeModal
                engagement={engagement}
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
