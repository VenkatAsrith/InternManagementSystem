import { session } from './session';
import {
  LayoutDashboard, BarChart3, ScrollText, Briefcase, Users, FileText, CalendarDays, ClipboardList, GraduationCap,
  Clock, IndianRupee, Laptop, FileBadge, Award, LogOut, KeyRound, Building2, Video, NotebookPen, FolderKanban,
  CheckSquare, ShieldCheck, UserCog, Star, Package, Globe, MessageSquare
} from 'lucide-react';

/**
 * Single source of truth for "who may open which screen". The sidebar and the route guards both read
 * this table, so a menu item can never point at a page the user would be refused (and vice versa).
 * Values are ANY-OF permission lists. The API enforces the same rules; this only decides what to show.
 */
export const ACCESS = {
  analytics: ['analytics.read'],
  audit: ['audit.read'],
  programs: ['programs.read', 'programs.manage', 'openings.read'],
  applications: ['applications.read'],
  interviews: ['interviews.read'],
  offers: ['offers.read'],
  onboarding: ['onboarding.read'],
  interns: ['interns.read'],
  projects: ['projects.read'],
  chat: ['users.read', 'interns.read_own', 'tasks.review', 'projects.read'],
  tasks: ['tasks.read'],
  journals: ['journals.read'],
  meetings: ['meetings.read'],
  attendance: ['attendance.read'],
  leaves: ['leaves.read'],
  learning: ['learning.manage'],
  performance: ['performance.read'],
  assets: ['assets.read'],
  finance: ['finance.read'],
  bootcamps: ['bootcamps.read', 'bootcamps.manage'],
  documents: ['documents.read', 'documents.generate', 'documents.approve'],
  templates: ['templates.read'],
  certificates: ['certificates.read'],
  exits: ['exit.read'],
  users: ['users.read'],
  roles: ['roles.read'],
  settings: ['settings.manage', 'departments.read'],
  mentor: ['tasks.review', 'journals.review', 'performance.review'],
  trainees: ['training.manage', 'training.read', 'interns.read'],
  // participant workspace
  internHome: ['interns.read_own'],
  internOnboarding: ['onboarding.read_own'],
  internTasks: ['tasks.read_own'],
  internJournal: ['journals.read_own', 'journals.create'],
  internAttendance: ['attendance.read_own'],
  internLeaves: ['leaves.read_own'],
  internLearning: ['learning.progress'],
  internTrainee: ['training.read_own', 'training.progress', 'interns.read_own'],
  internMeetings: ['meetings.read_own'],
  internFinance: ['finance.read_own'],
  internPerformance: ['performance.read_own'],
  internDocuments: ['documents.read_own'],
  internCertificates: ['certificates.read_own'],
  internExit: ['exit.read_own']
};

