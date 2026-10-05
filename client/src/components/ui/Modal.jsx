import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal: role=dialog + aria-modal, labelled by its title, traps Tab, closes on Escape / backdrop,
 * locks page scroll and returns focus to whatever opened it.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', testId = 'modal', dismissible = true }) {
  const titleId = useId();
  const descId = useId();
  const panel = useRef(null);
  const opener = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = panel.current?.querySelector('[data-autofocus]') || panel.current?.querySelector(FOCUSABLE);
    (first || panel.current)?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) { e.stopPropagation(); onClose?.(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) { e.preventDefault(); return; }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previousOverflow;
      if (opener.current && document.contains(opener.current)) opener.current.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" data-testid={`${testId}-overlay`}>
      <div className="absolute inset-0 bg-slate-900/50" onClick={dismissible ? onClose : undefined} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        data-testid={testId}
        className={`relative flex max-h-[92vh] w-full ${widths[size] || widths.md} flex-col rounded-t-2xl bg-white shadow-2xl focus:outline-none sm:rounded-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900 break-words">{title}</h2>
            {description && <p id={descId} className="mt-0.5 text-sm text-slate-600">{description}</p>}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              data-testid={`${testId}-close`}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:justify-end sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

const ConfirmContext = createContext(null);

/**
 * Promise based confirmation for destructive / irreversible actions:
 *   if (!(await confirm({ title:'Revoke certificate?', message:'...', confirmLabel:'Revoke', tone:'danger' }))) return;
 * `requireReason: true` collects a mandatory reason and resolves with the text instead of `true`.
 */
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setReason('');
    setDialog(options);
  }), []);

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  const needsReason = !!dialog?.requireReason;
  const reasonTooShort = needsReason && reason.trim().length < (dialog.minReason || 3);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={!!dialog}
        onClose={() => close(needsReason ? null : false)}
        title={dialog?.title || 'Are you sure?'}
        size="sm"
        testId="confirm-dialog"
        footer={(
          <>
            <Button variant="outline" onClick={() => close(needsReason ? null : false)} data-testid="confirm-cancel">{dialog?.cancelLabel || 'Cancel'}</Button>
            <Button
              variant={dialog?.tone === 'danger' ? 'danger' : 'primary'}
              disabled={reasonTooShort}
              onClick={() => close(needsReason ? reason.trim() : true)}
              data-testid="confirm-accept"
              data-autofocus={needsReason ? undefined : true}
            >
              {dialog?.confirmLabel || 'Confirm'}
            </Button>
          </>
        )}
      >
        {dialog?.message && <p className="text-sm text-slate-700 break-words">{dialog.message}</p>}
        {needsReason && (
          <div className="mt-3">
            <label htmlFor="confirm-reason" className="mb-1.5 block text-sm font-medium text-slate-800">{dialog.reasonLabel || 'Reason'} <span className="text-rose-700" aria-hidden="true">*</span></label>
            <textarea
              id="confirm-reason"
              data-autofocus
              data-testid="confirm-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600/30"
            />
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
