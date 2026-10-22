import { session } from './session';
import {
  LayoutDashboard, BarChart3, ScrollText, Briefcase, Users, FileText, CalendarDays, ClipboardList, GraduationCap,
  Clock, IndianRupee, Laptop, FileBadge, Award, LogOut, KeyRound, Building2, Video, NotebookPen, FolderKanban,
  CheckSquare, ShieldCheck, UserCog, Star, Package, Globe, MessageSquare, Mail, BookOpen
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
    key: 'platform',
    icon: Globe,
    items: [
      { key: 'global', label: 'Global Command', to: '/admin/global-command', icon: Globe, roles: ['SUPER_ADMIN'] }
    ]
  },
  {
    group: 'Operations',
    key: 'operations',
    icon: LayoutDashboard,
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard, any: ACCESS.analytics },
      { key: 'analytics', label: 'Analytics', to: '/admin/analytics', icon: BarChart3, any: ACCESS.analytics },
      { key: 'chat', label: 'Team Chat', to: '/chat', icon: MessageSquare }
    ]
  },
  {
    group: 'Bootcamps',
    key: 'bootcamps',
    icon: GraduationCap,
    items: [
      { key: 'bootcamps', label: 'Bootcamps', to: '/admin/bootcamps', icon: GraduationCap, any: ACCESS.bootcamps },
      { key: 'google-meet', label: 'Google Meet Hub', to: '/admin/google-meet', icon: Video, any: ACCESS.meetings }
    ]
  },
  {
    group: 'Internship Management',
    key: 'intern-management',
    icon: Briefcase,
    items: [
      { key: 'programs', label: 'Programs & Openings', to: '/admin/programs', icon: Briefcase, any: ACCESS.programs },
      { key: 'applications', label: 'Applications', to: '/admin/applications', icon: Users, any: ACCESS.applications },
      { key: 'interviews', label: 'Interviews', to: '/admin/interviews', icon: CalendarDays, any: ACCESS.interviews },
      { key: 'offers', label: 'Offers', to: '/admin/offers', icon: FileText, any: ACCESS.offers },
      { key: 'onboarding', label: 'Onboarding', to: '/admin/onboarding', icon: ClipboardList, any: ACCESS.onboarding },
      { key: 'interns', label: 'Interns Directory', to: '/admin/interns', icon: Users, any: ACCESS.interns },
      { key: 'mentor-dashboard', label: 'My Mentees', to: '/mentor/dashboard', icon: UserCog, any: ACCESS.mentor },
      { key: 'projects', label: 'Projects', to: '/admin/projects', icon: FolderKanban, any: ACCESS.projects },
      { key: 'tasks', label: 'Tasks & Reviews', to: '/admin/tasks', icon: CheckSquare, any: ACCESS.tasks },
      { key: 'journals', label: 'Daily Journals', to: '/admin/journals', icon: NotebookPen, any: ACCESS.journals },
      { key: 'meetings', label: 'Meetings', to: '/admin/meetings', icon: Video, any: ACCESS.meetings },
      { key: 'attendance', label: 'Attendance', to: '/admin/attendance', icon: Clock, any: ACCESS.attendance },
      { key: 'leaves', label: 'Leave Requests', to: '/admin/leaves', icon: CalendarDays, any: ACCESS.leaves },
      { key: 'learning', label: 'Learning Paths', to: '/admin/learning', icon: GraduationCap, any: ACCESS.learning },
      { key: 'performance', label: 'Performance', to: '/admin/performance', icon: Star, any: ACCESS.performance }
    ]
  },
  {
    group: 'Finance & Documents',
    key: 'finance-documents',
    icon: IndianRupee,
    items: [
      { key: 'finance', label: 'Finance & Stipends', to: '/admin/finance', icon: IndianRupee, any: ACCESS.finance },
      { key: 'documents', label: 'Letters & Documents', to: '/admin/documents', icon: FileText, any: ACCESS.documents },
      { key: 'templates', label: 'Document Templates', to: '/admin/templates', icon: FileBadge, any: ACCESS.templates },
      { key: 'email-templates', label: 'Email Templates', to: '/admin/email-templates', icon: Mail, any: ACCESS.templates },
      { key: 'certificates', label: 'Certificates', to: '/admin/certificates', icon: Award, any: ACCESS.certificates },
      { key: 'exits', label: 'Exit & Offboarding', to: '/admin/exits', icon: LogOut, any: ACCESS.exits }
    ]
  },
  {
    group: 'Intern Trainee Management',
    key: 'trainee-management',
    icon: GraduationCap,
    items: [
      { key: 'training-programs', label: 'Training Programs', to: '/admin/trainees?tab=programs', icon: BookOpen, any: ACCESS.trainees },
      { key: 'trainees', label: 'Trainees Directory', to: '/admin/trainees', icon: GraduationCap, any: ACCESS.trainees },
      { key: 'trainee-payments', label: 'Fee Collection & Payments', to: '/admin/trainees?tab=payments', icon: IndianRupee, any: ACCESS.trainees },
      { key: 'trainee-projects', label: 'Capstone Projects', to: '/admin/projects', icon: FolderKanban, any: ACCESS.projects },
      { key: 'trainee-tasks', label: 'Tasks & Reviews', to: '/admin/tasks', icon: CheckSquare, any: ACCESS.tasks },
      { key: 'trainee-journals', label: 'Daily Journals', to: '/admin/journals', icon: NotebookPen, any: ACCESS.journals },
      { key: 'trainee-meetings', label: 'Sessions & Meetings', to: '/admin/meetings', icon: Video, any: ACCESS.meetings },
      { key: 'trainee-attendance', label: 'Class Attendance', to: '/admin/attendance', icon: Clock, any: ACCESS.attendance },
      { key: 'trainee-learning', label: 'Curriculum & Learning', to: '/admin/learning', icon: GraduationCap, any: ACCESS.learning },
      { key: 'trainee-performance', label: 'Assessments & Grades', to: '/admin/performance', icon: Star, any: ACCESS.performance },
      { key: 'trainee-documents', label: 'Letters & Documents', to: '/admin/documents', icon: FileText, any: ACCESS.documents },
      { key: 'trainee-certificates', label: 'Course Certificates', to: '/admin/certificates', icon: Award, any: ACCESS.certificates }
    ]
  },
  {
    group: 'Administration & System',
    key: 'system-admin',
    icon: Building2,
    items: [
      { key: 'users', label: 'Users', to: '/admin/users', icon: Users, any: ACCESS.users },
      { key: 'roles', label: 'Roles & Permissions', to: '/admin/roles', icon: ShieldCheck, any: ACCESS.roles },
      { key: 'audit', label: 'Audit Logs', to: '/admin/audit-logs', icon: ScrollText, any: ACCESS.audit },
      { key: 'assets', label: 'IT Assets', to: '/admin/assets', icon: Laptop, any: ACCESS.assets },
      { key: 'settings', label: 'Organization Settings', to: '/admin/settings', icon: Building2, any: ACCESS.settings },
      { key: 'account', label: 'Account & Security', to: '/account', icon: KeyRound }
    ]
  },
  // Participant workspaces
  {
    group: 'Intern Workspace',
    key: 'intern-workspace',
    icon: Briefcase,
    participantTarget: 'INTERN',
    items: [
      { key: 'i-home', label: 'Dashboard', to: '/intern/dashboard', icon: LayoutDashboard },
      { key: 'i-chat', label: 'Team Chat', to: '/chat', icon: MessageSquare },
      { key: 'i-onboarding', label: 'Onboarding', to: '/intern/onboarding', icon: ClipboardList },
      { key: 'i-tasks', label: 'My Tasks', to: '/intern/tasks', icon: CheckSquare },
      { key: 'i-journal', label: 'Daily Journal', to: '/intern/journal', icon: NotebookPen },
      { key: 'i-attendance', label: 'Attendance', to: '/intern/attendance', icon: Clock },
      { key: 'i-leaves', label: 'Leaves', to: '/intern/leaves', icon: CalendarDays },
      { key: 'i-learning', label: 'Learning Paths', to: '/intern/learning', icon: GraduationCap },
      { key: 'i-meetings', label: 'Meetings', to: '/intern/meetings', icon: Video },
      { key: 'i-performance', label: 'Performance', to: '/intern/performance', icon: Star },
      { key: 'i-finance', label: 'Stipend', to: '/intern/finance', icon: IndianRupee },
      { key: 'i-documents', label: 'Documents', to: '/intern/documents', icon: Package },
      { key: 'i-certificates', label: 'Certificates', to: '/intern/certificates', icon: Award },
      { key: 'i-exit', label: 'Exit Status', to: '/intern/exit', icon: LogOut },
      { key: 'account', label: 'Account & Security', to: '/account', icon: KeyRound }
    ]
  },
  {
    group: 'Intern Trainee Workspace',
    key: 'trainee-workspace',
    icon: GraduationCap,
    participantTarget: 'INTERN_TRAINEE',
    items: [
      { key: 'i-trainee', label: 'Trainee Dashboard', to: '/intern/trainee', icon: LayoutDashboard },
      { key: 'i-chat', label: 'Team Chat', to: '/chat', icon: MessageSquare },
      { key: 'i-tasks', label: 'Tasks & Assignments', to: '/intern/tasks', icon: CheckSquare },
      { key: 'i-journal', label: 'Daily Journals', to: '/intern/journal', icon: NotebookPen },
      { key: 'i-attendance', label: 'Attendance', to: '/intern/attendance', icon: Clock },
      { key: 'i-meetings', label: 'Meetings & Sessions', to: '/intern/meetings', icon: Video },
      { key: 'i-performance', label: 'Performance & Reviews', to: '/intern/performance', icon: Star },
      { key: 'i-documents', label: 'Letters & Verification', to: '/intern/documents', icon: Package },
      { key: 'i-certificates', label: 'Certificates', to: '/intern/certificates', icon: Award },
      { key: 'account', label: 'Account & Security', to: '/account', icon: KeyRound }
    ]
  }
];

