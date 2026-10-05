import { useMemo } from 'react';
import api from '../lib/http';
import { useAuth } from '../context/AuthContext';
import { useFetch } from './useFetch';
import { ROLE_PERMISSIONS } from '@shared/constants.js';
import { hasGranted } from '@shared/permissions.js';

/** Reference data used by dropdowns. Each hook is skipped when the user could not read the endpoint anyway. */
export function useDepartments({ includeArchived = false } = {}) {
  const { can } = useAuth();
  const state = useFetch(() => api.get('/organizations/departments', { params: includeArchived ? { includeArchived: true } : {} }), [includeArchived], { enabled: can('departments.read') });
  return { ...state, departments: state.data || [] };
}

export function usePrograms() {
  const { canAny } = useAuth();
  const state = useFetch(() => api.get('/recruitment/programs'), [], { enabled: canAny(['programs.read', 'programs.manage']) });
  return { ...state, programs: state.data || [] };
}

export function useStaffUsers() {
  const { can } = useAuth();
  const state = useFetch(() => api.get('/users', { params: { limit: 200 } }), [], { enabled: can('users.read') });
  const users = state.data || [];
  return useMemo(() => ({
    ...state,
    users,
    mentors: users.filter((u) => ['MENTOR', 'TEAM_LEAD', 'PROGRAM_MANAGER'].includes(u.role)),
    interviewers: users.filter((u) => hasGranted(ROLE_PERMISSIONS[u.role] || [], 'interviews.feedback') && u.role !== 'SUPER_ADMIN')
  }), [state.data, state.loading, state.error]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const userLabel = (u) => `${u.firstName} ${u.lastName} (${u.role.replace(/_/g, ' ').toLowerCase()})`;
