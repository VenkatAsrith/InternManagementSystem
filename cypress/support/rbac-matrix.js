/**
 * Expected access matrix, derived BY HAND from the role definitions in docs/qa/RBAC_MATRIX.md (which mirrors
 * shared/constants.js ROLE_PERMISSIONS). It is deliberately written out in full instead of being computed from
 * the application's own permission table: a test that re-derives its expectation from the code under test can
 * never disagree with it.
 *
 * key      screen identifier
 * path     UI route
 * endpoint API call that screen depends on (read-only GET)
 */
export const SCREENS = [
  { key: 'dashboard', path: '/admin/dashboard', endpoint: '/analytics/dashboard' },
  { key: 'audit', path: '/admin/audit-logs', endpoint: '/audit-logs' },
  { key: 'programs', path: '/admin/programs', endpoint: '/recruitment/programs' },
  { key: 'applications', path: '/admin/applications', endpoint: '/recruitment/applications' },
  { key: 'interviews', path: '/admin/interviews', endpoint: '/interviews' },
  { key: 'offers', path: '/admin/offers', endpoint: '/offers' },
  { key: 'onboarding', path: '/admin/onboarding', endpoint: '/onboarding' },
  { key: 'interns', path: '/admin/interns', endpoint: '/interns' },
  { key: 'projects', path: '/admin/projects', endpoint: '/projects' },
  { key: 'tasks', path: '/admin/tasks', endpoint: '/tasks' },
  { key: 'journals', path: '/admin/journals', endpoint: '/journals' },
  { key: 'meetings', path: '/admin/meetings', endpoint: '/meetings' },
  { key: 'attendance', path: '/admin/attendance', endpoint: '/attendance/overview' },
  { key: 'leaves', path: '/admin/leaves', endpoint: '/leaves' },
  { key: 'learning', path: '/admin/learning', endpoint: null }, // page needs learning.manage; the read endpoint is shared with interns
  { key: 'performance', path: '/admin/performance', endpoint: '/performance/reviews' },
  { key: 'assets', path: '/admin/assets', endpoint: '/assets' },
  { key: 'finance', path: '/admin/finance', endpoint: '/finance/payments' },
  { key: 'documents', path: '/admin/documents', endpoint: null }, // /documents is also open to interns (own files)
  { key: 'templates', path: '/admin/templates', endpoint: '/templates' },
  { key: 'certificates', path: '/admin/certificates', endpoint: null }, // /certificates is also open to interns (own)
  { key: 'exits', path: '/admin/exits', endpoint: '/exits' },
  { key: 'users', path: '/admin/users', endpoint: '/users' },
  { key: 'roles', path: '/admin/roles', endpoint: '/roles' },
  { key: 'settings', path: '/admin/settings', endpoint: '/organizations/departments' }
];

const ALL = SCREENS.map((s) => s.key);

/** Screens each role may open. Everything not listed must be refused. */
export const ALLOWED = {
  orgadmin: ALL,
  hradmin: ALL.filter((k) => k !== 'learning'),
  recruiter: ['dashboard', 'programs', 'applications', 'interviews', 'offers', 'onboarding', 'users', 'settings'],
  manager: ['dashboard', 'programs', 'interns', 'projects', 'tasks', 'journals', 'meetings', 'attendance', 'leaves', 'learning', 'performance', 'assets', 'exits', 'users', 'settings'],
  mentor: ['interns', 'projects', 'tasks', 'journals', 'meetings', 'leaves', 'performance', 'users'],
  lead: ['interns', 'projects', 'tasks', 'journals', 'meetings', 'performance', 'users'],
  interviewer: ['applications', 'interviews'],
  finance: ['audit', 'offers', 'interns', 'finance', 'exits'],
  financeviewer: ['interns', 'finance'],
  documentadmin: ['interns', 'documents', 'templates', 'certificates', 'exits'],
  auditor: ['dashboard', 'audit', 'applications', 'interviews', 'offers', 'interns', 'attendance', 'leaves', 'performance', 'assets', 'finance', 'documents', 'certificates', 'exits'],
  intern: [],
  candidate: []
};

export const ROLE_KEYS = Object.keys(ALLOWED);

/**
 * Endpoints an INTERN may call because they return ONLY the caller's own records (read_own permissions).
 * The screen is refused, the API answers 200 with scoped data (asserted separately).
 */
export const OWN_SCOPE_API = { intern: ['projects', 'tasks', 'journals', 'meetings', 'performance'] };
