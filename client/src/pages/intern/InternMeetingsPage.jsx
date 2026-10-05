import React, { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import api from '../../lib/http';
import { useFetch } from '../../hooks/useFetch';
import { fmtDate, fullName, humanize } from '../../lib/format';
import { DataTable, PageHeader, StatusBadge } from '../../components/ui';

export function MeetingLink({ url }) {
  const [copied, setCopied] = useState(false);
  if (!url) return <span className="text-slate-400">-</span>;

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="open-meeting-link"
        className="inline-flex items-center gap-1 rounded bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100 transition"
      >
        Open Meeting <ExternalLink className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      <button
        type="button"
        onClick={handleCopy}
        data-testid="copy-meeting-link"
        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
        title="Copy Meeting Link"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-slate-500" />}
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  );
}

export function InternMeetingsPage() {
  const state = useFetch(() => api.get('/meetings'), []);
  const cols = [
    { key: 'title', header: 'Meeting', render: (m) => <div><p className="font-medium text-slate-900">{m.title}</p><p className="text-xs text-slate-600">{humanize(m.type)}</p></div> },
    { key: 'when', header: 'When', render: (m) => `${fmtDate(m.scheduledDate)}, ${m.startTime}-${m.endTime}` },
    { key: 'host', header: 'Host', render: (m) => fullName(m.mentorId) },
    { key: 'agenda', header: 'Agenda', render: (m) => <span className="line-clamp-2 max-w-xs">{m.agenda || '-'}</span> },
    { key: 'status', header: 'Status', render: (m) => <StatusBadge status={m.status} /> },
    { key: 'link', header: 'Link', render: (m) => (['SCHEDULED', 'RESCHEDULED', 'STARTED'].includes(m.status) ? <MeetingLink url={m.meetingLink} /> : '-') }
  ];
  return (
    <>
      <PageHeader title="Meetings" description="Meetings your mentor or program manager scheduled with you." />
      <DataTable testId="my-meetings-table" columns={cols} rows={state.data || []} loading={state.loading} error={state.error} onRetry={state.reload} caption="My meetings" emptyTitle="No meetings yet" emptyDescription="Scheduled 1-on-1s and team meetings appear here." />
    </>
  );
}