/** Removes items (and empty groups) the user cannot open. */
export function visibleNav(auth) {
  if (!auth) return [];
  const currentRole = auth.user?.role;
  const isSuper = auth.isSuperAdmin;
  const isParticipant = currentRole === 'INTERN' || currentRole === 'INTERN_TRAINEE';

  return NAV
    .filter((g) => {
      // Participant workspace groups only show to matching participant role
      if (g.participantTarget) {
        return currentRole === g.participantTarget;
      }
      // Participants never see staff administration groups
      if (isParticipant) {
        return false;
      }
      return true;
    })
    .map((g) => {
      const items = g.items.filter((it) => {
        if (it.roles && !it.roles.includes(currentRole) && !isSuper) return false;
        if (it.any && !auth.canAny(it.any) && !isSuper) return false;
        return true;
      });
      return { ...g, items };
    })
    .filter((g) => g.items.length > 0);
}

/** First screen a user should land on after signing in. */
export function landingPath(auth) {
  if (!auth || !auth.user) return '/login';
  const role = auth.user.role;
  if (role === 'SUPER_ADMIN') return '/admin/dashboard';
  if (role === 'INTERN_TRAINEE') return '/intern/trainee';
  if (role === 'INTERN') return '/intern/dashboard';
  if (role === 'ORGANIZATION_ADMIN') return '/admin/dashboard';
  if (auth.canAny(ACCESS.analytics)) return '/admin/dashboard';
  if (auth.canAny(ACCESS.internHome)) return '/intern/dashboard';
  return '/admin/dashboard';
}
