import React, { useState } from 'react';
import { Plus, Trash2, Calendar, Bell, FileText, ExternalLink, BookOpen, Layers } from 'lucide-react';
import api from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { usePrograms } from '../../hooks/useRefData';
import { fmtDate } from '../../lib/format';
import {
  Button, CheckboxField, DataTable, FormGrid, FormModal, Modal, PageHeader, SectionCard,
  SelectField, StateView, TextAreaField, TextField, StatusBadge
} from '../../components/ui';

const LESSON_TYPES = ['ARTICLE', 'VIDEO', 'DOCUMENT', 'LINK', 'TEXT', 'ASSIGNMENT', 'QUIZ'].map((t) => ({
  value: t,
  label: t.charAt(0) + t.slice(1).toLowerCase()
}));

const DOC_TYPES = [
  { value: 'DOCUMENT', label: 'Document / Guide' },
  { value: 'PDF', label: 'PDF Handbook' },
  { value: 'SPREADSHEET', label: 'Spreadsheet / Dataset' },
  { value: 'PRESENTATION', label: 'Presentation Deck' },
  { value: 'CODE', label: 'Code Repo / Starter' },
  { value: 'OTHER', label: 'External Resource' }
];

function PathModal({ onClose, onDone }) {
  const toast = useToast();
  const { programs } = usePrograms();
  const form = useForm({
    title: '',
    description: '',
    programId: '',
    dueDate: '',
    reminderEnabled: false,
    reminderDaysBefore: 3,
    reminderNote: ''
  });
  const f = form.field;
  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="path-modal"
      title="New Learning Path"
      description="Configure learning curriculum, milestone deadlines, and reminder schedules."
      submitLabel="Create Path"
      form={form}
      rules={{
        title: [rules.required('Title'), rules.max(150, 'Title')]
      }}
      onSubmit={async (v) => {
        return await api.post('/learning/paths', {
          title: v.title.trim(),
          description: v.description.trim(),
          ...(v.programId ? { programId: v.programId } : {}),
          ...(v.dueDate ? { dueDate: v.dueDate } : {}),
          reminder: {
            enabled: Boolean(v.reminderEnabled),
            daysBefore: Number(v.reminderDaysBefore || 3),
            note: v.reminderNote.trim()
          }
        });
      }}
      onDone={() => {
        toast.success('Learning path created');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Title" required className="sm:col-span-2" />
        <SelectField {...f('programId')} label="Linked Program" placeholder="Any / Universal Program" options={programs.map((p) => ({ value: p._id, label: p.title }))} className="sm:col-span-2" />
        <TextAreaField {...f('description')} label="Curriculum Description" rows={2} className="sm:col-span-2" />
        <TextField {...f('dueDate')} label="Target Due Date" type="date" />
        <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
          <CheckboxField
            name="reminderEnabled"
            label="Enable Automated Due Date Reminders"
            checked={form.values.reminderEnabled}
            onChange={f('reminderEnabled').onChange}
          />
          {form.values.reminderEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <TextField
                {...f('reminderDaysBefore')}
                label="Days Before Due Date"
                type="number"
                min={1}
                max={30}
              />
              <TextField
                {...f('reminderNote')}
                label="Reminder Notification Message"
                placeholder="e.g. Please wrap up remaining lessons and submit quiz."
              />
            </div>
          )}
        </div>
      </FormGrid>
    </FormModal>
  );
}

