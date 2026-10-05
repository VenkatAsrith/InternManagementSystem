import React, { useState } from 'react';
import api from '../../lib/http';
import { useFetch, useDebounced } from '../../hooks/useFetch';
import { cleanParams } from '../../lib/format';
import { EmptyState, ErrorState, LoadingBlock, TextField } from '../../components/ui';
import { OpeningCard } from './HomePage';

export function OpeningsPage() {
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim());
  const state = useFetch(() => api.get('/recruitment/openings/public', { params: cleanParams({ q: search }) }), [search]);
  const openings = state.data || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 data-testid="page-title" className="text-3xl font-bold tracking-tight text-slate-900">Internship openings</h1>
        <p className="mt-1 text-sm text-slate-700">Every listing below is open for applications today.</p>
      </header>
      <div className="mb-6 max-w-md" role="search">
        <TextField name="q" label="Search by title, skill or keyword" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. React, data, embedded" />
      </div>
      {state.loading && !state.data ? <LoadingBlock label="Loading openings..." /> : state.error ? <ErrorState error={state.error} onRetry={state.reload} /> : openings.length === 0 ? (
        <EmptyState title={search ? 'No openings match your search' : 'No internships are open right now'} description={search ? 'Try a different keyword.' : 'Please check back soon.'} testId="openings-empty" />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="openings-list" aria-live="polite">
          {openings.map((o) => <OpeningCard key={o._id} opening={o} />)}
        </div>
      )}
    </div>
  );
}
