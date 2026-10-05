import React, { useState } from 'react';
import { Download, Plus } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useForm, rules } from '../../hooks/useForm';
import { cleanParams, fmtDate, fmtMoney, fullName, humanize, todayISO } from '../../lib/format';
import { COMPENSATION_TYPE, PAYMENT_STATUS } from '@shared/constants.js';
import { PAYMENT_TRANSITIONS } from '@shared/lifecycle.js';
import { Button, DataTable, DetailList, FilterBar, FormGrid, FormModal, Modal, PageHeader, Pagination, SelectField, StateView, StatCard, StatusBadge, TextAreaField, TextField } from '../../components/ui';

const currentCycle = () => todayISO().slice(0, 7);
const SKIP_REASON = {
  ALREADY_GENERATED: 'Already generated for this cycle', NO_COMPENSATION_PLAN: 'No active compensation plan', ENGAGEMENT_ENDED_BEFORE_CYCLE: 'Engagement ended before this cycle',
  NOTHING_PAYABLE: 'Nothing payable (no working days)', UNPAID: 'Unpaid internship', PERFORMANCE_BONUS: 'Bonus-only plan'
};

function GenerateModal({ onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ cycle: currentCycle() });
  const [result, setResult] = useState(null);
  if (result) {
    return (
      <Modal open onClose={onDone} size="md" testId="generate-result" title={`Stipend run ${result.cycle}`} footer={<Button onClick={onDone} data-testid="generate-done">Done</Button>}>
        <p className="text-sm text-slate-800" data-testid="generated-count">{result.generatedCount} payment(s) generated.</p>
        {result.skipped.length > 0 && <div className="mt-3"><h3 className="text-sm font-semibold text-slate-900">Skipped ({result.skipped.length})</h3><ul className="mt-1 space-y-1 text-sm text-slate-800" data-testid="skipped-list">{result.skipped.map((s, i) => <li key={i}>{s.internId}: {SKIP_REASON[s.reason] || humanize(s.reason)}</li>)}</ul></div>}
      </Modal>
    );
  }
  return (
    <FormModal open onClose={onClose} size="sm" testId="generate-modal" title="Generate stipend run" description="Amounts are calculated by the server from each intern's plan, working days, attendance and approved leave." submitLabel="Generate" form={form}
      rules={{ cycle: [rules.required('Cycle'), (v) => (v > currentCycle() ? 'A future cycle cannot be paid yet' : null)] }}
      onSubmit={(v) => api.post('/finance/generate-cycle', { cycle: v.cycle })} onDone={(res) => { toast.success(res.message); setResult(res.data); }}>
      <TextField {...form.field('cycle')} label="Cycle (month)" type="month" required max={currentCycle()} />
    </FormModal>
  );
}

