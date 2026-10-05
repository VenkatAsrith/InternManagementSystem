import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/http';
import { useFetch } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { fmtDate, fullName, humanize } from '../../lib/format';
import { ONBOARDING_STATUS } from '@shared/constants.js';
import { Button, DataTable, FilterBar, Modal, PageHeader, Pagination, ProgressBar, SelectField, StateView, StatusBadge } from '../../components/ui';
import { OnboardingChecklist } from '../../components/domain/OnboardingChecklist';

function PlanModal({ planId, onClose, onChanged }) {
  const state = useFetch(() => api.get(`/onboarding/${planId}`), [planId]);
  return (
    <Modal open onClose={onClose} size="xl" testId="plan-modal" title="Onboarding checklist">
      <StateView state={state}>
        {({ plan, tasks }) => (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{fullName(plan.candidateId)} <span className="font-mono text-xs text-slate-600">{plan.internId?.internId}</span></p>
                <p className="text-xs text-slate-700">Intern status: {humanize(plan.internId?.status)}</p>
              </div>
              <div className="w-48"><ProgressBar value={plan.progress} label="Onboarding progress" testId="plan-progress" /><p className="mt-1 text-right text-xs text-slate-700">{plan.progress}% complete</p></div>
            </div>
            <OnboardingChecklist tasks={tasks} mode="staff" locked={!['PRE_ONBOARDING', 'ONBOARDING'].includes(plan.internId?.status)} onChanged={() => { state.reload({ silent: true }); onChanged(); }} />
          </>
        )}
      </StateView>
    </Modal>
  );
}

export function OnboardingPage() {
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(null);
  const list = useList('/onboarding', { filters: { status } });
  const cols = [
    { key: 'intern', header: 'Intern', render: (p) => <div><p className="font-medium text-slate-900">{fullName(p.candidateId)}</p><p className="text-xs text-slate-600">{p.candidateId?.email}</p></div> },
    { key: 'internId', header: 'Intern ID', render: (p) => <span className="font-mono text-xs">{p.internId?.internId || '-'}</span> },
    { key: 'start', header: 'Start date', render: (p) => fmtDate(p.offerId?.startDate || p.internId?.startDate) },
    { key: 'progress', header: 'Progress', render: (p) => <div className="w-36"><ProgressBar value={p.progress} label={`Progress ${p.progress}%`} /><span className="text-xs text-slate-700">{p.progress}%</span></div> },
    { key: 'status', header: 'Plan', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'internStatus', header: 'Intern status', render: (p) => <StatusBadge status={p.internId?.status} /> },
    { key: 'actions', header: 'Actions', align: 'right', render: (p) => (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(p._id)} data-testid={`plan-open-${p.internId?.internId || p._id}`}>Checklist</Button>
        {p.internId?._id && <Link to={`/admin/interns/${p.internId._id}`} className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-brand-800 underline">Profile</Link>}
      </div>
    ) }
  ];
  return (
    <>
      <PageHeader title="Onboarding" description="Interns become active automatically when every required task is complete." />
      <FilterBar><SelectField name="status" label="Plan status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All" options={Object.values(ONBOARDING_STATUS).map((s) => ({ value: s, label: humanize(s) }))} /></FilterBar>
      <DataTable testId="onboarding-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} caption="Onboarding plans" emptyTitle="No onboarding plans" emptyDescription="A plan is created automatically when an offer is accepted." />
      <Pagination pagination={list.pagination} onPage={list.setPage} />
      {open && <PlanModal planId={open} onClose={() => setOpen(null)} onChanged={() => list.reload({ silent: true })} />}
    </>
  );
}
