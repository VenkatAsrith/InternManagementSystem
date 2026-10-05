import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const TONES = {
  success: { icon: CheckCircle2, cls: 'border-emerald-300 bg-emerald-50 text-emerald-900', ms: 5000 },
  error: { icon: XCircle, cls: 'border-rose-300 bg-rose-50 text-rose-900', ms: 9000 },
  warning: { icon: AlertTriangle, cls: 'border-amber-300 bg-amber-50 text-amber-900', ms: 7000 },
  info: { icon: Info, cls: 'border-sky-300 bg-sky-50 text-sky-900', ms: 5000 }
};

/**
 * Toasts announce results of user actions. A success toast is only ever raised AFTER the API confirmed
 * the change, so "saved" on screen always means "saved" in the database.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((tone, message, opts = {}) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, tone, message: String(message) }]);
    const ms = opts.duration ?? TONES[tone].ms;
    if (ms > 0) setTimeout(() => dismiss(id), ms);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m?.message || m, o),
    warning: (m, o) => push('warning', m, o),
    info: (m, o) => push('info', m, o),
    dismiss
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:w-96 pointer-events-none"
        data-testid="toast-region"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => {
          const { icon: Icon, cls } = TONES[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              data-testid={`toast-${t.tone}`}
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${cls}`}
            >
              <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="flex-1 text-sm font-medium break-words">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded p-0.5 hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
