import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Inbox, Loader2, RefreshCw, ShieldOff, WifiOff, XCircle } from 'lucide-react';
import { Button } from './Button';

export function Spinner({ className = 'h-5 w-5', label = 'Loading' }) {
  return <Loader2 role="status" aria-label={label} className={`animate-spin text-slate-600 ${className}`} />;
}

export function LoadingBlock({ label = 'Loading...', className = '', testId = 'loading' }) {
  return (
    <div role="status" aria-live="polite" data-testid={testId} className={`flex items-center justify-center gap-3 py-12 text-sm text-slate-600 ${className}`}>
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Tells the user what failed and lets them retry. Never shows a blank screen after a failed load. */
export function ErrorState({ error, onRetry, className = '', title }) {
  const forbidden = error?.status === 403;
  const offline = error?.network || error?.timeout;
  const Icon = forbidden ? ShieldOff : offline ? WifiOff : AlertTriangle;
  const heading = title || (forbidden ? 'You do not have access to this' : offline ? 'Connection problem' : 'Something went wrong');
  return (
    <div role="alert" data-testid="error-state" data-error-code={error?.code} data-error-status={error?.status ?? 0} className={`flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center ${className}`}>
      <Icon className="mb-3 h-8 w-8 text-rose-700" aria-hidden="true" />
      <h3 className="text-base font-semibold text-rose-900">{heading}</h3>
      <p className="mt-1 max-w-md text-sm text-rose-900/90 break-words">{error?.message || 'The data could not be loaded.'}</p>
      {error?.requestId && <p className="mt-1 font-mono text-xs text-rose-900/80">Reference: {error.requestId}</p>}
      {onRetry && !forbidden && (
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={onRetry} className="mt-4" data-testid="retry-button">Try again</Button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className = '', testId = 'empty-state' }) {
  return (
    <div data-testid={testId} className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center ${className}`}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon className="h-6 w-6" aria-hidden="true" /></div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const ALERT_TONES = {
  info: { cls: 'border-sky-300 bg-sky-50 text-sky-900', icon: Info },
  success: { cls: 'border-emerald-300 bg-emerald-50 text-emerald-900', icon: CheckCircle2 },
  warning: { cls: 'border-amber-300 bg-amber-50 text-amber-900', icon: AlertTriangle },
  error: { cls: 'border-rose-300 bg-rose-50 text-rose-900', icon: XCircle }
};

export function InlineAlert({ tone = 'info', title, children, className = '', testId, action }) {
  const { cls, icon: Icon } = ALERT_TONES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} data-testid={testId} className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${cls} ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ value = 0, label, className = '', testId }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={label || 'Progress'}
        data-testid={testId}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Renders the correct state for a useFetch result: loading -> error -> empty -> children(data).
 * `isEmpty(data)` decides emptiness; children is only called with real, loaded data.
 */
export function StateView({ state, children, isEmpty, empty, loadingLabel, className = '' }) {
  if (state.loading && !state.data) return <LoadingBlock label={loadingLabel} className={className} />;
  if (state.error && !state.data) return <ErrorState error={state.error} onRetry={state.reload} className={className} />;
  if (state.data === null || state.data === undefined) return null;
  if (isEmpty && isEmpty(state.data)) return empty;
  return children(state.data);
}
