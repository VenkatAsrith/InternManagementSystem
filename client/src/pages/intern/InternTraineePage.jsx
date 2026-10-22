import React, { useState } from 'react';
import {
  GraduationCap, CheckCircle2, Clock, BookOpen, CheckSquare, Award,
  ExternalLink, Download, ArrowRight, Upload, AlertCircle, FileText,
  IndianRupee, Eye, ShieldCheck, Check, Calendar
} from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, fmtMoney, humanize } from '../../lib/format';
import {
  Button, FormGrid, FormModal, Modal, PageHeader, SectionCard,
  StateView, StatusBadge, TextField, TextAreaField, StatCard
} from '../../components/ui';
import { DocumentPreviewModal } from '../../components/domain/DocumentPreviewModal';

function UploadTraineeDocModal({ requirement, onClose, onDone }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/documents/requirements/${requirement._id}/upload`, fd);
      toast.success(`${requirement.title} uploaded successfully!`);
      onDone();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="md" title={`Upload Required: ${requirement.title}`}>
      <form onSubmit={handleUpload} className="space-y-4">
        <p className="text-xs text-slate-600">
          {requirement.description || 'Upload your document for organization verification (PDF or Image, max 10MB).'}
        </p>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
          required
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={loading} disabled={!file}>
            Upload Document
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TraineeDocumentsTab() {
  const docsState = useFetch(() => api.get('/documents/requirements/my'), []);
  const [uploadReq, setUploadReq] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  const reqs = docsState.data || [];

  return (
    <div className="space-y-4">
      <SectionCard title="Trainee Document Verification Checklist">
        {docsState.loading ? (
          <p className="text-xs text-slate-500 py-4 text-center">Loading requirements...</p>
        ) : reqs.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No document requirements assigned. Your documents are verified.</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
            {reqs.map((r) => {
              const status = r.submission?.status || 'PENDING';
              return (
                <div key={r._id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{r.title}</span>
                      <StatusBadge status={status} />
                    </div>
                    {r.description && <p className="text-xs text-slate-500">{r.description}</p>}
                    {r.submission?.submittedAt && (
                      <p className="text-[11px] text-slate-400">Uploaded {fmtDate(r.submission.submittedAt)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.submission?.documentId && (
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Eye}
                        onClick={() => setPreviewDoc(r.submission.documentId)}
                      >
                        Preview
                      </Button>
                    )}
                    {status !== 'VERIFIED' && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={Upload}
                        onClick={() => setUploadReq(r)}
                      >
                        {status === 'REJECTED' ? 'Re-upload' : 'Upload'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {uploadReq && (
        <UploadTraineeDocModal
          requirement={uploadReq}
          onClose={() => setUploadReq(null)}
          onDone={() => {
            setUploadReq(null);
            docsState.reload();
          }}
        />
      )}

      {previewDoc && (
        <DocumentPreviewModal
          documentId={previewDoc._id || previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}

function TraineeFinanceTab({ engagement }) {
  const cp = engagement?.candidatePayment || {};
  const feeType = cp.feeType || engagement?.programId?.feeType || 'PAID';
  const feeAmount = cp.feeAmount !== undefined ? cp.feeAmount : (engagement?.programId?.grossFee || 0);
  const amountPaid = cp.amountPaid || 0;
  const balance = feeType === 'FREE' ? 0 : Math.max(0, feeAmount - amountPaid);
  const paymentStatus = cp.paymentStatus || (feeType === 'FREE' ? 'PAID' : 'PENDING');

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Program Cost & Enrollment Fee Section */}
      <SectionCard
        title="Training Program Fee Schedule"
        actions={
          amountPaid > 0 && (
            <Button size="sm" variant="outline" icon={Download} onClick={handlePrintReceipt}>
              Print Receipt
            </Button>
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-4 mb-4">
          <StatCard
            label="Total Program Fee"
            value={feeType === 'FREE' ? 'Free Program' : fmtMoney(feeAmount, 'INR')}
            tone={feeType === 'FREE' ? 'emerald' : 'indigo'}
          />
          <StatCard
            label="Amount Paid"
            value={feeType === 'FREE' ? '₹0' : fmtMoney(amountPaid, 'INR')}
            tone="emerald"
          />
          <StatCard
            label="Outstanding Balance"
            value={fmtMoney(balance, 'INR')}
            tone={balance > 0 ? 'rose' : 'slate'}
            hint={balance > 0 ? 'Payment due' : 'Account cleared'}
          />
          <StatCard
            label="Payment Status"
            value={humanize(paymentStatus)}
            tone={paymentStatus === 'PAID' ? 'emerald' : 'amber'}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Payment & Receipt Acknowledgment
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Program Track:</span>
              <span className="font-semibold text-slate-900">{engagement?.programId?.title || 'Training Program'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Payment Model:</span>
              <span className="font-semibold text-slate-900">{feeType === 'FREE' ? 'Free / Scholarship' : 'Paid Curriculum'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Payment Mode:</span>
              <span className="font-semibold text-slate-900">{humanize(cp.paymentMethod || 'Online / UPI')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Transaction / UTR:</span>
              <span className="font-mono font-semibold text-slate-900">{cp.paymentReference || 'Pending confirmation'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Payment Timestamp:</span>
              <span className="font-semibold text-slate-900">{cp.paidAt ? fmtDate(cp.paidAt) : 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Receipt Clearance:</span>
              <StatusBadge status={paymentStatus} />
            </div>
          </div>
          {cp.notes && (
            <p className="text-xs text-slate-600 bg-white p-2.5 rounded border border-slate-200 mt-2">
              <strong>Admin Notes:</strong> {cp.notes}
            </p>
          )}
        </div>
      </SectionCard>

      {/* Fee Payment Instructions if Balance is Due */}
      {balance > 0 && (
        <SectionCard title="Payment Instructions & Clearance">
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2 text-xs text-amber-900">
            <p className="font-semibold text-sm">Outstanding Fee Balance: ₹{balance.toLocaleString('en-IN')}</p>
            <p>
              Please settle your remaining training fee installment with your program coordinator or organization finance desk.
              Once paid, your coordinator will record your transaction reference (UTR) to mark your fee as cleared.
            </p>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

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
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  Period: {p.durationWeeks || 8} Weeks
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  p.feeType === 'FREE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  Cost: {p.feeType === 'FREE' ? 'Free (No Cost)' : (p.grossFee ? `₹${p.grossFee.toLocaleString('en-IN')}` : 'Paid Program')}
                </span>
              </div>
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
  const [activeTab, setActiveTab] = useState('curriculum');
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
              description={`Period: ${program?.durationWeeks || 8} Weeks (${fmtDate(engagement.startDate || engagement.enrolledAt)}${engagement.expectedEndDate ? ` – ${fmtDate(engagement.expectedEndDate)}` : ''}) • ${program?.mode || 'Hybrid'} • Cost: ${engagement?.candidatePayment?.feeType === 'FREE' || program?.feeType === 'FREE' ? 'Free Program' : (engagement?.candidatePayment?.feeAmount ? `₹${engagement.candidatePayment.feeAmount.toLocaleString('en-IN')}` : (program?.grossFee ? `₹${program.grossFee.toLocaleString('en-IN')}` : 'Free'))}`}
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

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 mb-6 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('curriculum')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'curriculum'
                    ? 'border-brand-600 text-brand-700 bg-brand-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="h-4 w-4" /> Curriculum & Tasks
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'documents'
                    ? 'border-brand-600 text-brand-700 bg-brand-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="h-4 w-4" /> Documents & Verification
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('finance')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'finance'
                    ? 'border-brand-600 text-brand-700 bg-brand-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <IndianRupee className="h-4 w-4" /> Program Fee & Payments
              </button>
            </div>

            {activeTab === 'curriculum' && (
              <>
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
              </>
            )}

            {activeTab === 'documents' && <TraineeDocumentsTab />}

            {activeTab === 'finance' && <TraineeFinanceTab engagement={engagement} />}

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
