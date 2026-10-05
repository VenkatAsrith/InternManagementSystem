import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { EmptyState, ErrorState } from './Feedback';

/**
 * Data table with loading / error / empty states built in, so no list screen can show a blank page.
 *  columns: [{ key, header, render?(row), align?: 'left'|'right'|'center', className?, headerClassName? }]
 * The scroll wrapper is focusable + labelled so wide tables stay usable on phones and by keyboard.
 */
export function DataTable({
  columns, rows, rowKey = (r) => r._id, loading = false, error, onRetry, emptyTitle = 'Nothing here yet',
  emptyDescription, emptyAction, caption, testId = 'data-table', onRowClick, rowTestId
}) {
  if (error && !rows?.length) return <ErrorState error={error} onRetry={onRetry} />;
  if (!loading && rows && rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} testId={`${testId}-empty`} />;

  const align = { left: 'text-left', right: 'text-right', center: 'text-center' };
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto" role="region" aria-label={caption || 'Data table'} tabIndex={0}>
        <table data-testid={testId} aria-busy={loading || undefined} className="min-w-full divide-y divide-slate-200 text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-700 ${align[c.align || 'left']} ${c.headerClassName || ''}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !rows?.length
              ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} data-testid="table-skeleton-row">
                  {columns.map((c) => <td key={c.key} className="px-4 py-3"><div className="h-4 w-full max-w-[10rem] animate-pulse rounded bg-slate-200" /></td>)}
                </tr>
              ))
              : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  data-testid={rowTestId ? rowTestId(row) : `row-${rowKey(row)}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`${onRowClick ? 'cursor-pointer' : ''} hover:bg-slate-50`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 align-middle text-slate-800 ${align[c.align || 'left']} ${c.className || ''}`}>
                      {c.render ? c.render(row) : (row[c.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Pagination({ pagination, onPage, className = '' }) {
  if (!pagination || pagination.totalPages <= 1) {
    return pagination ? <p data-testid="pagination-summary" className={`mt-3 text-xs text-slate-600 ${className}`}>{pagination.total} {pagination.total === 1 ? 'record' : 'records'}</p> : null;
  }
  const { page, totalPages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <nav aria-label="Pagination" className={`mt-3 flex flex-col items-center justify-between gap-2 sm:flex-row ${className}`}>
      <p data-testid="pagination-summary" className="text-xs text-slate-600">Showing {from}-{to} of {total}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} data-testid="page-prev">Previous</Button>
        <span className="text-xs text-slate-700" aria-current="page">Page {page} of {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)} data-testid="page-next">Next <ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
      </div>
    </nav>
  );
}
