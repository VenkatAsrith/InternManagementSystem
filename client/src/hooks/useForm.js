import { useCallback, useRef, useState } from 'react';
import { ApiError } from '../lib/http';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

/** Reusable client-side rules. They only save a round trip: the API re-validates everything. */
export const rules = {
  required: (label) => (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0) ? `${label} is required` : null),
  email: (label = 'Email') => (v) => (v && !EMAIL_RE.test(String(v).trim()) ? `Enter a valid ${label.toLowerCase()} address` : null),
  min: (n, label) => (v) => (v && String(v).trim().length < n ? `${label} must be at least ${n} characters` : null),
  max: (n, label) => (v) => (v && String(v).length > n ? `${label} must be at most ${n} characters` : null),
  number: (label, { min, max } = {}) => (v) => {
    if (v === '' || v === undefined || v === null) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return `${label} must be a number`;
    if (min !== undefined && n < min) return `${label} must be at least ${min}`;
    if (max !== undefined && n > max) return `${label} must be at most ${max}`;
    return null;
  },
  url: (label) => (v) => {
    if (!v) return null;
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:' ? null : `${label} must start with http:// or https://`;
    } catch { return `${label} must be a valid URL`; }
  }
};

/**
 * Form state with server error mapping.
 *   const form = useForm({ email: '' });
 *   <Field {...form.field('email')} label="Email" />
 *   form.submit(rulesMap, async (values) => { await api.post(...) })   -> validates, calls, maps 422 to fields
 * Exposes `formError` for non-field failures (409, 500, network) so the user always sees WHY it failed.
 */
export function useForm(initial = {}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const initialRef = useRef(initial);

  const set = useCallback((name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  }, []);

  const field = useCallback((name) => ({
    name,
    value: values[name] ?? '',
    error: errors[name],
    onChange: (e) => {
      const t = e?.target;
      set(name, t ? (t.type === 'checkbox' ? t.checked : t.value) : e);
    }
  }), [values, errors, set]);

  const reset = useCallback((next) => {
    setValues(next ?? initialRef.current);
    setErrors({});
    setFormError(null);
  }, []);

  const validate = useCallback((ruleMap = {}, current = values) => {
    const found = {};
    for (const [name, list] of Object.entries(ruleMap)) {
      for (const rule of [].concat(list)) {
        const msg = rule(current[name], current);
        if (msg) { found[name] = msg; break; }
      }
    }
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      // Move focus to the first invalid control so keyboard and screen-reader users land on the problem.
      requestAnimationFrame(() => document.getElementById(`field-${first}`)?.focus());
    }
    return Object.keys(found).length === 0;
  }, [values]);

  /** Runs validation then `action`. Resolves { ok:true, value } on success, { ok:false } when validation or the server rejected. */
  const submit = useCallback(async (ruleMap, action) => {
    if (inFlight.current) return { ok: false }; // double-click / double-Enter guard
    setFormError(null);
    if (!validate(ruleMap)) return { ok: false };
    inFlight.current = true;
    setSubmitting(true);
    try {
      return { ok: true, value: await action(values) };
    } catch (error) {
      const err = error instanceof ApiError ? error : new ApiError({ message: error?.message });
      if (Object.keys(err.fieldErrors).length) {
        setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
        requestAnimationFrame(() => document.getElementById(`field-${Object.keys(err.fieldErrors)[0]}`)?.focus());
      }
      setFormError(err);
      return { ok: false };
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, [validate, values]);

  return { values, set, setValues, errors, setErrors, field, formError, setFormError, submitting, submit, validate, reset };
}

/** Guards a one-off async action (button click) against double submission and reports errors via callbacks. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const run = useCallback(async (fn) => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPending(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);
  return { pending, run };
}
