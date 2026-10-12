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
    group: 'Global Command',
    key: 'global-command',
    icon: Globe,
    items: [
      { key: 'global', label: 'Global Command', to: '/admin/global-command', icon: Globe, roles: ['SUPER_ADMIN'] },
      { key: 'dashboard', label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard, any: ACCESS.analytics },
      { key: 'analytics', label: 'Analytics', to: '/admin/analytics', icon: BarChart3, any: ACCESS.analytics },
      { key: 'users', label: 'Users', to: '/admin/users', icon: Users, any: ACCESS.users },
      { key: 'roles', label: 'Roles & Permissions', to: '/admin/roles', icon: ShieldCheck, any: ACCESS.roles },
      { key: 'audit', label: 'Audit Logs', to: '/admin/audit-logs', icon: ScrollText, any: ACCESS.audit },
      { key: 'assets', label: 'IT Assets', to: '/admin/assets', icon: Laptop, any: ACCESS.assets }
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
    group: 'Intern',
    key: 'intern',
    icon: Briefcase,
    items: [
      // Recruitment pipeline (scoped inside Intern)
      { key: 'programs', label: 'Programs & Openings', to: '/admin/programs', icon: Briefcase, any: ACCESS.programs },
      { key: 'applications', label: 'Applications', to: '/admin/applications', icon: Users, any: ACCESS.applications },
      { key: 'interviews', label: 'Interviews', to: '/admin/interviews', icon: CalendarDays, any: ACCESS.interviews },
      { key: 'offers', label: 'Offers', to: '/admin/offers', icon: FileText, any: ACCESS.offers },
      { key: 'onboarding', label: 'Onboarding', to: '/admin/onboarding', icon: ClipboardList, any: ACCESS.onboarding },
      // Intern operations & lifecycle
      { key: 'interns', label: 'Interns', to: '/admin/interns', icon: Users, any: ACCESS.interns },
      { key: 'mentor-dashboard', label: 'My Mentees', to: '/mentor/dashboard', icon: UserCog, any: ACCESS.mentor },
      { key: 'projects', label: 'Projects', to: '/admin/projects', icon: FolderKanban, any: ACCESS.projects },
      { key: 'tasks', label: 'Tasks & Reviews', to: '/admin/tasks', icon: CheckSquare, any: ACCESS.tasks },
      { key: 'journals', label: 'Daily Journals', to: '/admin/journals', icon: NotebookPen, any: ACCESS.journals },
      { key: 'meetings', label: 'Meetings', to: '/admin/meetings', icon: Video, any: ACCESS.meetings },
      { key: 'attendance', label: 'Attendance', to: '/admin/attendance', icon: Clock, any: ACCESS.attendance },
      { key: 'leaves', label: 'Leave Requests', to: '/admin/leaves', icon: CalendarDays, any: ACCESS.leaves },
      { key: 'learning', label: 'Learning Paths', to: '/admin/learning', icon: GraduationCap, any: ACCESS.learning },
      { key: 'performance', label: 'Performance', to: '/admin/performance', icon: Star, any: ACCESS.performance },
      // Finance & Stipends (scoped inside Intern)
      { key: 'finance', label: 'Finance & Stipends', to: '/admin/finance', icon: IndianRupee, any: ACCESS.finance },
      // Documents & Compliance
      { key: 'documents', label: 'Letters & Documents', to: '/admin/documents', icon: FileText, any: ACCESS.documents },
      { key: 'templates', label: 'Document Templates', to: '/admin/templates', icon: FileBadge, any: ACCESS.templates },
      { key: 'email-templates', label: 'Email Templates', to: '/admin/email-templates', icon: Mail, any: ACCESS.templates },
      { key: 'certificates', label: 'Certificates', to: '/admin/certificates', icon: Award, any: ACCESS.certificates },
      { key: 'exits', label: 'Exit & Offboarding', to: '/admin/exits', icon: LogOut, any: ACCESS.exits },
      { key: 'chat', label: 'Team Chat', to: '/chat', icon: MessageSquare }
    ]
  },
  {
    group: 'Intern Trainee',
    key: 'intern-trainee',
    icon: GraduationCap,
    items: [
      // Staff management of trainees
      { key: 'trainees', label: 'Intern Trainees', to: '/admin/trainees', icon: GraduationCap, any: ACCESS.trainees },
      { key: 'training-programs', label: 'Training Programs', to: '/admin/trainees?tab=programs', icon: BookOpen, any: ACCESS.trainees },
      // Participant workspace
      { key: 'i-trainee', label: 'Intern Trainee Track', to: '/intern/trainee', icon: GraduationCap, any: ACCESS.internTrainee },
      { key: 'i-home', label: 'Dashboard', to: '/intern/dashboard', icon: LayoutDashboard, any: ACCESS.internHome },
      { key: 'i-projects', label: 'My Projects', to: '/admin/projects', icon: FolderKanban, any: ACCESS.internHome },
      { key: 'i-tasks', label: 'My Tasks', to: '/intern/tasks', icon: CheckSquare, any: ACCESS.internTasks },
      { key: 'i-chat', label: 'Team Chat', to: '/chat', icon: MessageSquare, any: ACCESS.internHome },
      { key: 'i-onboarding', label: 'Onboarding', to: '/intern/onboarding', icon: ClipboardList, any: ACCESS.internOnboarding },
      { key: 'i-journal', label: 'Daily Journal', to: '/intern/journal', icon: NotebookPen, any: ACCESS.internJournal },
      { key: 'i-attendance', label: 'Attendance', to: '/intern/attendance', icon: Clock, any: ACCESS.internAttendance },
      { key: 'i-leaves', label: 'Leave', to: '/intern/leaves', icon: CalendarDays, any: ACCESS.internLeaves },
      { key: 'i-learning', label: 'Learning', to: '/intern/learning', icon: GraduationCap, any: ACCESS.internLearning },
      { key: 'i-meetings', label: 'Meetings', to: '/intern/meetings', icon: Video, any: ACCESS.internMeetings },
      { key: 'i-performance', label: 'Performance', to: '/intern/performance', icon: Star, any: ACCESS.internPerformance },
      { key: 'i-finance', label: 'Stipend', to: '/intern/finance', icon: IndianRupee, any: ACCESS.internFinance },
      { key: 'i-documents', label: 'Documents', to: '/intern/documents', icon: Package, any: ACCESS.internDocuments },
      { key: 'i-certificates', label: 'Certificates', to: '/intern/certificates', icon: Award, any: ACCESS.internCertificates },
      { key: 'i-exit', label: 'Exit Status', to: '/intern/exit', icon: LogOut, any: ACCESS.internExit }
    ]
  },
  {
    group: 'Settings',
    key: 'settings',
    icon: Building2,
    items: [
      { key: 'account', label: 'Account & Security', to: '/account', icon: KeyRound },
      { key: 'settings', label: 'Organization Settings', to: '/admin/settings', icon: Building2, any: ACCESS.settings }
    ]
  }
];