function ModuleModal({ pathId, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    title: '',
    description: '',
    dueDate: '',
    reminderEnabled: false,
    reminderDaysBefore: 2,
    reminderNote: ''
  });
  const f = form.field;
  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="module-modal"
      title="Add Curriculum Module"
      description="Add a structured module with target completion date and reminder alert."
      submitLabel="Add Module"
      form={form}
      rules={{ title: rules.required('Title') }}
      onSubmit={async (v) => {
        return await api.post(`/learning/paths/${pathId}/modules`, {
          title: v.title.trim(),
          description: v.description.trim(),
          ...(v.dueDate ? { dueDate: v.dueDate } : {}),
          reminder: {
            enabled: Boolean(v.reminderEnabled),
            daysBefore: Number(v.reminderDaysBefore || 2),
            note: v.reminderNote.trim()
          }
        });
      }}
      onDone={() => {
        toast.success('Curriculum module added');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Module Title" required className="sm:col-span-2" />
        <TextAreaField {...f('description')} label="Module Description / Objectives" rows={2} className="sm:col-span-2" />
        <TextField {...f('dueDate')} label="Module Due Date" type="date" />
        <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
          <CheckboxField
            name="reminderEnabled"
            label="Enable Module Reminder"
            checked={form.values.reminderEnabled}
            onChange={f('reminderEnabled').onChange}
          />
          {form.values.reminderEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <TextField
                {...f('reminderDaysBefore')}
                label="Days Before Due Date"
                type="number"
                min={1}
                max={30}
              />
              <TextField
                {...f('reminderNote')}
                label="Reminder Note"
                placeholder="e.g. Complete this module before weekly review."
              />
            </div>
          )}
        </div>
      </FormGrid>
    </FormModal>
  );
}

function AddDocumentModal({ targetType, targetId, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({
    title: '',
    description: '',
    url: '',
    fileType: 'DOCUMENT'
  });
  const f = form.field;

  const endpoint = targetType === 'module'
    ? `/learning/modules/${targetId}/documents`
    : `/learning/paths/${targetId}/documents`;

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      testId="add-document-modal"
      title={targetType === 'module' ? 'Attach Document to Module' : 'Add Path Reference Document'}
      description="Add reference documentation, resource links, guides, or templates."
      submitLabel="Attach Document"
      form={form}
      rules={{
        title: rules.required('Document Title'),
        url: rules.required('Document URL / Link')
      }}
      onSubmit={async (v) => {
        return await api.post(endpoint, {
          title: v.title.trim(),
          description: v.description.trim(),
          url: v.url.trim(),
          fileType: v.fileType
        });
      }}
      onDone={() => {
        toast.success('Document attached successfully');
        onDone();
      }}
    >
      <FormGrid>
        <TextField {...f('title')} label="Document Title" required className="sm:col-span-2" placeholder="e.g. System Architecture Guide v1" />
        <SelectField {...f('fileType')} label="Document Type" options={DOC_TYPES} />
        <TextField {...f('url')} label="Resource Link / URL" required placeholder="https://..." />
        <TextAreaField {...f('description')} label="Notes / Description" rows={2} className="sm:col-span-2" placeholder="Brief summary of what this document covers..." />
      </FormGrid>
    </FormModal>
  );
}