function PlanModal({ onClose, onDone }) {
  const toast = useToast();
  const interns = useFetch(() => api.get('/interns', { params: { open: true, limit: 200 } }), []);
  const form = useForm({ internId: '', compensationType: 'MONTHLY_STIPEND', baseAmount: '', currency: 'INR', paymentFrequency: 'MONTHLY', accountHolderName: '', accountNumber: '', bankName: '', ifscOrRoutingCode: '' });
  const f = form.field;
  const unpaid = form.values.compensationType === 'UNPAID';
  return (
    <FormModal open onClose={onClose} size="lg" testId="plan-modal" title="Set compensation plan" description="Replaces the intern's current plan. Existing payments are not changed." submitLabel="Save plan" form={form}
      rules={{
        internId: rules.required('Intern'),
        baseAmount: [(v, a) => (a.compensationType !== 'UNPAID' && !(Number(v) > 0) ? 'Enter an amount greater than 0, or choose Unpaid' : null), rules.number('Amount', { min: 0 })],
        accountNumber: (v) => (v && !/^[0-9]{6,20}$/.test(v) ? 'Account number must be 6-20 digits' : null)
      }}
      onSubmit={(v) => {
        const body = { internId: v.internId, compensationType: v.compensationType, baseAmount: unpaid ? 0 : Number(v.baseAmount), currency: v.currency, paymentFrequency: v.paymentFrequency };
        const bank = { accountHolderName: v.accountHolderName.trim(), accountNumber: v.accountNumber.trim(), bankName: v.bankName.trim(), ifscOrRoutingCode: v.ifscOrRoutingCode.trim() };
        if (Object.values(bank).some(Boolean)) body.bankDetails = cleanParams(bank);
        return api.post('/finance/compensation', body);
      }}
      onDone={() => { toast.success('Compensation plan saved'); onDone(); }}>
      <FormGrid>
        <SelectField {...f('internId')} label="Intern" required placeholder="Select an intern" options={(interns.data || []).map((i) => ({ value: i._id, label: `${fullName(i.userId)} (${i.internId})` }))} className="sm:col-span-2" />
        <SelectField {...f('compensationType')} label="Type" options={Object.values(COMPENSATION_TYPE).map((t) => ({ value: t, label: humanize(t) }))} />
        <SelectField {...f('paymentFrequency')} label="Frequency" options={['MONTHLY', 'BI_WEEKLY', 'MILESTONE_BASED', 'ONE_TIME'].map((t) => ({ value: t, label: humanize(t) }))} />
        <TextField {...f('baseAmount')} label="Base amount" type="number" min="0" step="0.01" required={!unpaid} disabled={unpaid} value={unpaid ? 0 : form.values.baseAmount} />
        <SelectField {...f('currency')} label="Currency" options={['INR', 'USD', 'EUR', 'GBP']} />
        <TextField {...f('accountHolderName')} label="Account holder" />
        <TextField {...f('bankName')} label="Bank" />
        <TextField {...f('accountNumber')} label="Account number" inputMode="numeric" hint="Only the last 4 digits are stored." autoComplete="off" />
        <TextField {...f('ifscOrRoutingCode')} label="IFSC / routing code" />
      </FormGrid>
    </FormModal>
  );
}

function ProcessModal({ payment, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ paymentMethod: 'BANK_TRANSFER', paymentReference: '', notes: '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="sm" testId="process-modal" title="Record disbursement" description={`${payment.paymentId}: ${fmtMoney(payment.netPayable, payment.currency)}. The amount is fixed by the system.`} submitLabel="Mark as paid" submitVariant="success" form={form}
      rules={{ paymentReference: [rules.required('Payment reference'), rules.min(4, 'Payment reference'), (v) => (v && !/^[A-Za-z0-9][A-Za-z0-9\-_/.]+$/.test(v) ? 'Use letters, digits and - _ / .' : null)] }}
      onSubmit={(v) => api.post(`/finance/payments/${payment._id}/process`, { paymentMethod: v.paymentMethod, paymentReference: v.paymentReference.trim(), ...(v.notes.trim() ? { notes: v.notes.trim() } : {}) })}
      onDone={() => { toast.success('Payment recorded as paid'); onDone(); }}>
      <SelectField {...f('paymentMethod')} label="Method" options={['BANK_TRANSFER', 'DIRECT_DEPOSIT', 'UPI', 'CHECK', 'OTHER'].map((m) => ({ value: m, label: humanize(m) }))} />
      <TextField {...f('paymentReference')} label="Transaction reference" required hint="Must be unique." autoComplete="off" />
      <TextAreaField {...f('notes')} label="Notes" rows={2} />
    </FormModal>
  );
}

function AdjustModal({ payment, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ type: 'BONUS', amount: '', description: '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="sm" testId="adjust-modal" title="Add adjustment" description={`${payment.paymentId}. The new net payable is calculated by the system.`} submitLabel="Apply adjustment" form={form}
      rules={{ amount: [rules.required('Amount'), rules.number('Amount', { min: 0.01, max: 1000000 })], description: [rules.required('Description'), rules.min(3, 'Description')] }}
      onSubmit={(v) => api.post(`/finance/payments/${payment._id}/adjustments`, { type: v.type, amount: Number(v.amount), description: v.description.trim() })}
      onDone={() => { toast.success('Adjustment applied'); onDone(); }}>
      <SelectField {...f('type')} label="Type" options={[{ value: 'BONUS', label: 'Bonus (adds)' }, { value: 'REIMBURSEMENT', label: 'Reimbursement (adds)' }, { value: 'DEDUCTION', label: 'Deduction (subtracts)' }, { value: 'PENALTY', label: 'Penalty (subtracts)' }]} />
      <TextField {...f('amount')} label="Amount" type="number" min="0.01" step="0.01" required />
      <TextAreaField {...f('description')} label="Description" required rows={2} />
    </FormModal>
  );
}