/** Removes items (and empty groups) the user cannot open. */
export function visibleNav(auth) {
  if (!auth) return [];
  const currentRole = auth.effectiveRole || auth.activeRole || auth.user?.role;
  const isSuper = auth.isSuperAdmin && !auth.isPreviewMode;
  const isParticipant = currentRole === 'INTERN' || currentRole === 'INTERN_TRAINEE';
  const isTrainee = currentRole === 'INTERN_TRAINEE';
  const outsideOrg = isSuper && !session.getActingOrg();

  return NAV
    .filter((g) => {
      if (outsideOrg && !['Global Command', 'Settings'].includes(g.group)) return false;
      if (isParticipant && ['Global Command', 'Bootcamps'].includes(g.group)) return false;
      return true;
    })
    .map((g) => {
      const items = g.items.filter((it) => {
        const isParticipantOnlyItem = it.key.startsWith('i-');

        // Participants only see participant items & their account/chat
        if (isParticipant) {
          if (!isParticipantOnlyItem && it.key !== 'account' && it.key !== 'chat') return false;
          if (it.key === 'i-trainee' && !isTrainee) return false;
          return true;
        }

        // Staff / Admin never see the participant-only (i-*) items
        if (isParticipantOnlyItem) return false;

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
  const role = auth.effectiveRole || auth.activeRole || auth.user.role;
  if (role === 'SUPER_ADMIN' && auth.isSuperAdmin && !auth.isPreviewMode) return '/admin/global-command';
  if (role === 'INTERN_TRAINEE') return '/intern/trainee';
  if (role === 'INTERN') return '/intern/dashboard';
  if (role === 'ORGANIZATION_ADMIN') return '/admin/dashboard';
  if (auth.canAny(ACCESS.analytics)) return '/admin/dashboard';
  if (auth.canAny(ACCESS.internHome)) return '/intern/dashboard';
  return '/admin/dashboard';
}
