import React, { useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/** One h1 per page. `testId` defaults to page-title so Cypress can assert the page loaded. */
export function PageHeader({ title, description, actions, breadcrumbs, testId = 'page-title' }) {
  useEffect(() => {
    if (typeof title === 'string' && title) document.title = `${title} - TMT IMS`;
  }, [title]);
  return (
    <header className="mb-6">
      {breadcrumbs && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
            {breadcrumbs.map((b, i) => (
              <li key={i} className="flex items-center gap-1">
                {b.to ? <Link to={b.to} className="hover:text-slate-900 hover:underline">{b.label}</Link> : <span aria-current="page" className="font-medium text-slate-900">{b.label}</span>}
                {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 data-testid={testId} className="text-2xl font-bold tracking-tight text-slate-900 break-words">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Card({ children, className = '', padded = true, ...props }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${padded ? 'p-5' : ''} ${className}`} {...props}>{children}</div>;
}

export function SectionCard({ title, description, actions, children, className = '', bodyClassName = '', testId, headingLevel = 2 }) {
  const H = `h${headingLevel}`;
  return (
    <section data-testid={testId} className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <H className="text-base font-semibold text-slate-900">{title}</H>
            {description && <p className="text-xs text-slate-600">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

const STAT_TONES = {
  slate: 'bg-slate-100 text-slate-700',
  sky: 'bg-sky-100 text-sky-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-800',
  purple: 'bg-purple-100 text-purple-800'
};

/** Numbers come from the API only. `value` null renders a dash, never a made-up figure. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'slate', testId, to }) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
        <p data-testid={testId ? `${testId}-value` : undefined} className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 break-words">{value ?? '-'}</p>
        {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
      </div>
      {Icon && <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${STAT_TONES[tone] || STAT_TONES.slate}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>}
    </div>
  );
  const cls = 'block rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
  return to
    ? <Link to={to} data-testid={testId} className={`${cls} hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600`}>{body}</Link>
    : <div data-testid={testId} className={cls}>{body}</div>;
}

/** Keyboard operable tabs (arrow keys, Home/End) with the correct ARIA roles. */
export function Tabs({ tabs, active, onChange, label = 'Sections', className = '' }) {
  const refs = useRef({});
  const onKey = (e, idx) => {
    let next = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    if (next !== null) {
      e.preventDefault();
      onChange(tabs[next].id);
      refs.current[tabs[next].id]?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} className={`flex gap-1 overflow-x-auto border-b border-slate-200 ${className}`}>
      {tabs.map((t, i) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            data-testid={`tab-${t.id}`}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-600 ${selected ? 'border-brand-600 text-slate-900' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
          >
            {t.label}
            {t.count !== undefined && t.count !== null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, active, children }) {
  if (id !== active) return null;
  return <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0} className="pt-5 focus:outline-none">{children}</div>;
}

/** Label/value pairs on a fixed 2-column rhythm so detail screens align like the forms do. */
export function DetailList({ items, cols = 2, className = '' }) {
  const map = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' };
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-4 ${map[cols]} ${className}`}>
      {items.filter(Boolean).map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{it.label}</dt>
          <dd data-testid={it.testId} className="mt-1 text-sm text-slate-900 break-words">{it.value ?? '-'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ name, className = 'h-9 w-9 text-xs' }) {
  const parts = String(name || '?').trim().split(/\s+/);
  const text = `${parts[0]?.[0] || '?'}${parts[1]?.[0] || ''}`.toUpperCase();
  return <span aria-hidden="true" className={`inline-flex flex-shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-800 ${className}`}>{text}</span>;
}

export function Timeline({ items, emptyText = 'No events yet.' }) {
  if (!items?.length) return <p className="text-sm text-slate-600">{emptyText}</p>;
  return (
    <ol className="relative space-y-5 border-l-2 border-slate-200 pl-5" data-testid="timeline">
      {items.map((it, i) => (
        <li key={it.key || i} className="relative">
          <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-500 ring-2 ring-slate-200" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-900">{it.title}</p>
          {it.meta && <p className="text-xs text-slate-600">{it.meta}</p>}
          {it.body && <p className="mt-1 text-sm text-slate-700 break-words">{it.body}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Filter bar: same grid as forms so search boxes and selects align with the table below. */
export function FilterBar({ children, className = '' }) {
  return <div role="search" className={`mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>{children}</div>;
}
