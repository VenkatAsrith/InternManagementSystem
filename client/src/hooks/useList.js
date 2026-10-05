import { useEffect, useState } from 'react';
import api from '../lib/http';
import { cleanParams } from '../lib/format';
import { useFetch } from './useFetch';

/**
 * Server-paginated list with filters.
 *   const list = useList('/interns', { filters: { status, search } })
 *   list.rows, list.pagination, list.setPage, list.loading, list.error, list.reload
 * Changing a filter returns to page 1. Only non-empty filters are sent.
 */
export function useList(path, { filters = {}, limit = 20, enabled = true } = {}) {
  const [page, setPage] = useState(1);
  const key = JSON.stringify(filters);
  useEffect(() => { setPage(1); }, [key]);
  const state = useFetch(
    () => api.get(path, { params: cleanParams({ ...filters, page, limit }) }),
    [path, key, page, limit],
    { enabled }
  );
  return { ...state, rows: Array.isArray(state.data) ? state.data : [], page, setPage };
}
