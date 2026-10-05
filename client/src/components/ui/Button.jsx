import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const BASE = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors select-none whitespace-nowrap '
  + 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';

const VARIANTS = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-900',
  brand: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-600',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-500',
  outline: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-500',
  success: 'bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-700',
  danger: 'bg-rose-700 text-white hover:bg-rose-800 focus-visible:ring-rose-700',
  ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-500'
};

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base'
};

/** Buttons keep their width while loading and are disabled during the request (no double submits). */
export const Button = forwardRef(function Button(
  { children, type = 'button', variant = 'primary', size = 'md', loading = false, disabled = false, icon: Icon, className = '', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BASE} ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

/** Icon-only buttons MUST have an accessible name, so `label` is required. */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'ghost', className = '', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-60 ${variant === 'danger' ? 'text-rose-700 hover:bg-rose-50' : 'text-slate-600 hover:bg-slate-100'} ${className}`}
      {...props}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
});
