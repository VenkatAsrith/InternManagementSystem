import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data with explicit loading / error / empty-capable states.
 *   const { data, error, loading, reload, setData } = useFetch(() => api.get('/x'), [dep])
 * - stale responses are ignored (fast filter changes cannot show old data)
 * - `enabled: false` skips the request (e.g. waiting for a permission check)
 * - `select` maps the API envelope to the state you want (default: envelope.data)
 */
export function useFetch(fetcher, deps = [], { enabled = true, select = (res) => res.data } = {}) {
  const [state, setState] = useState({ data: null, pagination: null, error: null, loading: enabled });
  const seq = useRef(0);
  const fetcherRef = useRef(fetcher);
  const selectRef = useRef(select);
  fetcherRef.current = fetcher;
  selectRef.current = select;

  const run = useCallback(async ({ silent = false } = {}) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetcherRef.current();
      if (id !== seq.current) return;
      setState({ data: selectRef.current(res), pagination: res.pagination || null, error: null, loading: false });
    } catch (error) {
      if (id !== seq.current) return;
      setState((s) => ({ ...s, data: silent ? s.data : null, error, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return undefined;
    }
    run();
    return () => { seq.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}

/** Debounces a fast-changing value (search boxes) so we do not fire a request per keystroke. */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
