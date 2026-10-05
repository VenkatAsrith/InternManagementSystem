import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { useFetch, useDebounced } from '../../hooks/useFetch';
import { useList } from '../../hooks/useList';
import { fmtDate, fullName } from '../../lib/format';
import { APPLICATION_STATUS } from '@shared/constants.js';
import { DataTable, FilterBar, PageHeader, Pagination, SelectField, StatusBadge, TextField } from '../../components/ui';
import { humanize } from '../../lib/format';

export function ApplicationsPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [openingId, setOpeningId] = useState('');
  const q = useDebounced(search.trim());
  const openings = useFetch(() => api.get('/recruitment/openings'), [], { enabled: can('openings.read') });
  const list = useList('/recruitment/applications', { filters: { search: q, stage, openingId } });

  const cols = [
    { key: 'applicationId', header: 'Application', render: (a) => <Link to={`/admin/applications/${a._id}`} className="font-mono text-xs font-semibold text-brand-800 underline" data-testid={`app-link-${a.applicationId}`}>{a.applicationId}</Link> },
    { key: 'candidate', header: 'Candidate', render: (a) => <div><p className="font-medium text-slate-900">{fullName(a.candidateId)}</p><p className="text-xs text-slate-600">{a.candidateId?.email}</p></div> },
    { key: 'opening', header: 'Position', render: (a) => a.openingId?.title || '-' },
    { key: 'education', header: 'College', render: (a) => a.candidateId?.education?.college || '-' },
    { key: 'status', header: 'Stage', render: (a) => <StatusBadge status={a.status} /> },
    { key: 'applied', header: 'Applied', render: (a) => fmtDate(a.createdAt) }
  ];

  return (
    <>
      <PageHeader title="Applications" description="Every application to your openings, from first contact to offer." />
      <FilterBar>
        <TextField name="search" label="Search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or application ID" />
        <SelectField name="stage" label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} placeholder="All stages" options={Object.values(APPLICATION_STATUS).map((s) => ({ value: s, label: humanize(s) }))} />
        <SelectField name="openingId" label="Opening" value={openingId} onChange={(e) => setOpeningId(e.target.value)} placeholder="All openings" options={(openings.data || []).map((o) => ({ value: o._id, label: o.title }))} />
      </FilterBar>
      <DataTable testId="applications-table" columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(a) => a.applicationId} caption="Applications"
        emptyTitle={q || stage || openingId ? 'No applications match these filters' : 'No applications yet'} emptyDescription={q || stage || openingId ? 'Clear a filter to see more.' : 'Applications submitted through the public portal appear here.'} />
      <Pagination pagination={list.pagination} onPage={list.setPage} />
    </>
  );
}
