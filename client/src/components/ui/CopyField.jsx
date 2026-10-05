import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './Button';

/**
 * Shows a one-time link (offer acceptance, password setup) with a copy button.
 * Email delivery is simulated in this environment, so the link is surfaced for the operator to hand over.
 */
export function CopyField({ label, value, testId = 'copy-field' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div>
      {label && <p className="mb-1.5 text-sm font-medium text-slate-800">{label}</p>}
      <div className="flex items-center gap-2">
        <input readOnly value={value} aria-label={label || 'Link'} data-testid={`${testId}-value`} onFocus={(e) => e.target.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 font-mono text-xs text-slate-800" />
        <Button variant="outline" icon={copied ? Check : Copy} onClick={copy} data-testid={`${testId}-copy`}>{copied ? 'Copied' : 'Copy'}</Button>
      </div>
    </div>
  );
}
