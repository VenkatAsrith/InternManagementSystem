import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { downloadFile } from '../../lib/http';
import { useDebounced } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { cleanParams, fmtDateTime, humanize } from '../../lib/format';
import { Button, DataTable, FilterBar, PageHeader, Pagination, TextField } from '../../components/ui';

/** The audit log is append-only on the server. This screen can search and export it, never edit it. */
export function AuditLogsPage() {
  const toast = useToast();
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const a = useDebounced(action.trim());
  const ac = useDebounced(actor.trim());
  const filters = { action: a, actorEmail: ac, from, to };
  const list = useList('/audit-logs', { filters, limit: 50 });
  const exportCsv = async () => {
    const qs = new URLSearchParams(cleanParams(filters)).toString();
    try { await downloadFile(`/audit-logs/export${qs ? `?${qs}` : ''}`, 'audit-log.csv'); } catch (e) { toast.error(e.message); }
  };
  const cols = [
    { key: 'time', header: 'When', render: (l) => fmtDateTime(l.timestamp) }, { key: 'action', header: 'Action', render: (l) => <span className="font-mono text-xs">{l.action}</span> },
    { key: 'actor', header: 'Actor', render: (l) => <div><p>{l.actorEmail || 'System'}</p><p className="text-xs text-slate-600">{humanize(l.actorRole)}</p></div> },
    { key: 'entity', header: 'Record', render: (l) => <div><p>{humanize(l.entityType)}</p><p className="font-mono text-xs text-slate-600">{String(l.entityId).slice(-8)}</p></div> }, { key: 'ip', header: 'IP', render: (l) => l.ipAddress || '-' }
  ];
  return (
    <>
      <PageHeader title="Audit logs" description="An immutable record of who did what. Entries cannot be edited or deleted." actions={<Button variant="outline" icon={Download} onClick={exportCsv} data-testid="export-audit">Export CSV</Button>} />
      <FilterBar>
        <TextField name="action" label="Action" type="search" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. OFFER, LOGIN" />
        <TextField name="actor" label="Actor email" type="search" value={actor} onChange={(e) => setActor(e.target.value)} />
        <TextField name="from" label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField name="to" label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </FilterBar>
      <DataTable testId="audit-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(l) => l._id} caption="Audit log" emptyTitle="No matching events" emptyDescription="Adjust the filters." />
      <Pagination pagination={list.pagination} onPage={list.setPage} />
    </>
  );
}
