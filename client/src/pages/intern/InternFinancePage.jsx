import React, { useState } from 'react';
import { Download } from 'lucide-react';
import api, { downloadFile } from '../../lib/http';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { fmtDate, fmtMoney, humanize } from '../../lib/format';
import { Button, DataTable, DetailList, InlineAlert, Modal, PageHeader, SectionCard, StateView, StatCard, StatusBadge } from '../../components/ui';

function Statement({ id, onClose }) {
  const state = useFetch(() => api.get(`/finance/payments/${id}`), [id]);
  return (
    <Modal open onClose={onClose} size="lg" testId="statement-modal" title="Stipend statement">
      <StateView state={state}>
        {({ payment: p, ledger }) => (
          <div className="space-y-4">
            <DetailList cols={3} items={[{ label: 'Cycle', value: p.cycle }, { label: 'Working days', value: p.workingDays }, { label: 'Days paid', value: p.payableDays }, { label: 'Gross', value: fmtMoney(p.grossAmount, p.currency) }, { label: 'Deductions', value: fmtMoney(p.totalDeductions, p.currency) }, { label: 'Net payable', value: fmtMoney(p.netPayable, p.currency) }]} />
            <DataTable testId="statement-ledger" rows={ledger} caption="Ledger" emptyTitle="No entries" columns={[{ key: 'type', header: 'Type', render: (l) => humanize(l.type) }, { key: 'desc', header: 'Description', render: (l) => l.description }, { key: 'amt', header: 'Amount', align: 'right', render: (l) => fmtMoney(l.amount, l.currency) }]} />
          </div>
        )}
      </StateView>
    </Modal>
  );
}

export function InternFinancePage() {
  const toast = useToast();
  const state = useFetch(() => api.get('/finance/me'), []);
  const [open, setOpen] = useState(null);
  const payslip = async (p) => { try { await downloadFile(`/finance/payments/${p._id}/payslip`, `${p.paymentId}.pdf`); } catch (e) { toast.error(e.message); } };
  return (
    <>
      <PageHeader title="Stipend" description="Your stipend statements. Amounts are calculated by the system from your working days, attendance and approved leave." />
      <StateView state={state} loadingLabel="Loading your statements...">
        {(d) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard testId="total-earned" label="Total paid" value={fmtMoney(d.totalEarned, d.currency)} tone="emerald" />
              <StatCard testId="pending-balance" label="Pending" value={fmtMoney(d.pendingBalance, d.currency)} tone="amber" />
              <StatCard label="Plan" value={d.compensationPlan ? `${fmtMoney(d.compensationPlan.baseAmount, d.compensationPlan.currency)} ${humanize(d.compensationPlan.compensationType).toLowerCase()}` : 'Not set'} />
            </div>
            {!d.compensationPlan && <InlineAlert tone="info" testId="no-plan">Your compensation plan has not been set yet. Finance will add it before the first payroll run.</InlineAlert>}
            <SectionCard title="Statements">
              <DataTable testId="my-payments-table" rows={d.payments} rowKey={(p) => p.paymentId} caption="My payments" emptyTitle="No statements yet" emptyDescription="A statement appears after the first payroll run." columns={[
                { key: 'cycle', header: 'Cycle', render: (p) => p.cycle }, { key: 'net', header: 'Net payable', align: 'right', render: (p) => fmtMoney(p.netPayable, p.currency) },
                { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> }, { key: 'paid', header: 'Paid on', render: (p) => fmtDate(p.paidAt) },
                { key: 'actions', header: '', align: 'right', render: (p) => (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setOpen(p._id)} data-testid={`statement-${p.paymentId}`}>Details</Button>
                    {p.status === 'PAID' && <Button size="sm" variant="ghost" icon={Download} onClick={() => payslip(p)} data-testid={`payslip-${p.paymentId}`}>Payslip</Button>}
                  </div>
                ) }]} />
            </SectionCard>
          </div>
        )}
      </StateView>
      {open && <Statement id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
