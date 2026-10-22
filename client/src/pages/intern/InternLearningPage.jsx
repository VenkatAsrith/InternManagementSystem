import React, { useState } from 'react';
import { CheckCircle2, Lock, ExternalLink, GraduationCap } from 'lucide-react';
import api from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useAction } from '../../hooks/useForm';
import { Button, EmptyState, ErrorState, InlineAlert, LoadingBlock, PageHeader, ProgressBar, SectionCard, StateView } from '../../components/ui';

function Quiz({ lesson, onDone }) {
  const toast = useToast();
  const [answers, setAnswers] = useState(lesson.quiz.questions.map(() => null));
  const [result, setResult] = useState(null);
  const act = useAction();
  const submit = () => act.run(async () => {
    if (answers.some((a) => a === null)) { toast.warning('Answer every question first'); return; }
    try {
      const res = await api.post(`/learning/lessons/${lesson._id}/quiz`, { answers });
      setResult(res.data);
      if (res.data.passed) { toast.success(res.message); onDone(); } else toast.warning(res.message);
    } catch (e) { toast.error(e.message); }
  });
  return (
    <div className="mt-3 space-y-4" data-testid={`quiz-${lesson._id}`}>
      {lesson.quiz.questions.map((q, i) => (
        <fieldset key={i}>
          <legend className="text-sm font-medium text-slate-900">{i + 1}. {q.prompt}</legend>
          <div className="mt-1.5 space-y-1">{q.options.map((o, n) => (
            <label key={n} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800"><input type="radio" name={`q-${lesson._id}-${i}`} checked={answers[i] === n} onChange={() => setAnswers((a) => a.map((x, m) => (m === i ? n : x)))} data-testid={`quiz-${i}-${n}`} />{o}</label>
          ))}</div>
        </fieldset>
      ))}
      <Button loading={act.pending} onClick={submit} data-testid={`quiz-submit-${lesson._id}`}>Submit answers</Button>
      {result && <InlineAlert tone={result.passed ? 'success' : 'warning'} testId="quiz-result">Score {result.score}% ({result.correct} of {result.total} correct). Pass mark {result.passScore}%.</InlineAlert>}
    </div>
  );
}

function Lesson({ lesson, onDone }) {
  const toast = useToast();
  const act = useAction();
  const [open, setOpen] = useState(false);
  const complete = () => act.run(async () => {
    try { await api.post(`/learning/lessons/${lesson._id}/complete`); toast.success('Lesson completed'); onDone(); } catch (e) { toast.error(e.message); onDone(); }
  });
  return (
    <li className="rounded-lg border border-slate-200 p-3" data-testid={`lesson-${lesson._id}`} data-locked={lesson.isLocked} data-completed={lesson.isCompleted}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          {lesson.isCompleted ? <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-label="Completed" /> : lesson.isLocked ? <Lock className="h-4 w-4 text-slate-600" aria-label="Locked" /> : null}
          {lesson.title} <span className="text-xs font-normal text-slate-600">({lesson.contentType.toLowerCase()}{lesson.durationMinutes ? `, ${lesson.durationMinutes} min` : ''})</span>
        </div>
        {!lesson.isLocked && !lesson.isCompleted && <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`lesson-open-${lesson._id}`}>{open ? 'Hide' : 'Open'}</Button>}
        {lesson.isLocked && <span className="text-xs text-slate-600">Complete the previous lesson first</span>}
      </div>
      {open && !lesson.isLocked && (
        <div className="mt-3 text-sm text-slate-800">
          {lesson.content && <p className="whitespace-pre-line">{lesson.content}</p>}
          {lesson.externalUrl && <p className="mt-2"><a href={lesson.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-800 underline">Open resource <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span></a></p>}
          {lesson.contentType === 'QUIZ' ? <Quiz lesson={lesson} onDone={onDone} /> : <Button className="mt-3" size="sm" variant="success" loading={act.pending} onClick={complete} data-testid={`lesson-complete-${lesson._id}`}>Mark as completed</Button>}
        </div>
      )}
    </li>
  );
}

function PathView({ id, onChanged }) {
  const state = useFetch(() => api.get(`/learning/paths/${id}`), [id]);
  return (
    <StateView state={state} loadingLabel="Loading path...">
      {({ path, modules }) => (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">{path.description}</p>
          {modules.map((m) => (
            <SectionCard key={m._id} title={m.title} headingLevel={3}>
              <ol className="space-y-2">{m.lessons.map((l) => <Lesson key={l._id} lesson={l} onDone={() => { state.reload({ silent: true }); onChanged(); }} />)}</ol>
            </SectionCard>
          ))}
        </div>
      )}
    </StateView>
  );
}

export function InternLearningPage() {
  const state = useFetch(() => api.get('/learning/paths'), []);
  const traineeState = useFetch(() => api.get('/training/trainee/my'), []);
  const [active, setActive] = useState(null);
  if (state.loading && !state.data) return <LoadingBlock label="Loading learning paths..." />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  const paths = state.data || [];
  const current = active || paths[0]?._id;

  const traineeData = traineeState.data || {};
  const learningUrl = traineeData?.engagement?.learningSpacesUrl || traineeData?.program?.learningSpacesUrl;
  const learningName = traineeData?.engagement?.learningSpacesName || traineeData?.program?.learningSpacesName || 'TechMecha Learning Spaces';
  const learningInstructions = traineeData?.program?.learningSpacesInstructions || '';

  return (
    <>
      <PageHeader title="Learning" description="Lessons unlock one after another. Quizzes are marked by the system." />

      {learningUrl && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-slate-50 p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="rounded-xl bg-brand-600 p-2.5 text-white shadow-sm shrink-0">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">{learningName}</h3>
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">Course Platform</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
                Your curriculum, coding sandbox, interactive assignments, and live modules are hosted on our learning spaces platform.
              </p>
              {learningInstructions && (
                <p className="text-xs text-slate-500 mt-1 italic">
                  Guide: {learningInstructions}
                </p>
              )}
            </div>
          </div>
          <a
            href={learningUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-700 transition shrink-0"
          >
            <ExternalLink className="h-4 w-4" /> Launch Learning Space
          </a>
        </div>
      )}

      {paths.length === 0 ? <EmptyState title="No learning paths yet" description="Your program manager will publish learning material here." /> : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Learning paths">
            {paths.map((p) => (
              <button key={p._id} role="listitem" type="button" onClick={() => setActive(p._id)} aria-pressed={current === p._id} data-testid={`path-${p._id}`}
                className={`rounded-xl border bg-white p-4 text-left shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 ${current === p._id ? 'border-brand-600' : 'border-slate-200 hover:border-slate-400'}`}>
                <p className="font-semibold text-slate-900">{p.title}</p>
                <p className="mt-1 text-xs text-slate-700">{p.completedCount} of {p.lessonsCount} lessons</p>
                <ProgressBar className="mt-2" value={p.progressPercent} label={`${p.title} progress`} />
              </button>
            ))}
          </div>
          {current && <PathView key={current} id={current} onChanged={() => state.reload({ silent: true })} />}
        </>
      )}
    </>
  );
}
