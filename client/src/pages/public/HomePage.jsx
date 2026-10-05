import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Briefcase, Search } from 'lucide-react';
import api from '../../lib/http';
import { useFetch } from '../../hooks/useFetch';
import { fmtDate } from '../../lib/format';
import { LoadingBlock, ErrorState, EmptyState, StatusBadge } from '../../components/ui';

const LINK_PRIMARY = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-base font-medium text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2';
const LINK_SECONDARY = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-base font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:ring-offset-2';

export function OpeningCard({ opening }) {
  return (
    <article data-testid={`opening-card-${opening.slug}`} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{opening.title}</h3>
        <StatusBadge status="OPEN" label={opening.workMode?.replace('_', ' ')} tone="info" />
      </div>
      <p className="mt-1 text-sm text-slate-600">{opening.organizationId?.name}{opening.departmentId?.name ? ` - ${opening.departmentId.name}` : ''}</p>
      <p className="mt-3 line-clamp-3 text-sm text-slate-700">{opening.description}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div><dt className="font-semibold uppercase tracking-wide text-slate-600">Duration</dt><dd className="mt-0.5 text-slate-900">{opening.duration}</dd></div>
        <div><dt className="font-semibold uppercase tracking-wide text-slate-600">Apply by</dt><dd className="mt-0.5 text-slate-900">{fmtDate(opening.deadline)}</dd></div>
        {opening.stipend && <div><dt className="font-semibold uppercase tracking-wide text-slate-600">Stipend</dt><dd className="mt-0.5 text-slate-900">{opening.stipend}</dd></div>}
        {opening.location && <div><dt className="font-semibold uppercase tracking-wide text-slate-600">Location</dt><dd className="mt-0.5 text-slate-900">{opening.location}</dd></div>}
      </dl>
      <div className="mt-5 flex flex-wrap gap-2 pt-1">
        <Link to={`/internships/${opening.slug}`} className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600" data-testid={`opening-view-${opening.slug}`}>View details</Link>
        <Link to={`/apply/${opening.slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2" data-testid={`opening-apply-${opening.slug}`}>Apply <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
    </article>
  );
}

export function HomePage() {
  const state = useFetch(() => api.get('/recruitment/openings/public'), []);
  const openings = state.data || [];
  return (
    <>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
          <h1 data-testid="page-title" className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Start your career with real engineering work</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-700 sm:text-lg">TechMecha Torque internships pair you with a mentor, real projects and a verifiable certificate when you finish.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/internships" className={LINK_PRIMARY} data-testid="home-browse"><Briefcase className="h-5 w-5" aria-hidden="true" /> Browse internships</Link>
            <Link to="/application/status" className={LINK_SECONDARY} data-testid="home-track"><Search className="h-5 w-5" aria-hidden="true" /> Track my application</Link>
            <Link to="/verify/certificate" className={LINK_SECONDARY} data-testid="home-verify"><BadgeCheck className="h-5 w-5" aria-hidden="true" /> Verify a certificate</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" aria-labelledby="open-roles">
        <div className="mb-6 flex items-end justify-between gap-3">
          <h2 id="open-roles" className="text-2xl font-bold text-slate-900">Open internships</h2>
          <Link to="/internships" className="text-sm font-medium text-brand-800 underline">See all</Link>
        </div>
        {state.loading && !state.data ? <LoadingBlock label="Loading openings..." /> : state.error ? <ErrorState error={state.error} onRetry={state.reload} /> : openings.length === 0 ? (
          <EmptyState title="No internships are open right now" description="New openings are published here as soon as they are available. Please check back soon." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="home-openings">
            {openings.slice(0, 3).map((o) => <OpeningCard key={o._id} opening={o} />)}
          </div>
        )}
      </section>
    </>
  );
}