function StatusModal({ payment, status, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ reason: '' });
  return (
    <FormModal open onClose={onClose} size="sm" testId="payment-status-modal" title={`Mark payment ${humanize(status).toLowerCase()}`} submitLabel="Confirm" submitVariant={['CANCELLED', 'WAIVED'].includes(status) ? 'danger' : 'primary'} form={form}
      rules={{ reason: [rules.required('Reason'), rules.min(3, 'Reason')] }} onSubmit={(v) => api.post(`/finance/payments/${payment._id}/status`, { status, reason: v.reason.trim() })} onDone={() => { toast.success(`Payment ${humanize(status).toLowerCase()}`); onDone(); }}>
      <TextAreaField {...form.field('reason')} label="Reason" required rows={2} />
    </FormModal>
  );
}

function PaymentDetail({ id, onClose }) {
  const state = useFetch(() => api.get(`/finance/payments/${id}`), [id]);
  return (
    <Modal open onClose={onClose} size="lg" testId="payment-detail" title="Payment statement">
      <StateView state={state}>
        {({ payment: p, ledger }) => (
          <div className="space-y-4">
            <DetailList items={[
              { label: 'Payment', value: p.paymentId }, { label: 'Cycle', value: p.cycle }, { label: 'Working days', value: p.workingDays }, { label: 'Payable days', value: p.payableDays },
              { label: 'Gross', value: fmtMoney(p.grossAmount, p.currency) }, { label: 'Additions', value: fmtMoney(p.totalAdditions, p.currency) }, { label: 'Deductions', value: fmtMoney(p.totalDeductions, p.currency) },
              { label: 'Net payable', value: <strong data-testid="detail-net">{fmtMoney(p.netPayable, p.currency)}</strong> }, { label: 'Status', value: <StatusBadge status={p.status} /> }, { label: 'Reference', value: p.paymentReference || '-' }
            ]} cols={3} />
            <DataTable testId="ledger-table" rows={ledger} caption="Ledger" emptyTitle="No ledger entries" columns={[
              { key: 'date', header: 'Date', render: (l) => fmtDate(l.createdAt) }, { key: 'type', header: 'Type', render: (l) => humanize(l.type) }, { key: 'desc', header: 'Description', render: (l) => l.description },
              { key: 'amt', header: 'Amount', align: 'right', render: (l) => fmtMoney(l.amount, l.currency) }]} />
          </div>
        )}
      </StateView>
    </Modal>
  );
}

