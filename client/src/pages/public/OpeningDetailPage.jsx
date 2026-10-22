import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import api from '../../lib/http';
import { useFetch } from '../../hooks/useFetch';
import { fmtDate } from '../../lib/format';
import { DetailList, ErrorState, LoadingBlock, SectionCard, EmptyState } from '../../components/ui';

function Chips({ items }) {
  if (!items?.length) return <p className="text-sm text-slate-600">Not specified.</p>;
  return <ul className="flex flex-wrap gap-2">{items.map((s) => <li key={s} className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-800">{s}</li>)}</ul>;
}

export function OpeningDetailPage() {
  const { slug } = useParams();
  const state = useFetch(() => api.get(`/recruitment/openings/public/${encodeURIComponent(slug)}`), [slug]);
  const o = state.data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/internships" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All internships</Link>
      {state.loading && !o ? <LoadingBlock label="Loading opening..." /> : state.error?.status === 404 ? (
        <EmptyState title="This opening is not available" description="It may have closed, passed its deadline or the link is wrong." testId="opening-unavailable"
          action={<Link to="/internships" className="text-sm font-medium text-brand-800 underline">Browse open internships</Link>} />
      ) : state.error ? <ErrorState error={state.error} onRetry={state.reload} /> : o && (
        <>
          <header className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-700">{o.organizationId?.name}{o.departmentId?.name ? ` - ${o.departmentId.name}` : ''}</p>
            <h1 data-testid="page-title" className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{o.title}</h1>
            <div className="mt-5"><DetailList cols={3} items={[
              { label: 'Work mode', value: o.workMode?.replace('_', ' ') },
              { label: 'Location', value: o.location || 'Not specified' },
              { label: 'Duration', value: o.duration },
              { label: 'Program Cost', value: 'Free (No fee charged)' },
              { label: 'Stipend', value: o.stipend || 'Not specified' },
              { label: 'Apply by', value: fmtDate(o.deadline), testId: 'opening-deadline' }
            ]} /></div>
            <Link to={`/apply/${o.slug}`} data-testid="apply-button" className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-6 text-base font-medium text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2">Apply for this internship <ArrowRight className="h-5 w-5" aria-hidden="true" /></Link>
          </header>
          <div className="space-y-5">
            <SectionCard title="About the role"><p className="whitespace-pre-line text-sm text-slate-800">{o.description}</p></SectionCard>
            {o.responsibilities?.length > 0 && <SectionCard title="Responsibilities"><ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-800">{o.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul></SectionCard>}
            <div className="grid gap-5 md:grid-cols-2">
              <SectionCard title="Required skills"><Chips items={o.requiredSkills} /></SectionCard>
              <SectionCard title="Nice to have"><Chips items={o.preferredSkills} /></SectionCard>
            </div>
            <SectionCard title="Eligibility"><p className="text-sm text-slate-800">{o.eligibility}</p></SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