function LessonModal({ moduleId, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ title: '', contentType: 'ARTICLE', content: '', externalUrl: '', durationMinutes: '', passScore: 70 });
  const [questions, setQuestions] = useState([{ prompt: '', options: ['', ''], correctIndex: 0 }]);
  const f = form.field;
  const quiz = form.values.contentType === 'QUIZ';
  const setQ = (i, patch) => setQuestions((qs) => qs.map((q, n) => (n === i ? { ...q, ...patch } : q)));
  return (
    <FormModal open onClose={onClose} size="lg" testId="lesson-modal" title="New lesson" submitLabel="Add lesson" form={form}
      rules={{
        title: rules.required('Title'), externalUrl: rules.url('URL'), durationMinutes: rules.number('Duration', { min: 0, max: 600 }),
        passScore: (v, a) => (a.contentType === 'QUIZ' ? rules.number('Pass score', { min: 1, max: 100 })(v) : null),
        content: () => (quiz && questions.some((q) => !q.prompt.trim() || q.options.filter((o) => o.trim()).length < 2) ? 'Every question needs text and at least two options' : null)
      }}
      onSubmit={(v) => api.post(`/learning/modules/${moduleId}/lessons`, {
        title: v.title.trim(), contentType: v.contentType, ...(v.content.trim() ? { content: v.content.trim() } : {}), ...(v.externalUrl.trim() ? { externalUrl: v.externalUrl.trim() } : {}),
        ...(v.durationMinutes !== '' ? { durationMinutes: Number(v.durationMinutes) } : {}),
        ...(quiz ? { quiz: { passScore: Number(v.passScore), questions: questions.map((q) => { const opts = q.options.map((o) => o.trim()).filter(Boolean); return { prompt: q.prompt.trim(), options: opts, correctIndex: Math.min(q.correctIndex, opts.length - 1) }; }) } } : {})
      })}
      onDone={() => { toast.success('Lesson added'); onDone(); }}>
      <FormGrid>
        <TextField {...f('title')} label="Title" required className="sm:col-span-2" />
        <SelectField {...f('contentType')} label="Type" options={LESSON_TYPES} />
        <TextField {...f('durationMinutes')} label="Duration (minutes)" type="number" min="0" />
        {!quiz && <TextField {...f('externalUrl')} label="Link" type="url" className="sm:col-span-2" />}
        {!quiz && <TextAreaField {...f('content')} label="Content" rows={4} className="sm:col-span-2" />}
      </FormGrid>
      {quiz && (
        <div className="space-y-4" data-testid="quiz-builder">
          <TextField {...f('passScore')} label="Pass score (%)" type="number" min="1" max="100" />
          {questions.map((q, i) => (
            <fieldset key={i} className="rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-sm font-semibold text-slate-900">Question {i + 1}</legend>
              <input aria-label={`Question ${i + 1} text`} data-testid={`q-${i}-prompt`} value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} className="mb-2 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="Question" />
              {q.options.map((o, n) => (
                <div key={n} className="mb-1.5 flex items-center gap-2">
                  <input type="radio" name={`correct-${i}`} checked={q.correctIndex === n} onChange={() => setQ(i, { correctIndex: n })} aria-label={`Option ${n + 1} is correct`} />
                  <input aria-label={`Question ${i + 1} option ${n + 1}`} data-testid={`q-${i}-opt-${n}`} value={o} onChange={(e) => setQ(i, { options: q.options.map((x, m) => (m === n ? e.target.value : x)) })} className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm" placeholder={`Option ${n + 1}`} />
                </div>
              ))}
              <div className="mt-2 flex gap-2">
                {q.options.length < 6 && <Button size="sm" variant="ghost" onClick={() => setQ(i, { options: [...q.options, ''] })}>Add option</Button>}
                {questions.length > 1 && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setQuestions((qs) => qs.filter((_, m) => m !== i))}>Remove question</Button>}
              </div>
            </fieldset>
          ))}
          <Button size="sm" variant="outline" icon={Plus} onClick={() => setQuestions((qs) => [...qs, { prompt: '', options: ['', ''], correctIndex: 0 }])}>Add question</Button>
          {form.errors.content && <p role="alert" data-testid="error-content" className="text-xs font-medium text-rose-700">{form.errors.content}</p>}
        </div>
      )}
    </FormModal>
  );
}

