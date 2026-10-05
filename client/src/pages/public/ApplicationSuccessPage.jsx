import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch';
import { EmptyState, LoadingBlock } from '../../components/ui';
import { lookupApplication } from './ApplicationStatusPage';

/**
 * Confirmation is read back from the server by Application ID, so a refresh or a bookmarked link still shows
 * the truth, and a made-up id in the URL can never display a fake "submitted" screen.
 */
export function ApplicationSuccessPage() {
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const state = useFetch(() => lookupApplication(id), [id], { enabled: !!id });
  useEffect(() => { document.title = 'Application received - TMT IMS'; }, []);

  if (!id || state.error?.status === 404) {
    return <div className="mx-auto max-w-xl px-4 py-12"><EmptyState title="No application to show" description="We could not find that application." testId="success-missing" action={<Link to="/internships" className="text-sm font-medium text-brand-800 underline">Browse internships</Link>} /></div>;
  }
  if (state.loading && !state.data) return <div className="mx-auto max-w-xl px-4 py-12"><LoadingBlock label="Confirming your application..." /></div>;
  const a = state.data;
  if (!a) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-700" aria-hidden="true" />
      <h1 data-testid="page-title" className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Application received</h1>
      <p className="mt-2 text-sm text-slate-700">Thank you for applying for <strong>{a.opening?.title}</strong>. A confirmation email is on its way.</p>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Your Application ID</p>
        <p data-testid="application-id" className="mt-1 font-mono text-2xl font-bold tracking-wider text-slate-900">{a.applicationId}</p>
        <p className="mt-2 text-xs text-slate-600">Keep this ID. You need it to track your application.</p>
      </div>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to={`/application/status?id=${encodeURIComponent(a.applicationId)}`} className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2" data-testid="track-application">Track this application</Link>
        <Link to="/internships" className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600">More internships</Link>
      </div>
    </div>
  );
}
