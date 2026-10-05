import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { useForm, rules } from '../../hooks/useForm';
import { fmtDate, fullName, humanize, todayISO } from '../../lib/format';
import { ASSET_STATUS, ASSET_TYPE } from '@shared/constants.js';
import { Button, DataTable, FilterBar, FormGrid, FormModal, PageHeader, Pagination, SelectField, StatusBadge, TextAreaField, TextField } from '../../components/ui';

function NewAssetModal({ onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ name: '', type: 'LAPTOP', serialNumber: '', specifications: '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="md" testId="asset-modal" title="Register asset" submitLabel="Register" form={form} rules={{ name: [rules.required('Name'), rules.max(150, 'Name')] }}
      onSubmit={(v) => api.post('/assets', { name: v.name.trim(), type: v.type, ...(v.serialNumber.trim() ? { serialNumber: v.serialNumber.trim() } : {}), ...(v.specifications.trim() ? { specifications: v.specifications.trim() } : {}) })}
      onDone={() => { toast.success('Asset registered'); onDone(); }}>
      <FormGrid>
        <TextField {...f('name')} label="Name" required placeholder="MacBook Pro 14" />
        <SelectField {...f('type')} label="Type" options={Object.values(ASSET_TYPE).map((t) => ({ value: t, label: humanize(t) }))} />
        <TextField {...f('serialNumber')} label="Serial number" hint="Must be unique." />
        <div />
        <TextAreaField {...f('specifications')} label="Specifications" rows={2} className="sm:col-span-2" />
      </FormGrid>
    </FormModal>
  );
}

function AssignModal({ asset, onClose, onDone }) {
  const toast = useToast();
  const interns = useFetch(() => api.get('/interns', { params: { open: true, limit: 200 } }), []);
  const form = useForm({ internId: '', returnDueDate: '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="sm" testId="assign-modal" title={`Assign ${asset.name}`} description={asset.assetTag} submitLabel="Assign" form={form} rules={{ internId: rules.required('Intern') }}
      onSubmit={(v) => api.post(`/assets/${asset._id}/assign`, { internId: v.internId, ...(v.returnDueDate ? { returnDueDate: v.returnDueDate } : {}) })}
      onDone={() => { toast.success('Asset assigned. The intern was notified.'); onDone(); }}>
      <SelectField {...f('internId')} label="Intern" required placeholder="Select an intern" options={(interns.data || []).map((i) => ({ value: i._id, label: `${fullName(i.userId)} (${i.internId})` }))} />
      <TextField {...f('returnDueDate')} label="Return by" type="date" min={todayISO()} />
    </FormModal>
  );
}

function ReturnModal({ asset, onClose, onDone }) {
  const toast = useToast();
  const form = useForm({ outcome: 'RETURNED', conditionNotes: '' });
  const f = form.field;
  return (
    <FormModal open onClose={onClose} size="sm" testId="return-modal" title={`Record return: ${asset.name}`} description="Record the actual condition you observed." submitLabel="Record return" form={form} rules={{ conditionNotes: [rules.required('Condition notes'), rules.min(3, 'Condition notes')] }}
      onSubmit={(v) => api.post(`/assets/${asset._id}/return`, { outcome: v.outcome, conditionNotes: v.conditionNotes.trim() })}
      onDone={() => { toast.success('Return recorded'); onDone(); }}>
      <SelectField {...f('outcome')} label="Outcome" options={[{ value: 'RETURNED', label: 'Returned in usable condition' }, { value: 'DAMAGED', label: 'Returned damaged' }, { value: 'LOST', label: 'Lost' }]} />
      <TextAreaField {...f('conditionNotes')} label="Condition notes" required rows={3} />
    </FormModal>
  );
}

export function AssetsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [modal, setModal] = useState(null);
  const list = useList('/assets', { filters: { status, type } });
  const close = () => setModal(null);
  const done = () => { close(); list.reload({ silent: true }); };
  const manage = can('assets.manage');
  const cols = [
    { key: 'tag', header: 'Tag', render: (a) => <span className="font-mono text-xs font-semibold">{a.assetTag}</span> },
    { key: 'name', header: 'Asset', render: (a) => <div><p className="font-medium text-slate-900">{a.name}</p><p className="text-xs text-slate-600">{humanize(a.type)}{a.serialNumber ? ` - ${a.serialNumber}` : ''}</p></div> },
    { key: 'holder', header: 'Assigned to', render: (a) => (a.internId ? `${fullName(a.internId.userId)} (${a.internId.internId})` : '-') },
    { key: 'due', header: 'Return by', render: (a) => fmtDate(a.returnDueDate) },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
    { key: 'actions', header: '', align: 'right', render: (a) => manage && (
      <div className="flex justify-end gap-2">
        {a.status === 'AVAILABLE' && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'assign', a })} data-testid={`asset-assign-${a.assetTag}`}>Assign</Button>}
        {['ASSIGNED', 'RETURN_PENDING'].includes(a.status) && <Button size="sm" variant="outline" onClick={() => setModal({ type: 'return', a })} data-testid={`asset-return-${a.assetTag}`}>Record return</Button>}
      </div>
    ) }
  ];
  return (
    <>
      <PageHeader title="IT assets" description="Equipment inventory and who holds it. Assets must be returned before an exit can complete." actions={manage && <Button icon={Plus} onClick={() => setModal({ type: 'new' })} data-testid="new-asset">Register asset</Button>} />
      <FilterBar>
        <SelectField name="status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All" options={Object.values(ASSET_STATUS).map((s) => ({ value: s, label: humanize(s) }))} />
        <SelectField name="type" label="Type" value={type} onChange={(e) => setType(e.target.value)} placeholder="All" options={Object.values(ASSET_TYPE).map((s) => ({ value: s, label: humanize(s) }))} />
      </FilterBar>
      <DataTable testId="assets-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(a) => a.assetTag} caption="Assets" emptyTitle="No assets registered" emptyDescription="Register equipment to track who holds it." />
      <Pagination pagination={list.pagination} onPage={list.setPage} />
      {modal?.type === 'new' && <NewAssetModal onClose={close} onDone={done} />}
      {modal?.type === 'assign' && <AssignModal asset={modal.a} onClose={close} onDone={done} />}
      {modal?.type === 'return' && <ReturnModal asset={modal.a} onClose={close} onDone={done} />}
    </>
  );
}
