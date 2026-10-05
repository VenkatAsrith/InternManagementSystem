import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, CircleDot, MinusCircle, Plus } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, fmtMoney, fullName, humanize, todayISO } from '../../lib/format';
import { EXIT_REASON, EXIT_STATUS } from '@shared/constants.js';
import { Button, CheckboxField, DataTable, DetailList, FilterBar, FormGrid, FormModal, InlineAlert, Modal, PageHeader, Pagination, SelectField, StateView, StatusBadge, TextAreaField, TextField } from '../../components/ui';

const TERMINATIONS = ['TERMINATION_PERFORMANCE', 'TERMINATION_MISCONDUCT', 'ABSCONDED'];

function InitiateModal({ presetInternId, onClose, onDone }) {
  const toast = useToast();
  const interns = useFetch(() => api.get('/interns', { params: { open: true, limit: 200 } }), []);
  const form = useForm({ internId: presetInternId || '', reason: 'COMPLETION', lastWorkingDay: todayISO(), noticePeriodDays: 0, managerNotes: '', hrNotes: '', lorEligible: false });
  const f = form.field;
  const eligible = (interns.data || []).filter((i) => ['ACTIVE', 'PERFORMANCE_REVIEW'].includes(i.status));
  const termination = TERMINATIONS.includes(form.values.reason);
  return (
    <FormModal open onClose={onClose} size="lg" testId="initiate-exit-modal" title="Start exit" description="Starts the offboarding workflow. Each stage has an owner and must be completed in order." submitLabel="Start exit" submitVariant={termination ? 'danger' : 'primary'} form={form}
      rules={{ internId: rules.required('Intern'), lastWorkingDay: [rules.required('Last working day'), (v) => (v && v < todayISO() ? 'Last working day cannot be in the past' : null)], noticePeriodDays: rules.number('Notice period', { min: 0, max: 90 }) }}
      onSubmit={(v) => api.post('/exits/initiate', { internId: v.internId, reason: v.reason, lastWorkingDay: v.lastWorkingDay, noticePeriodDays: Number(v.noticePeriodDays) || 0, lorEligible: !!v.lorEligible, ...(v.managerNotes.trim() ? { managerNotes: v.managerNotes.trim() } : {}), ...(v.hrNotes.trim() ? { hrNotes: v.hrNotes.trim() } : {}) })}
      onDone={() => { toast.success('Exit workflow started'); onDone(); }}>
      {termination && <InlineAlert tone="warning" testId="termination-warning">Termination reasons revoke the intern's access immediately and cannot be cancelled. No certificate is issued.</InlineAlert>}
      <FormGrid>
        <SelectField {...f('internId')} label="Intern" required placeholder="Select an intern" className="sm:col-span-2" options={eligible.map((i) => ({ value: i._id, label: `${fullName(i.userId)} (${i.internId})` }))} hint="Only active interns can start an exit." />
        <SelectField {...f('reason')} label="Reason" options={Object.values(EXIT_REASON).map((r) => ({ value: r, label: humanize(r) }))} />
        <TextField {...f('lastWorkingDay')} label="Last working day" type="date" required min={todayISO()} />
        <TextField {...f('noticePeriodDays')} label="Notice period (days)" type="number" min="0" max="90" />
        <div className="pt-7"><CheckboxField name="lorEligible" label="Eligible for a letter of recommendation" checked={form.values.lorEligible} onChange={f('lorEligible').onChange} /></div>
        <TextAreaField {...f('managerNotes')} label="Manager notes" rows={2} className="sm:col-span-2" />
        <TextAreaField {...f('hrNotes')} label="HR notes" rows={2} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

const STATE_ICON = { DONE: CheckCircle2, WAIVED: CheckCircle2, CURRENT: CircleDot, SKIPPED: MinusCircle, PENDING: Circle };

function CancelExitModal({ exit, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ reason: '' });
  return (
    <FormModal open onClose={onClose} size="sm" testId="cancel-exit-modal" title="Cancel this exit?" description="The intern becomes active again." submitLabel="Cancel exit" submitVariant="danger" form={form} rules={{ reason: [rules.required('Reason'), rules.min(3, 'Reason')] }}
      onSubmit={(v) => api.post(`/exits/${exit._id}/cancel`, { reason: v.reason.trim() })} onDone={() => { toast.success('Exit cancelled'); onDone(); }}>
      <TextAreaField {...form.field('reason')} label="Reason" required rows={2} />
    </FormModal>
  );
}

function AdvanceForm({ view, onDone }) {
  const toast = useToast();
  const { exit, blockers, permissions } = view;
  const form = useForm({ notes: '', waive: false, waiveReason: '' });
  const f = form.field;
  const blocked = blockers.length > 0;
  const onSubmit = (e) => {
    e.preventDefault();
    form.submit({ waiveReason: (v, a) => (a.waive && String(v).trim().length < 5 ? 'Give a reason of at least 5 characters' : null) }, async (v) => {
      const res = await api.post(`/exits/${exit._id}/advance`, { ...(v.notes.trim() ? { notes: v.notes.trim() } : {}), ...(blocked && v.waive ? { waive: true, waiveReason: v.waiveReason.trim() } : {}) });
      toast.success(res.message);
      onDone(res.data);
    });
  };
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="advance-form">
      <h3 className="text-sm font-semibold text-slate-900">Complete this stage</h3>
      {blocked && (
        <InlineAlert tone="warning" title="Blocked" testId="exit-blockers">
          <ul className="list-disc pl-5">{blockers.map((b) => <li key={b.code} data-testid={`blocker-${b.code}`}>{b.message}</li>)}</ul>
        </InlineAlert>
      )}
      {form.formError && <InlineAlert tone="error" testId="advance-error">{form.formError.message}</InlineAlert>}
      <TextAreaField {...f('notes')} label="Notes" rows={2} />
      {blocked && permissions.canWaive && (
        <>
          <CheckboxField name="waive" label="Waive the blocking conditions" hint="HR and administrators only. The waiver and your reason are recorded." checked={form.values.waive} onChange={f('waive').onChange} />
          {form.values.waive && <TextAreaField {...f('waiveReason')} label="Reason for waiving" required rows={2} />}
        </>
      )}
      <Button type="submit" loading={form.submitting} disabled={blocked && !form.values.waive} data-testid="advance-submit">Complete {view.stages.find((s) => s.stage === view.currentStage)?.label}</Button>
    </form>
  );
}

function ExitDetail({ id, onClose, onChanged }) {
  const state = useFetch(() => api.get(`/exits/${id}`), [id]);
  const [cancel, setCancel] = useState(false);
  const refresh = () => { setCancel(false); state.reload({ silent: true }); onChanged(); };
  return (
    <Modal open onClose={onClose} size="xl" testId="exit-detail" title={state.data?.exit ? `Exit ${state.data.exit.exitId}` : 'Exit'}>
      <StateView state={state} loadingLabel="Loading exit...">
        {(view) => {
          const { exit, intern, stages, permissions } = view;
          const closed = !!(exit.completedAt || exit.cancelledAt);
          const cur = stages.find((s) => s.state === 'CURRENT');
          return (
            <div className="space-y-5">
              <DetailList cols={3} items={[
                { label: 'Intern', value: `${fullName(intern?.userId)} (${intern?.internId})` }, { label: 'Reason', value: humanize(exit.reason) }, { label: 'Last working day', value: fmtDate(exit.lastWorkingDay) },
                { label: 'Notice period', value: `${exit.noticePeriodDays} days` }, { label: 'Stage', value: <StatusBadge status={exit.cancelledAt ? 'CANCELLED' : exit.status} testId="exit-stage" /> }, { label: 'Certificate eligible', value: exit.certificateEligible ? 'Yes' : 'No' }
              ]} />
              {exit.cancelledAt && <InlineAlert tone="warning">This exit was cancelled: {exit.cancelReason}</InlineAlert>}
              <ol className="space-y-2" data-testid="exit-stages">
                {stages.map((s) => {
                  const Icon = STATE_ICON[s.state] || Circle;
                  return (
                    <li key={s.stage} data-testid={`stage-${s.stage}`} data-state={s.state} className={`flex items-start gap-3 rounded-lg border p-3 ${s.state === 'CURRENT' ? 'border-brand-600 bg-brand-50/40' : 'border-slate-200'}`}>
                      <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${s.state === 'CURRENT' ? 'text-brand-700' : s.state === 'DONE' || s.state === 'WAIVED' ? 'text-emerald-700' : 'text-slate-500'}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{s.label} <span className="ml-1 text-xs font-normal text-slate-600">{humanize(s.state)}{s.state === 'WAIVED' ? ` - ${s.waiveReason}` : ''}</span></p>
                        <p className="text-xs text-slate-700">Owner: {s.owner}. {s.action}</p>
                        {s.state === 'CURRENT' && <p className="mt-1 text-xs text-slate-600">Blocked when: {s.blockersDescription}</p>}
                        {s.notes && <p className="mt-1 text-xs text-slate-700">Notes: {s.notes}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {exit.finalSettlement && <DetailList cols={3} items={[{ label: 'Settlement paid', value: fmtMoney(exit.finalSettlement.paidTotal ?? exit.finalSettlement.total ?? 0) }, { label: 'Computed', value: fmtDate(exit.finalSettlement.computedAt) }]} />}
              {!closed && cur && permissions.canActOnCurrentStage && <AdvanceForm key={exit.status} view={view} onDone={refresh} />}
              {!closed && cur && !permissions.canActOnCurrentStage && <InlineAlert tone="info" testId="not-your-stage">The {cur.label} stage is owned by {cur.owner}. You can follow progress but not complete it.</InlineAlert>}
              {!closed && permissions.canCancel && ['EXIT_INITIATED', 'NOTICE_PERIOD', 'HANDOVER'].includes(exit.status) && !['TERMINATION_PERFORMANCE', 'TERMINATION_MISCONDUCT', 'ABSCONDED'].includes(exit.reason) && (
                <Button variant="outline" onClick={() => setCancel(true)} data-testid="cancel-exit">Cancel exit</Button>
              )}
              {cancel && <CancelExitModal exit={exit} onClose={() => setCancel(false)} onDone={refresh} />}
            </div>
          );
        }}
      </StateView>
    </Modal>
  );
}

export function ExitsPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null);
  const list = useList('/exits', { filters: { status } });
  const preset = params.get('initiate');
  useEffect(() => { if (preset && can('exit.initiate')) setModal({ type: 'new', preset }); }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { setModal(null); if (preset) setParams({}, { replace: true }); };
  const cols = [
    { key: 'exit', header: 'Exit', render: (x) => <button type="button" className="font-mono text-xs font-semibold text-brand-800 underline" onClick={() => setModal({ type: 'view', id: x._id })} data-testid={`exit-open-${x.exitId}`}>{x.exitId}</button> },
    { key: 'intern', header: 'Intern', render: (x) => <div><p className="font-medium text-slate-900">{fullName(x.internId?.userId)}</p><p className="font-mono text-xs text-slate-600">{x.internId?.internId}</p></div> },
    { key: 'reason', header: 'Reason', render: (x) => humanize(x.reason) }, { key: 'lwd', header: 'Last day', render: (x) => fmtDate(x.lastWorkingDay) },
    { key: 'stage', header: 'Stage', render: (x) => <StatusBadge status={x.cancelledAt ? 'CANCELLED' : x.status} /> }
  ];
  return (
    <>
      <PageHeader title="Exit & offboarding" description="A nine-stage workflow with an owner and blocking checks at each stage. Certificates are issued only for completion-type exits."
        actions={can('exit.initiate') && <Button icon={Plus} onClick={() => setModal({ type: 'new' })} data-testid="start-exit-button">Start exit</Button>} />
      <FilterBar><SelectField name="status" label="Stage" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All stages" options={Object.values(EXIT_STATUS).map((s) => ({ value: s, label: humanize(s) }))} /></FilterBar>
      <DataTable testId="exits-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(x) => x.exitId} caption="Exits" emptyTitle="No exits" emptyDescription="Start an exit from an intern profile or with the button above." />
      <Pagination pagination={list.pagination} onPage={list.setPage} />
      {modal?.type === 'new' && <InitiateModal presetInternId={modal.preset} onClose={close} onDone={() => { close(); list.reload({ silent: true }); }} />}
      {modal?.type === 'view' && <ExitDetail id={modal.id} onClose={() => setModal(null)} onChanged={() => list.reload({ silent: true })} />}
    </>
  );
}