export function FinancePage() {
  const { can } = useAuth();
  const toast = useToast();
  const [cycle, setCycle] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const state = useFetch(() => api.get('/finance/payments', { params: cleanParams({ cycle, status, page, limit: 20 }) }), [cycle, status, page]);
  const close = () => setModal(null);
  const done = () => { close(); state.reload({ silent: true }); };
  const manage = can('finance.manage');
  const processPerm = can('finance.process');
  const setF = (fn) => (e) => { fn(e.target.value); setPage(1); };

  const payslip = async (p) => { try { await downloadFile(`/finance/payments/${p._id}/payslip`, `${p.paymentId}.pdf`); } catch (e) { toast.error(e.message); } };

  const cols = [
    { key: 'id', header: 'Payment', render: (p) => <button type="button" className="font-mono text-xs font-semibold text-brand-800 underline" onClick={() => setModal({ type: 'view', id: p._id })} data-testid={`payment-open-${p.paymentId}`}>{p.paymentId}</button> },
    { key: 'intern', header: 'Intern', render: (p) => <div><p className="font-medium text-slate-900">{fullName(p.internId?.userId)}</p><p className="font-mono text-xs text-slate-600">{p.internId?.internId}</p></div> },
    { key: 'cycle', header: 'Cycle', render: (p) => p.cycle },
    { key: 'days', header: 'Days', render: (p) => `${p.payableDays}/${p.workingDays}` },
    { key: 'gross', header: 'Gross', align: 'right', render: (p) => fmtMoney(p.grossAmount, p.currency) },
    { key: 'net', header: 'Net payable', align: 'right', render: (p) => <span data-testid={`net-${p.paymentId}`}>{fmtMoney(p.netPayable, p.currency)}</span> },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'actions', header: '', align: 'right', render: (p) => (
      <div className="flex flex-wrap justify-end gap-2">
        {p.status === 'PENDING' && processPerm && p.netPayable > 0 && <Button size="sm" variant="success" onClick={() => setModal({ type: 'process', p })} data-testid={`pay-${p.paymentId}`}>Pay</Button>}
        {['PENDING', 'ON_HOLD'].includes(p.status) && manage && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'adjust', p })} data-testid={`adjust-${p.paymentId}`}>Adjust</Button>}
        {manage && (PAYMENT_TRANSITIONS[p.status] || []).filter((s) => s !== 'PAID').map((s) => <Button key={s} size="sm" variant="outline" onClick={() => setModal({ type: 'status', p, s })} data-testid={`payment-${s}-${p.paymentId}`}>{s === 'PENDING' ? 'Release' : humanize(s)}</Button>)}
        {p.status === 'PAID' && <Button size="sm" variant="ghost" icon={Download} onClick={() => payslip(p)} data-testid={`payslip-${p.paymentId}`}>Payslip</Button>}
      </div>
    ) }
  ];

  const totals = state.data?.totals;
  const cur = state.data?.payments?.[0]?.currency || 'INR';
  return (
    <>
      <PageHeader title="Finance & stipends" description="Stipends are calculated by the system from plans, working days, attendance and approved leave. Nothing on this screen accepts a typed-in stipend amount for a run."
        actions={manage && <><Button variant="outline" onClick={() => setModal({ type: 'plan' })} data-testid="set-plan">Set compensation plan</Button><Button icon={Plus} onClick={() => setModal({ type: 'generate' })} data-testid="generate-run">Generate stipend run</Button></>} />
      {totals && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="finance-totals">
          <StatCard testId="total-count" label="Payments" value={totals.count} />
          <StatCard testId="total-net" label="Net payable" value={fmtMoney(totals.net, cur)} />
          <StatCard testId="total-paid" label="Paid" value={fmtMoney(totals.paid, cur)} tone="emerald" />
          <StatCard testId="total-pending" label="Pending" value={fmtMoney(totals.pending, cur)} tone="amber" />
        </div>
      )}
      <FilterBar>
        <TextField name="cycle" label="Cycle" type="month" value={cycle} onChange={setF(setCycle)} max={currentCycle()} />
        <SelectField name="status" label="Status" value={status} onChange={setF(setStatus)} placeholder="All" options={Object.values(PAYMENT_STATUS).map((s) => ({ value: s, label: humanize(s) }))} />
      </FilterBar>
      <DataTable testId="payments-table" columns={cols} rows={state.data?.payments || []} loading={state.loading} error={state.error} onRetry={state.reload} rowKey={(p) => p.paymentId} caption="Payments" emptyTitle="No payments" emptyDescription="Set a compensation plan for each intern, then generate a stipend run." />
      {state.data && <Pagination pagination={{ page: state.data.pagination.page, limit: state.data.pagination.limit, total: state.data.pagination.total, totalPages: state.data.pagination.pages }} onPage={setPage} />}
      {modal?.type === 'generate' && <GenerateModal onClose={close} onDone={done} />}
      {modal?.type === 'plan' && <PlanModal onClose={close} onDone={done} />}
      {modal?.type === 'process' && <ProcessModal payment={modal.p} onClose={close} onDone={done} />}
      {modal?.type === 'adjust' && <AdjustModal payment={modal.p} onClose={close} onDone={done} />}
      {modal?.type === 'status' && <StatusModal payment={modal.p} status={modal.s} onClose={close} onDone={done} />}
      {modal?.type === 'view' && <PaymentDetail id={modal.id} onClose={close} />}
    </>
  );
}
