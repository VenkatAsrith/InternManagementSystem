import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Form controls share one shell so labels, hints and errors line up identically on every screen.
 *  - id is `field-<name>` (labels, aria-describedby and focus-on-error all use it)
 *  - data-testid is `input-<name>` (Cypress), errors are `error-<name>`
 *  - the error is announced (role=alert) and linked via aria-describedby, invalid controls get aria-invalid
 */
function Shell({ name, label, required, hint, error, children, className = '' }) {
  const id = `field-${name}`;
  return (
    <div className={`min-w-0 ${className}`}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-800">
          {label}
          {required && <span className="ml-0.5 text-rose-700" aria-hidden="true">*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" data-testid={`error-${name}`} className="mt-1 flex items-start gap-1 text-xs font-medium text-rose-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

const CONTROL = 'block w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 '
  + 'focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed';
const OK = 'border-slate-300 hover:border-slate-400 focus:border-slate-600 focus:ring-slate-600/30';
const BAD = 'border-rose-600 focus:border-rose-700 focus:ring-rose-600/30';

function aria(name, error, hint) {
  return {
    id: `field-${name}`,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `field-${name}-error` : hint ? `field-${name}-hint` : undefined
  };
}

export function TextField({ name, label, required, hint, error, className = '', type = 'text', testId, ...props }) {
  return (
    <Shell name={name} label={label} required={required} hint={hint} error={error} className={className}>
      <input
        type={type}
        name={name}
        required={required}
        data-testid={testId || `input-${name}`}
        className={`${CONTROL} h-10 ${error ? BAD : OK}`}
        {...aria(name, error, hint)}
        {...props}
      />
    </Shell>
  );
}

export function TextAreaField({ name, label, required, hint, error, rows = 4, className = '', testId, ...props }) {
  return (
    <Shell name={name} label={label} required={required} hint={hint} error={error} className={className}>
      <textarea
        name={name}
        rows={rows}
        required={required}
        data-testid={testId || `input-${name}`}
        className={`${CONTROL} py-2 ${error ? BAD : OK}`}
        {...aria(name, error, hint)}
        {...props}
      />
    </Shell>
  );
}

/** options: [{ value, label }] or plain strings. `placeholder` renders a disabled empty first option. */
export function SelectField({ name, label, required, hint, error, options = [], placeholder, className = '', testId, children, ...props }) {
  return (
    <Shell name={name} label={label} required={required} hint={hint} error={error} className={className}>
      <select
        name={name}
        required={required}
        data-testid={testId || `input-${name}`}
        className={`${CONTROL} h-10 ${error ? BAD : OK}`}
        {...aria(name, error, hint)}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children || options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>;
        })}
      </select>
    </Shell>
  );
}

export function CheckboxField({ name, label, hint, error, className = '', testId, checked, onChange, ...props }) {
  const id = `field-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-800">
        <input
          id={id}
          type="checkbox"
          name={name}
          checked={!!checked}
          onChange={onChange}
          data-testid={testId || `input-${name}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-4 w-4 rounded border-slate-400 text-slate-900 focus:ring-2 focus:ring-slate-600"
          {...props}
        />
        <span>{label}{hint && <span className="block text-xs text-slate-600">{hint}</span>}</span>
      </label>
      {error && <p id={`${id}-error`} role="alert" data-testid={`error-${name}`} className="mt-1 text-xs font-medium text-rose-700">{error}</p>}
    </div>
  );
}

export function FileField({ name, label, required, hint, error, accept, className = '', testId, onChange, ...props }) {
  return (
    <Shell name={name} label={label} required={required} hint={hint} error={error} className={className}>
      <input
        type="file"
        name={name}
        accept={accept}
        required={required}
        onChange={onChange}
        data-testid={testId || `input-${name}`}
        className={`${CONTROL} py-2 h-auto file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200 ${error ? BAD : OK}`}
        {...aria(name, error, hint)}
        {...props}
      />
    </Shell>
  );
}

/** Non-field failure of a form submit (409, 500, network...). Field-level 422s are shown on the fields. */
export function FormError({ error, className = '' }) {
  if (!error) return null;
  const hasFieldErrors = error.fieldErrors && Object.keys(error.fieldErrors).length > 0;
  return (
    <div role="alert" data-testid="form-error" data-error-code={error.code} className={`flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-900 ${className}`}>
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-medium break-words">{hasFieldErrors ? 'Please correct the highlighted fields.' : error.message}</p>
        {error.code === 'INVALID_TRANSITION' && error.details?.allowed && (
          <p className="mt-0.5 text-xs">Allowed next steps: {error.details.allowed.join(', ') || 'none'}</p>
        )}
      </div>
    </div>
  );
}

/** Consistent grid: every row aligns to the same columns at every breakpoint. */
export function FormGrid({ cols = 2, className = '', children }) {
  const map = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' };
  return <div className={`grid grid-cols-1 items-start gap-x-4 gap-y-4 ${map[cols] || map[2]} ${className}`}>{children}</div>;
}
