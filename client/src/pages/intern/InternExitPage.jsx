import React from 'react';
import { CheckCircle2, Circle, CircleDot, MinusCircle } from 'lucide-react';
import api from '../../lib/http';
import { useFetch } from '../../hooks/useFetch';
import { fmtDate, humanize } from '../../lib/format';
import { EmptyState, PageHeader, SectionCard, StateView } from '../../components/ui';

const ICON = { DONE: CheckCircle2, WAIVED: CheckCircle2, CURRENT: CircleDot, SKIPPED: MinusCircle, PENDING: Circle };

export function InternExitPage() {
  const state = useFetch(() => api.get('/exits/mine'), []);
  return (
    <>
      <PageHeader title="Exit status" description="Progress of your offboarding, if one has started." />
      {state.data === null && !state.loading && !state.error ? <EmptyState title="No exit in progress" description="You will see the steps here if your internship ends or an exit is started." testId="no-exit" /> : (
        <StateView state={state} loadingLabel="Loading...">
          {(exit) => (
            <SectionCard title={`Exit ${exit.exitId}`} testId="my-exit" description={`${humanize(exit.reason)} - last working day ${fmtDate(exit.lastWorkingDay)}`}>
              <ol className="space-y-2">
                {exit.stages.map((s) => {
                  const Icon = ICON[s.state] || Circle;
                  return <li key={s.stage} data-testid={`my-stage-${s.stage}`} data-state={s.state} className="flex items-center gap-3 text-sm"><Icon className={`h-5 w-5 ${s.state === 'CURRENT' ? 'text-brand-700' : s.state === 'DONE' || s.state === 'WAIVED' ? 'text-emerald-700' : 'text-slate-500'}`} aria-hidden="true" /><span className={s.state === 'CURRENT' ? 'font-semibold text-slate-900' : 'text-slate-800'}>{s.label}</span><span className="text-xs text-slate-600">{humanize(s.state)}</span></li>;
                })}
              </ol>
            </SectionCard>
          )}
        </StateView>
      )}
    </>
  );
}