export const NAV = [
  {
    group: 'Platform',
    items: [{ key: 'global', label: 'Global Command', to: '/admin/global-command', icon: Globe, roles: ['SUPER_ADMIN'] }]
  },
  {
    group: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard, any: ACCESS.analytics },
      { key: 'mentor-dashboard', label: 'My Mentees', to: '/mentor/dashboard', icon: UserCog, any: ACCESS.mentor },
      { key: 'analytics', label: 'Analytics', to: '/admin/analytics', icon: BarChart3, any: ACCESS.analytics },
      { key: 'audit', label: 'Audit Logs', to: '/admin/audit-logs', icon: ScrollText, any: ACCESS.audit }
    ]
  },
  {
    group: 'Growth & Cohorts',
    items: [
      { key: 'bootcamps', label: 'Bootcamps', to: '/admin/bootcamps', icon: GraduationCap, any: ACCESS.bootcamps }
    ]
  },
  {
    group: 'Recruitment',
    items: [
      { key: 'programs', label: 'Programs & Openings', to: '/admin/programs', icon: Briefcase, any: ACCESS.programs },
      { key: 'applications', label: 'Applications', to: '/admin/applications', icon: Users, any: ACCESS.applications },
      { key: 'interviews', label: 'Interviews', to: '/admin/interviews', icon: CalendarDays, any: ACCESS.interviews },
      { key: 'offers', label: 'Offers', to: '/admin/offers', icon: FileText, any: ACCESS.offers },
      { key: 'onboarding', label: 'Onboarding', to: '/admin/onboarding', icon: ClipboardList, any: ACCESS.onboarding }
    ]
  },
  {
    group: 'Operations',
    items: [
      { key: 'interns', label: 'Interns', to: '/admin/interns', icon: Users, any: ACCESS.interns },
      { key: 'trainees', label: 'Intern Trainees', to: '/admin/trainees', icon: GraduationCap, any: ACCESS.trainees },
      { key: 'projects', label: 'Projects', to: '/admin/projects', icon: FolderKanban, any: ACCESS.projects },
      { key: 'tasks', label: 'Tasks & Reviews', to: '/admin/tasks', icon: CheckSquare, any: ACCESS.tasks },
      { key: 'journals', label: 'Daily Journals', to: '/admin/journals', icon: NotebookPen, any: ACCESS.journals },
      { key: 'meetings', label: 'Meetings', to: '/admin/meetings', icon: Video, any: ACCESS.meetings },
      { key: 'google-meet', label: 'Google Meet Hub', to: '/admin/google-meet', icon: Video, any: ACCESS.meetings },
      { key: 'attendance', label: 'Attendance', to: '/admin/attendance', icon: Clock, any: ACCESS.attendance },
      { key: 'leaves', label: 'Leave Requests', to: '/admin/leaves', icon: CalendarDays, any: ACCESS.leaves },
      { key: 'learning', label: 'Learning Paths', to: '/admin/learning', icon: GraduationCap, any: ACCESS.learning },
      { key: 'performance', label: 'Performance', to: '/admin/performance', icon: Star, any: ACCESS.performance },
      { key: 'assets', label: 'IT Assets', to: '/admin/assets', icon: Laptop, any: ACCESS.assets },
      { key: 'chat', label: 'Team Chat', to: '/chat', icon: MessageSquare }
    ]
  },
  {
    group: 'Finance & Documents',
    items: [
      { key: 'finance', label: 'Finance & Stipends', to: '/admin/finance', icon: IndianRupee, any: ACCESS.finance },
      { key: 'documents', label: 'Letters & Documents', to: '/admin/documents', icon: FileText, any: ACCESS.documents },
      { key: 'templates', label: 'Templates', to: '/admin/templates', icon: FileBadge, any: ACCESS.templates },
      { key: 'certificates', label: 'Certificates', to: '/admin/certificates', icon: Award, any: ACCESS.certificates },
      { key: 'exits', label: 'Exit & Offboarding', to: '/admin/exits', icon: LogOut, any: ACCESS.exits }
    ]
  },
  {
    group: 'Administration',
    items: [
      { key: 'users', label: 'Users', to: '/admin/users', icon: Users, any: ACCESS.users },
      { key: 'roles', label: 'Roles & Permissions', to: '/admin/roles', icon: ShieldCheck, any: ACCESS.roles },
      { key: 'settings', label: 'Organization', to: '/admin/settings', icon: Building2, any: ACCESS.settings }
    ]
  },
  {
    group: 'My Internship',
    participantOnly: true,
    items: [
      { key: 'i-home', label: 'Dashboard', to: '/intern/dashboard', icon: LayoutDashboard, any: ACCESS.internHome },
      { key: 'i-projects', label: 'My Projects', to: '/admin/projects', icon: FolderKanban, any: ACCESS.internHome },
      { key: 'i-tasks', label: 'My Tasks', to: '/intern/tasks', icon: CheckSquare, any: ACCESS.internTasks },
      { key: 'i-chat', label: 'Team Chat', to: '/chat', icon: MessageSquare, any: ACCESS.internHome },
      { key: 'i-onboarding', label: 'Onboarding', to: '/intern/onboarding', icon: ClipboardList, any: ACCESS.internOnboarding },
      { key: 'i-journal', label: 'Daily Journal', to: '/intern/journal', icon: NotebookPen, any: ACCESS.internJournal },
      { key: 'i-attendance', label: 'Attendance', to: '/intern/attendance', icon: Clock, any: ACCESS.internAttendance },
      { key: 'i-leaves', label: 'Leave', to: '/intern/leaves', icon: CalendarDays, any: ACCESS.internLeaves },
      { key: 'i-learning', label: 'Learning', to: '/intern/learning', icon: GraduationCap, any: ACCESS.internLearning },
      { key: 'i-trainee', label: 'Intern Trainee', to: '/intern/trainee', icon: GraduationCap, any: ACCESS.internTrainee },
      { key: 'i-meetings', label: 'Meetings', to: '/intern/meetings', icon: Video, any: ACCESS.internMeetings },
      { key: 'i-performance', label: 'Performance', to: '/intern/performance', icon: Star, any: ACCESS.internPerformance },
      { key: 'i-finance', label: 'Stipend', to: '/intern/finance', icon: IndianRupee, any: ACCESS.internFinance },
      { key: 'i-documents', label: 'Documents', to: '/intern/documents', icon: Package, any: ACCESS.internDocuments },
      { key: 'i-certificates', label: 'Certificates', to: '/intern/certificates', icon: Award, any: ACCESS.internCertificates },
      { key: 'i-exit', label: 'Exit Status', to: '/intern/exit', icon: LogOut, any: ACCESS.internExit }
    ]
  },
  {
    group: 'Account',
    items: [{ key: 'account', label: 'Account & Security', to: '/account', icon: KeyRound }]
  }
];

