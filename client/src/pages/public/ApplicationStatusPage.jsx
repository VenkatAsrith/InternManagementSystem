import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import api from '../../lib/http';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { Button, DetailList, InlineAlert, SectionCard, StatusBadge, TextField, Timeline } from '../../components/ui';

const APP_ID_RE = /^APP-\d{4}-\d{6}$/i;

export function lookupApplication(id) {
  return api.get(`/recruitment/applications/public/status/${encodeURIComponent(id.trim().toUpperCase())}`);
}

export function ApplicationStatusView({ result }) {
  return (
    <SectionCard title={`Application ${result.applicationId}`} testId="status-result" actions={<StatusBadge status={result.status} />}>
      <DetailList cols={2} items={[
        { label: 'Position', value: result.opening?.title },
        { label: 'Organization', value: result.organization?.name },
        { label: 'Applied on', value: fmtDate(result.appliedDate) },
        { label: 'Current stage', value: <StatusBadge status={result.status} /> }
      ]} />
      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Progress</h3>
      <Timeline items={(result.timeline || []).map((t, i) => ({ key: i, title: t.stage.replace(/_/g, ' '), meta: fmtDateTime(t.timestamp) }))} />
    </SectionCard>
  );
}

export function ApplicationStatusPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('id') || '';
  const [id, setId] = useState(initial);
  const [error, setError] = useState('');
  const [state, setState] = useState({ loading: false, result: null, notFound: false, failure: null });

  const run = async (value) => {
    setError('');
    if (!APP_ID_RE.test(value.trim())) {
      setState({ loading: false, result: null, notFound: false, failure: null });
      setError('Enter your Application ID in the format APP-2026-000123');
      return;
    }
    setState({ loading: true, result: null, notFound: false, failure: null });
    try {
      const res = await lookupApplication(value);
      setState({ loading: false, result: res.data, notFound: false, failure: null });
    } catch (e) {
      setState({ loading: false, result: null, notFound: e.status === 404, failure: e.status === 404 ? null : e });
    }
  };

  // Runs once for a shareable ?id= link.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (initial) run(initial); }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    if (state.loading) return;
    setParams(id.trim() ? { id: id.trim().toUpperCase() } : {}, { replace: true });
    run(id);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 data-testid="page-title" className="text-3xl font-bold tracking-tight text-slate-900">Track your application</h1>
      <p className="mt-1 text-sm text-slate-700">Enter the Application ID from your confirmation email.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col items-start gap-3 sm:flex-row" data-testid="status-form" role="search">
        <TextField name="applicationId" label="Application ID" value={id} onChange={(e) => setId(e.target.value)} error={error} placeholder="APP-2026-000123" className="w-full sm:flex-1" autoComplete="off" />
        <Button type="submit" icon={Search} loading={state.loading} className="sm:mt-[1.625rem]" data-testid="status-submit">Check status</Button>
      </form>
      <div className="mt-6" aria-live="polite">
        {state.notFound && <InlineAlert tone="warning" title="Application not found" testId="status-not-found">We could not find an application with that ID. Check for typing mistakes and try again.</InlineAlert>}
        {state.failure && <InlineAlert tone="error" title="Could not check the status" testId="status-error">{state.failure.message}</InlineAlert>}
        {state.result && <ApplicationStatusView result={state.result} />}
      </div>
    </div>
  );
}
