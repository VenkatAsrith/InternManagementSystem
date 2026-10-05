import React from 'react';
import api from '../../lib/http';
import { useFetch } from '../../hooks/useFetch';
import { humanize } from '../../lib/format';
import { InlineAlert, PageHeader, ProgressBar, StateView } from '../../components/ui';
import { OnboardingChecklist } from '../../components/domain/OnboardingChecklist';

export function InternOnboardingPage() {
  const state = useFetch(() => api.get('/onboarding/my-plan'), []);
  return (
    <>
      <PageHeader title="Onboarding" description="Complete every required task to activate your internship." />
      <StateView state={state} loadingLabel="Loading your checklist...">
        {({ plan, tasks, internStatus }) => {
          const locked = !['PRE_ONBOARDING', 'ONBOARDING'].includes(internStatus);
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-slate-900">Progress</span><span data-testid="onboarding-percent" className="font-semibold text-slate-900">{plan.progress}%</span></div>
                <ProgressBar value={plan.progress} label="Onboarding progress" testId="onboarding-progress" />
                <p className="mt-2 text-xs text-slate-700">Status: {humanize(internStatus)}</p>
              </div>
              {internStatus === 'ACTIVE' && <InlineAlert tone="success" testId="onboarding-done">Onboarding is complete. Your internship is active.</InlineAlert>}
              <OnboardingChecklist tasks={tasks} mode="intern" locked={locked} onChanged={() => state.reload({ silent: true })} />
            </div>
          );
        }}
      </StateView>
    </>
  );
}
