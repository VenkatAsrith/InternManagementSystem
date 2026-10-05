import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { usePrograms } from '../../hooks/useRefData';
import { Button, DataTable, FormGrid, FormModal, Modal, PageHeader, SectionCard, SelectField, StateView, TextAreaField, TextField } from '../../components/ui';

const LESSON_TYPES = ['ARTICLE', 'VIDEO', 'DOCUMENT', 'LINK', 'TEXT', 'ASSIGNMENT', 'QUIZ'].map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() }));

function PathModal({ onClose, onDone }) {
  const toast = useToast();
  const { programs } = usePrograms();
  const form = useForm({ title: '', description: '', programId: '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="sm" testId="path-modal" title="New learning path" submitLabel="Create path" form={form} rules={{ title: [rules.required('Title'), rules.max(150, 'Title')] }}
      onSubmit={(v) => api.post('/learning/paths', { title: v.title.trim(), description: v.description.trim(), ...(v.programId ? { programId: v.programId } : {}) })}
      onDone={() => { toast.success('Learning path created'); onDone(); }}>
      <TextField {...f('title')} label="Title" required />
      <SelectField {...f('programId')} label="Program" placeholder="Any program" options={programs.map((p) => ({ value: p._id, label: p.title }))} />
      <TextAreaField {...f('description')} label="Description" rows={3} />
    </FormModal>
  );
}

function ModuleModal({ pathId, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ title: '', description: '' });
  return (
    <FormModal open onClose={onClose} size="sm" testId="module-modal" title="New module" submitLabel="Add module" form={form} rules={{ title: rules.required('Title') }}
      onSubmit={(v) => api.post(`/learning/paths/${pathId}/modules`, { title: v.title.trim(), description: v.description.trim() })} onDone={() => { toast.success('Module added'); onDone(); }}>
      <TextField {...form.field('title')} label="Title" required />
      <TextAreaField {...form.field('description')} label="Description" rows={2} />
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
    <Modal open onClose={onClose} size="xl" testId="path-detail" title={state.data?.path?.title || 'Learning path'}>
      <StateView state={state}>
        {({ path, modules }) => (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><p className="text-sm text-slate-700">{path.description}</p><Button size="sm" icon={Plus} onClick={() => setModal({ type: 'module' })} data-testid="add-module">Add module</Button></div>
            {modules.length === 0 ? <p className="text-sm text-slate-600">No modules yet.</p> : modules.map((m) => (
              <SectionCard key={m._id} title={m.title} headingLevel={3} testId={`module-${m._id}`} actions={<Button size="sm" variant="outline" onClick={() => setModal({ type: 'lesson', id: m._id })} data-testid={`add-lesson-${m._id}`}>Add lesson</Button>}>
                {m.lessons.length === 0 ? <p className="text-sm text-slate-600">No lessons yet.</p> : <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-800">{m.lessons.map((l) => <li key={l._id}>{l.title} <span className="text-xs text-slate-600">({l.contentType.toLowerCase()})</span></li>)}</ol>}
              </SectionCard>
            ))}
            {modal?.type === 'module' && <ModuleModal pathId={id} onClose={() => setModal(null)} onDone={refresh} />}
            {modal?.type === 'lesson' && <LessonModal moduleId={modal.id} onClose={() => setModal(null)} onDone={refresh} />}
          </div>
        )}
      </StateView>
    </Modal>
  );
}

export function LearningPage() {
  const state = useFetch(() => api.get('/learning/paths'), []);
  const [modal, setModal] = useState(null);
  const cols = [
    { key: 'title', header: 'Path', render: (p) => <button type="button" className="text-left font-medium text-brand-800 underline" onClick={() => setModal({ type: 'view', id: p._id })} data-testid={`path-open-${p._id}`}>{p.title}</button> },
    { key: 'program', header: 'Program', render: (p) => p.programId?.title || 'Any' },
    { key: 'modules', header: 'Modules', render: (p) => p.modulesCount }, { key: 'lessons', header: 'Lessons', render: (p) => p.lessonsCount }
  ];
  return (
    <>
      <PageHeader title="Learning paths" description="Curricula for interns. Lessons unlock in order." actions={<Button icon={Plus} onClick={() => setModal({ type: 'new' })} data-testid="new-path">New path</Button>} />
      <DataTable testId="paths-table" columns={cols} rows={state.data || []} loading={state.loading} error={state.error} onRetry={state.reload} caption="Learning paths" emptyTitle="No learning paths" emptyDescription="Create a path, then add modules and lessons." />
      {modal?.type === 'new' && <PathModal onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload({ silent: true }); }} />}
      {modal?.type === 'view' && <PathDetail id={modal.id} onClose={() => setModal(null)} onChanged={() => state.reload({ silent: true })} />}
    </>
  );
}