/** Removes items (and empty groups) the user cannot open. */
export function visibleNav({ can, canAny, user }) {
  const isParticipant = (can('interns.read_own') && !can('interns.read')) || user?.role === 'SUPER_ADMIN';
  // A platform administrator who has not entered an organization only has platform pages: every org page would refuse the request.
  const outsideOrg = user?.role === 'SUPER_ADMIN' && !session.getActingOrg();
  return NAV
    .filter((g) => !outsideOrg || ['Platform', 'Account'].includes(g.group))
    .filter((g) => !g.participantOnly || isParticipant)
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (it.roles && !it.roles.includes(user?.role) && user?.role !== 'SUPER_ADMIN') return false;
        if (it.any) return canAny(it.any) || user?.role === 'SUPER_ADMIN';
        return true;
      })
    }))
    .filter((g) => g.items.length > 0);
}

/** First screen a user should land on after signing in. */
export function landingPath({ user, canAny, can }) {
  if (!user) return '/login';
  if (user.role === 'SUPER_ADMIN') return '/admin/global-command';
  const staffHome = canAny(ACCESS.analytics) ? '/admin/dashboard' : null;
  if (canAny(ACCESS.internHome) && !can('interns.read')) return '/intern/dashboard';
  if (staffHome) return staffHome;
  if (canAny(ACCESS.mentor)) return '/mentor/dashboard';
  // Roles whose first useful screen is not the first item of the menu.
  const preferred = { INTERVIEWER: ['/admin/interviews', ACCESS.interviews], FINANCE_ADMIN: ['/admin/finance', ACCESS.finance], FINANCE_VIEWER: ['/admin/finance', ACCESS.finance], DOCUMENT_ADMIN: ['/admin/documents', ACCESS.documents] }[user.role];
  if (preferred && canAny(preferred[1])) return preferred[0];
  const first = NAV.flatMap((g) => g.items).find((it) => it.any && !it.roles && canAny(it.any));
  return first ? first.to : '/account';
}