function PathDetail({ id, onClose, onChanged }) {
  const state = useFetch(() => api.get(`/learning/paths/${id}`), [id]);
  const [modal, setModal] = useState(null);
  const refresh = () => { setModal(null); state.reload({ silent: true }); onChanged(); };

  return (
    <Modal open onClose={onClose} size="xl" testId="path-detail" title={state.data?.path?.title || 'Learning Path'}>
      <StateView state={state}>
        {({ path, modules = [] }) => {
          const documents = path.documents || [];
          return (
            <div className="space-y-6">
              {/* Path Overview Banner */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-700 max-w-2xl">{path.description || 'No description provided.'}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {path.dueDate && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                        <Calendar className="h-3.5 w-3.5 text-amber-600" />
                        Due: {fmtDate(path.dueDate)}
                      </span>
                    )}
                    {path.reminder?.enabled && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-900">
                        <Bell className="h-3.5 w-3.5 text-blue-600" />
                        Reminder: {path.reminder.daysBefore}d before
                      </span>
                    )}
                  </div>
                </div>
                {path.reminder?.note && (
                  <p className="text-xs text-blue-800 italic bg-blue-100/60 p-2 rounded border border-blue-200">
                    Reminder Note: {path.reminder.note}
                  </p>
                )}
              </div>

              {/* SECTION: Reference Documents & Learning Resources */}
              <SectionCard
                title="Reference Documents & Materials"
                headingLevel={3}
                actions={
                  <Button size="sm" variant="outline" icon={Plus} onClick={() => setModal({ type: 'doc', targetType: 'path', targetId: id })} data-testid="add-path-doc">
                    Add Document
                  </Button>
                }
              >
                {documents.length === 0 ? (
                  <p className="text-sm text-slate-500 py-3 text-center">No reference documents attached to this path yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {documents.map((doc, idx) => (
                      <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-1 hover:border-slate-300">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-brand-600 shrink-0" />
                            <h5 className="font-semibold text-slate-900 text-sm">{doc.title}</h5>
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                            {doc.fileType}
                          </span>
                        </div>
                        {doc.description && <p className="text-xs text-slate-600">{doc.description}</p>}
                        <div className="pt-1 flex items-center justify-between text-xs">
                          <span className="text-slate-400">{doc.addedAt ? fmtDate(doc.addedAt) : ''}</span>
                          {doc.url && (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline font-medium">
                              Open Resource <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* SECTION: Curriculum Modules */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Curriculum Modules & Lessons</h3>
                    <p className="text-xs text-slate-500">Modules unlock in sequential order for trainees.</p>
                  </div>
                  <Button size="sm" icon={Plus} onClick={() => setModal({ type: 'module' })} data-testid="add-module">
                    Add Module
                  </Button>
                </div>

                {modules.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-lg">
                    No curriculum modules added yet. Click "Add Module" to start structuring curriculum.
                  </p>
                ) : (
                  modules.map((m, mIdx) => {
                    const modDocs = m.documents || [];
                    return (
                      <SectionCard
                        key={m._id}
                        title={
                          <div className="flex flex-wrap items-center gap-2">
                            <span>Module {mIdx + 1}: {m.title}</span>
                            {m.dueDate && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">
                                <Calendar className="h-3 w-3" /> Due {fmtDate(m.dueDate)}
                              </span>
                            )}
                            {m.reminder?.enabled && (
                              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800 border border-blue-200">
                                <Bell className="h-3 w-3" /> {m.reminder.daysBefore}d reminder
                              </span>
                            )}
                          </div>
                        }
                        headingLevel={3}
                        testId={`module-${m._id}`}
                        actions={
                          <div className="flex items-center gap-2">
                            <Button size="xs" variant="outline" icon={Plus} onClick={() => setModal({ type: 'doc', targetType: 'module', targetId: m._id })} data-testid={`add-mod-doc-${m._id}`}>
                              Add Doc
                            </Button>
                            <Button size="xs" variant="primary" icon={Plus} onClick={() => setModal({ type: 'lesson', id: m._id })} data-testid={`add-lesson-${m._id}`}>
                              Add Lesson
                            </Button>
                          </div>
                        }
                      >
                        {m.description && <p className="text-xs text-slate-600 mb-3">{m.description}</p>}

                        {/* Module Documents */}
                        {modDocs.length > 0 && (
                          <div className="mb-4 rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
                            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Module Reference Docs</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {modDocs.map((md, mi) => (
                                <div key={mi} className="flex items-center justify-between gap-2 bg-white rounded border border-slate-200 px-2.5 py-1.5 text-xs">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                    <span className="font-medium text-slate-800 truncate">{md.title}</span>
                                  </div>
                                  {md.url && (
                                    <a href={md.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline shrink-0 flex items-center gap-0.5 font-medium">
                                      View <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Module Lessons */}
                        {m.lessons.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-2">No lessons in this module yet.</p>
                        ) : (
                          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-800">
                            {m.lessons.map((l) => (
                              <li key={l._id}>
                                <span className="font-medium">{l.title}</span>{' '}
                                <span className="text-xs text-slate-500">({l.contentType.toLowerCase()})</span>
                                {l.durationMinutes ? <span className="text-xs text-slate-400 ml-2">• {l.durationMinutes} mins</span> : null}
                              </li>
                            ))}
                          </ol>
                        )}
                      </SectionCard>
                    );
                  })
                )}
              </div>

              {modal?.type === 'module' && <ModuleModal pathId={id} onClose={() => setModal(null)} onDone={refresh} />}
              {modal?.type === 'lesson' && <LessonModal moduleId={modal.id} onClose={() => setModal(null)} onDone={refresh} />}
              {modal?.type === 'doc' && (
                <AddDocumentModal
                  targetType={modal.targetType}
                  targetId={modal.targetId}
                  onClose={() => setModal(null)}
                  onDone={refresh}
                />
              )}
            </div>
          );
        }}
      </StateView>
    </Modal>
  );
}

export function LearningPage() {
  const state = useFetch(() => api.get('/learning/paths'), []);
  const [modal, setModal] = useState(null);
  const cols = [
    {
      key: 'title',
      header: 'Learning Path',
      render: (p) => (
        <button
          type="button"
          className="text-left font-medium text-brand-800 hover:underline"
          onClick={() => setModal({ type: 'view', id: p._id })}
          data-testid={`path-open-${p._id}`}
        >
          {p.title}
        </button>
      )
    },
    { key: 'program', header: 'Program', render: (p) => p.programId?.title || 'Universal' },
    {
      key: 'dueDate',
      header: 'Due Date & Reminder',
      render: (p) => (
        <div className="space-y-0.5 text-xs">
          {p.dueDate ? (
            <span className="inline-flex items-center gap-1 font-medium text-slate-800">
              <Calendar className="h-3 w-3 text-amber-600" /> {fmtDate(p.dueDate)}
            </span>
          ) : (
            <span className="text-slate-400">Self-paced</span>
          )}
          {p.reminder?.enabled && (
            <div className="text-[11px] text-blue-700 flex items-center gap-1">
              <Bell className="h-2.5 w-2.5 text-blue-600" /> {p.reminder.daysBefore}d reminder
            </div>
          )}
        </div>
      )
    },
    { key: 'modules', header: 'Modules', render: (p) => p.modulesCount || 0 },
    { key: 'documents', header: 'Docs', render: (p) => p.documents?.length || 0 },
    { key: 'lessons', header: 'Lessons', render: (p) => p.lessonsCount || 0 }
  ];

  return (
    <>
      <PageHeader
        title="Learning Paths"
        description="Structured curriculum paths for interns and trainees. Configure modules, reference documents, and deadline reminders."
        actions={
          <Button icon={Plus} onClick={() => setModal({ type: 'new' })} data-testid="new-path">
            New Path
          </Button>
        }
      />
      <DataTable
        testId="paths-table"
        columns={cols}
        rows={state.data || []}
        loading={state.loading}
        error={state.error}
        onRetry={state.reload}
        caption="Learning paths"
        emptyTitle="No learning paths"
        emptyDescription="Create a path, then add modules, reference documents, and lessons."
      />
      {modal?.type === 'new' && (
        <PathModal onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload({ silent: true }); }} />
      )}
      {modal?.type === 'view' && (
        <PathDetail id={modal.id} onClose={() => setModal(null)} onChanged={() => state.reload({ silent: true })} />
      )}
    </>
  );
}
