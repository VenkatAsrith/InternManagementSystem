// Shared Domain Constants & Enums for Intern Management System (IMS)
// Canonical Reference for TechMecha Torque (TMT) Enterprise Platform

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORGANIZATION_ADMIN: 'ORGANIZATION_ADMIN',
  HR_ADMIN: 'HR_ADMIN',
  HR_RECRUITER: 'HR_RECRUITER',
  PROGRAM_MANAGER: 'PROGRAM_MANAGER',
  MENTOR: 'MENTOR',
  TEAM_LEAD: 'TEAM_LEAD',
  INTERVIEWER: 'INTERVIEWER',
  FINANCE_ADMIN: 'FINANCE_ADMIN',
  FINANCE_VIEWER: 'FINANCE_VIEWER',
  DOCUMENT_ADMIN: 'DOCUMENT_ADMIN',
  AUDITOR: 'AUDITOR',
  INTERN: 'INTERN',
  CANDIDATE: 'CANDIDATE'
};

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['*'],
  ORGANIZATION_ADMIN: [
    'departments.*', 'programs.*', 'openings.*',
    'candidates.*', 'applications.*', 'interviews.*', 'offers.*',
    'onboarding.*', 'interns.*', 'projects.*', 'tasks.*',
    'learning.*', 'attendance.*', 'leaves.*', 'journals.*', 'meetings.*', 'feedback.*',
    'performance.*', 'documents.*', 'templates.*', 'certificates.*', 'finance.*',
    'assets.*', 'exit.*', 'analytics.*', 'settings.*', 'audit.read', 'roles.*', 'users.*',
    'people.*', 'leads.*', 'bootcamps.*', 'passes.*', 'demos.*', 'training.*', 'mailboxes.*'
  ],
  // HR Admin: people operations. Finance is READ-ONLY (segregation of duties, ROLE_PERMISSION_MATRIX.md)
  HR_ADMIN: [
    'departments.read', 'programs.*', 'openings.*', 'candidates.*', 'applications.*', 'interviews.*', 'offers.*',
    'onboarding.*', 'interns.read', 'interns.update', 'interns.create', 'documents.*', 'templates.read',
    'attendance.read', 'attendance.manage', 'leaves.*', 'performance.*', 'certificates.*', 'assets.*',
    'exit.*', 'finance.read', 'analytics.read', 'audit.read', 'users.read', 'users.create',
    'roles.read', 'roles.assign', 'tasks.*', 'projects.*', 'journals.read', 'journals.review', 'meetings.*',
    'people.*', 'leads.*', 'bootcamps.*', 'passes.*', 'demos.*', 'training.*', 'mailboxes.*'
  ],
  HR_RECRUITER: [
    'departments.read', 'programs.read', 'openings.*', 'candidates.*', 'applications.*', 'interviews.*',
    'offers.read', 'onboarding.read', 'analytics.read', 'users.read'
  ],
  PROGRAM_MANAGER: [
    'programs.read', 'departments.read', 'interns.read', 'interns.update', 'projects.*', 'tasks.*', 'learning.*',
    'attendance.read', 'leaves.*', 'journals.read', 'journals.review', 'meetings.*', 'feedback.*',
    'performance.*', 'assets.read', 'analytics.read', 'users.read', 'exit.read', 'exit.handover'
  ],
  MENTOR: [
    'interns.read', 'projects.read', 'tasks.*', 'journals.read', 'journals.review',
    'meetings.*', 'feedback.*', 'performance.read', 'performance.review', 'leaves.read', 'leaves.review', 'learning.read',
    'exit.handover', 'users.read'
  ],
  TEAM_LEAD: [
    'interns.read', 'projects.read', 'tasks.*', 'journals.read', 'meetings.*',
    'performance.read', 'performance.review', 'learning.read', 'users.read'
  ],
  INTERVIEWER: [
    'candidates.read', 'applications.read', 'interviews.read', 'interviews.feedback'
  ],
  FINANCE_ADMIN: [
    'finance.*', 'interns.read', 'offers.read', 'exit.read', 'exit.finance', 'analytics.finance', 'audit.read'
  ],
  FINANCE_VIEWER: [
    'finance.read', 'analytics.finance', 'interns.read'
  ],
  DOCUMENT_ADMIN: [
    'templates.*', 'documents.*', 'certificates.*', 'interns.read', 'exit.read', 'exit.documents'
  ],
  AUDITOR: [
    'audit.read', 'applications.read', 'interviews.read', 'offers.read', 'interns.read', 'attendance.read',
    'finance.read', 'performance.read', 'documents.read', 'certificates.read', 'exit.read',
    'leaves.read', 'assets.read', 'analytics.read'
  ],
  INTERN: [
    'profile.read', 'profile.update', 'interns.read_own', 'projects.read_own',
    'tasks.read_own', 'tasks.submit', 'tasks.progress', 'learning.read', 'learning.progress',
    'attendance.check_in', 'attendance.check_out', 'attendance.read_own',
    'leaves.request', 'leaves.read_own', 'journals.create', 'journals.read_own',
    'meetings.read_own', 'feedback.read_own', 'performance.read_own', 'performance.self_assess',
    'documents.read_own', 'documents.upload', 'certificates.read_own',
    'finance.read_own', 'assets.read_own', 'exit.read_own', 'onboarding.read_own', 'onboarding.update_own',
    'training.read_own', 'training.progress'
  ],
  // CANDIDATE accounts are not auto-provisioned; candidates act through tokenised public links.
  CANDIDATE: [
    'applications.read_own', 'interviews.read_own', 'offers.read_own', 'offers.accept_own'
  ]
};

export const ROLE_CATEGORY = {
  PLATFORM: 'PLATFORM',
  ADMINISTRATION: 'ADMINISTRATION',
  RECRUITMENT: 'RECRUITMENT',
  ENGINEERING: 'ENGINEERING',
  FINANCE: 'FINANCE',
  COMPLIANCE: 'COMPLIANCE',
  PARTICIPANT: 'PARTICIPANT'
};

export const ROLE_SCOPE = {
  GLOBAL: 'GLOBAL',
  ORGANIZATION: 'ORGANIZATION'
};

export const ROLE_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  ARCHIVED: 'ARCHIVED'
};

export const ROLE_DEFINITIONS = {
  SUPER_ADMIN: {
    key: 'SUPER_ADMIN',
    label: 'Global Administrator',
    description: 'Master platform owner with complete cross-tenant authority, system diagnostics, and tenant management.',
    category: ROLE_CATEGORY.PLATFORM,
    scope: ROLE_SCOPE.GLOBAL,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'adminNav',
    approvalRequired: false,
    assignableBy: ['SUPER_ADMIN'],
    permissions: ['*']
  },
  ORGANIZATION_ADMIN: {
    key: 'ORGANIZATION_ADMIN',
    label: 'Organization Administrator',
    description: 'Enterprise tenant executive with comprehensive administrative authority across all organization departments.',
    category: ROLE_CATEGORY.ADMINISTRATION,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'adminNav',
    approvalRequired: true,
    assignableBy: ['SUPER_ADMIN'],
    permissions: ROLE_PERMISSIONS.ORGANIZATION_ADMIN
  },
  HR_ADMIN: {
    key: 'HR_ADMIN',
    label: 'HR Administrator',
    description: 'Head of People Operations managing recruitment ATS, offers, onboarding checklists, leave approvals, and offboarding.',
    category: ROLE_CATEGORY.RECRUITMENT,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'adminNav',
    approvalRequired: false,
    assignableBy: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN'],
    permissions: ROLE_PERMISSIONS.HR_ADMIN
  },
  HR_RECRUITER: {
    key: 'HR_RECRUITER',
    label: 'HR Recruiter',
    description: 'Talent sourcer responsible for applicant screening, candidate communications, and interview scheduling.',
    category: ROLE_CATEGORY.RECRUITMENT,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'adminNav',
    approvalRequired: false,
    assignableBy: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'HR_ADMIN'],
    permissions: ROLE_PERMISSIONS.HR_RECRUITER
  },
  PROGRAM_MANAGER: {
    key: 'PROGRAM_MANAGER',
    label: 'Program Manager',
    description: 'Cohort track leader supervising academic schedules, sprint projects, mentor assignments, and milestones.',
    category: ROLE_CATEGORY.ADMINISTRATION,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'adminNav',
    approvalRequired: false,
    assignableBy: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN'],
    permissions: ROLE_PERMISSIONS.PROGRAM_MANAGER
  },
  MENTOR: {
    key: 'MENTOR',
    label: 'Technical Mentor',
    description: 'Direct technical supervisor providing code reviews, daily journal feedback, 1-on-1 mentorship, and appraisals.',
    category: ROLE_CATEGORY.ENGINEERING,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'mentorNav',
    approvalRequired: false,
    assignableBy: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'HR_ADMIN', 'PROGRAM_MANAGER'],
    permissions: ROLE_PERMISSIONS.MENTOR
  },
  TEAM_LEAD: {
    key: 'TEAM_LEAD',
    label: 'Technical Team Lead',
    description: 'Engineering team leader coordinating sprint tasks, deliverable submissions, and technical evaluation.',
    category: ROLE_CATEGORY.ENGINEERING,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'mentorNav',
    approvalRequired: false,
    assignableBy: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'PROGRAM_MANAGER'],
    permissions: ROLE_PERMISSIONS.TEAM_LEAD
  },
  INTERVIEWER: {
    key: 'INTERVIEWER',
    label: 'Interview Panelist',
    description: 'Technical and domain assessor conducting candidate interview panels and submitting standardized scorecards.',
    category: ROLE_CATEGORY.RECRUITMENT,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'adminNav',
    approvalRequired: false,
    assignableBy: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'HR_ADMIN'],
    permissions: ROLE_PERMISSIONS.INTERVIEWER
  },
  FINANCE_ADMIN: {
    key: 'FINANCE_ADMIN',
    label: 'Finance Administrator',
    description: 'Stipend disbursement officer managing compensation plans, payment ledgers, deductions, and exit settlements.',
    category: ROLE_CATEGORY.FINANCE,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'adminNav',
    approvalRequired: true,
    assignableBy: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN'],
    permissions: ROLE_PERMISSIONS.FINANCE_ADMIN
  },
  FINANCE_VIEWER: {
    key: 'FINANCE_VIEWER',
    label: 'Finance Auditor / Viewer',
    description: 'Read-only financial auditor reviewing stipend histories, cost summaries, and ledger entries.',
    category: ROLE_CATEGORY.FINANCE,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'adminNav',
    approvalRequired: false,
    assignableBy: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'FINANCE_ADMIN'],
    permissions: ROLE_PERMISSIONS.FINANCE_VIEWER
  },
  DOCUMENT_ADMIN: {
    key: 'DOCUMENT_ADMIN',
    label: 'Document Administrator',
    description: 'Letter template and official credential manager managing document versions, signatures, and certificates.',
    category: ROLE_CATEGORY.ADMINISTRATION,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'adminNav',
    approvalRequired: false,
    assignableBy: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN'],
    permissions: ROLE_PERMISSIONS.DOCUMENT_ADMIN
  },
  AUDITOR: {
    key: 'AUDITOR',
    label: 'Compliance Auditor',
    description: 'Independent compliance and regulatory inspector with read-only access to immutable audit events.',
    category: ROLE_CATEGORY.COMPLIANCE,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'adminNav',
    approvalRequired: true,
    assignableBy: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN'],
    permissions: ROLE_PERMISSIONS.AUDITOR
  },
  INTERN: {
    key: 'INTERN',
    label: 'Engineering Intern',
    description: 'Active cohort participant delivering sprint tasks, attending meetings, writing journals, and tracking milestones.',
    category: ROLE_CATEGORY.PARTICIPANT,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'internNav',
    approvalRequired: false,
    assignableBy: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'HR_ADMIN'],
    permissions: ROLE_PERMISSIONS.INTERN
  },
  CANDIDATE: {
    key: 'CANDIDATE',
    label: 'Applicant / Candidate',
    description: 'External applicant tracking job applications, viewing scheduled interviews, and accepting offer letters.',
    category: ROLE_CATEGORY.PARTICIPANT,
    scope: ROLE_SCOPE.ORGANIZATION,
    isSystemRole: true,
    status: ROLE_STATUS.ACTIVE,
    defaultNavigation: 'publicNav',
    approvalRequired: false,
    assignableBy: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'HR_ADMIN', 'HR_RECRUITER'],
    permissions: ROLE_PERMISSIONS.CANDIDATE
  }
};

export const PERMISSION_GROUPS = [
  {
    module: 'Recruitment & Candidates',
    permissions: [
      { key: 'openings.*', label: 'Manage Openings (All)' },
      { key: 'openings.read', label: 'View Openings' },
      { key: 'openings.manage', label: 'Create / Edit / Close Openings' },
      { key: 'programs.read', label: 'View Internship Programs' },
      { key: 'programs.manage', label: 'Manage Internship Programs' },
      { key: 'candidates.read', label: 'View Candidates' },
      { key: 'applications.*', label: 'Manage Applications (All)' },
      { key: 'applications.read', label: 'View Applications' },
      { key: 'applications.stage', label: 'Move Applications Between Stages' },
      { key: 'applications.notes', label: 'Add Internal Application Notes' },
      { key: 'interviews.*', label: 'Manage Interviews (All)' },
      { key: 'interviews.read', label: 'View Interviews' },
      { key: 'interviews.schedule', label: 'Schedule / Reschedule / Cancel Interviews' },
      { key: 'interviews.feedback', label: 'Submit Interview Scorecards' },
      { key: 'offers.*', label: 'Manage Offers (All)' },
      { key: 'offers.read', label: 'View Offers' },
      { key: 'offers.create', label: 'Draft Offer Letters' },
      { key: 'offers.send', label: 'Send / Revoke Offers' },
      { key: 'offers.accept', label: 'Record Offer Acceptance On Behalf Of Candidate' }
    ]
  },
  {
    module: 'Internship Operations & Attendance',
    permissions: [
      { key: 'onboarding.*', label: 'Manage Onboarding Plans' },
      { key: 'onboarding.read', label: 'View Onboarding Plans' },
      { key: 'interns.*', label: 'Manage Intern Directory' },
      { key: 'interns.read', label: 'View Intern Profiles' },
      { key: 'interns.update', label: 'Update Intern Records / Assign Mentors' },
      { key: 'attendance.*', label: 'Manage All Attendance Records' },
      { key: 'attendance.read', label: 'View Attendance Records' },
      { key: 'attendance.manage', label: 'Correct Attendance Records' },
      { key: 'leaves.*', label: 'Approve & Manage Leaves' },
      { key: 'leaves.read', label: 'View Leave Requests' },
      { key: 'leaves.review', label: 'Approve / Reject Leave Requests' }
    ]
  },
  {
    module: 'Work Delivery & Projects',
    permissions: [
      { key: 'projects.*', label: 'Manage Projects (All)' },
      { key: 'projects.read', label: 'View Projects' },
      { key: 'tasks.*', label: 'Manage Tasks (All)' },
      { key: 'tasks.read', label: 'View Tasks' },
      { key: 'tasks.assign', label: 'Create / Assign Tasks' },
      { key: 'tasks.review', label: 'Review PR & Task Submissions' },
      { key: 'journals.*', label: 'Manage Daily Journals' },
      { key: 'journals.read', label: 'View Daily Journals' },
      { key: 'journals.review', label: 'Review & Sign Daily Journals' },
      { key: 'meetings.*', label: 'Schedule & Host Meetings' },
      { key: 'meetings.read', label: 'View Meetings' }
    ]
  },
  {
    module: 'Performance & Learning',
    permissions: [
      { key: 'learning.*', label: 'Manage Learning Paths' },
      { key: 'learning.read', label: 'View Learning Curricula' },
      { key: 'performance.*', label: 'Manage All Performance Reviews' },
      { key: 'performance.read', label: 'View Performance Reviews' },
      { key: 'performance.review', label: 'Conduct Mentor Appraisals' },
      { key: 'feedback.*', label: 'Provide Direct Feedback' }
    ]
  },
  {
    module: 'Documents & Templates',
    permissions: [
      { key: 'templates.*', label: 'Manage Letter Templates' },
      { key: 'templates.read', label: 'View Letter Templates' },
      { key: 'documents.*', label: 'Manage Official Documents' },
      { key: 'documents.read', label: 'View / Download Documents' },
      { key: 'documents.generate', label: 'Generate Official Letters' },
      { key: 'documents.approve', label: 'Approve / Reject Uploaded Documents' },
      { key: 'certificates.*', label: 'Issue & Manage Certificates' },
      { key: 'certificates.read', label: 'View Certificates' },
      { key: 'certificates.issue', label: 'Issue Certificates' },
      { key: 'certificates.revoke', label: 'Revoke Certificates' }
    ]
  },
  {
    module: 'Finance, Assets & Exit',
    permissions: [
      { key: 'finance.*', label: 'Manage Finance & Stipends (All)' },
      { key: 'finance.read', label: 'View Stipend Statements' },
      { key: 'finance.manage', label: 'Generate Payroll & Adjustments' },
      { key: 'finance.process', label: 'Disburse Payments' },
      { key: 'assets.*', label: 'Manage IT Assets & Hardware' },
      { key: 'assets.read', label: 'View Asset Allocations' },
      { key: 'exit.*', label: 'Manage Offboarding & Exits' },
      { key: 'exit.read', label: 'View Exit Records' },
      { key: 'exit.handover', label: 'Sign Off Deliverable Handover' },
      { key: 'exit.finance', label: 'Sign Off Final Settlement' },
      { key: 'exit.documents', label: 'Sign Off Exit Documentation' }
    ]
  },
  {
    module: 'Governance & Security',
    permissions: [
      { key: 'audit.read', label: 'View Audit Event Logs' },
      { key: 'analytics.read', label: 'View Operational Analytics' },
      { key: 'analytics.finance', label: 'View Finance Analytics' },
      { key: 'settings.*', label: 'Manage Organization Settings' },
      { key: 'departments.read', label: 'View Departments' },
      { key: 'roles.*', label: 'Manage Roles & Permissions' },
      { key: 'roles.read', label: 'View Roles' },
      { key: 'roles.assign', label: 'Assign Roles To Users' },
      { key: 'users.*', label: 'Manage User Accounts' },
      { key: 'users.read', label: 'View Users' },
      { key: 'users.create', label: 'Create Users' }
    ]
  }
];

// Every permission key a CUSTOM role is allowed to contain. '*' is never assignable to a custom role.
export const ASSIGNABLE_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));

// Canonical application pipeline (see docs/qa/CANONICAL_RULES.md).
// SOURCING is represented by the public/portal intake that creates an APPLIED application.
// INTERVIEWED is the explicit realisation of "INTERVIEW_SCHEDULED with scorecard complete".
// REJECTED / WITHDRAWN / ON_HOLD / OFFER_DECLINED / OFFER_EXPIRED are exit branches, not lifecycle stages.
export const APPLICATION_STATUS = {
  APPLIED: 'APPLIED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  SHORTLISTED: 'SHORTLISTED',
  INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED',
  INTERVIEWED: 'INTERVIEWED',
  SELECTED: 'SELECTED',
  OFFER_DRAFT: 'OFFER_DRAFT',
  OFFER_SENT: 'OFFER_SENT',
  OFFER_ACCEPTED: 'OFFER_ACCEPTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  ON_HOLD: 'ON_HOLD',
  OFFER_DECLINED: 'OFFER_DECLINED',
  OFFER_EXPIRED: 'OFFER_EXPIRED'
};

export const INTERVIEW_STATUS = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
  RESCHEDULED: 'RESCHEDULED'
};

export const INTERVIEW_RECOMMENDATION = {
  STRONG_YES: 'STRONG_YES',
  YES: 'YES',
  MAYBE: 'MAYBE',
  NO: 'NO',
  STRONG_NO: 'STRONG_NO'
};

export const OFFER_STATUS = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED'
};

export const ONBOARDING_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
  SKIPPED: 'SKIPPED'
};

// Canonical intern-side lifecycle. Exit progress (EXIT_INITIATED..ALUMNI) mirrors the Exit stage machine.
export const INTERN_STATUS = {
  PRE_ONBOARDING: 'PRE_ONBOARDING',
  ONBOARDING: 'ONBOARDING',
  ACTIVE: 'ACTIVE',
  PERFORMANCE_REVIEW: 'PERFORMANCE_REVIEW',
  EXIT_INITIATED: 'EXIT_INITIATED',
  ASSET_CLEARANCE: 'ASSET_CLEARANCE',
  FINAL_SETTLEMENT: 'FINAL_SETTLEMENT',
  CERTIFICATION: 'CERTIFICATION',
  ALUMNI: 'ALUMNI',
  TERMINATED: 'TERMINATED'
};

// Legacy values written by earlier builds -> canonical value (used by migration + read-time tolerance)
export const LEGACY_INTERN_STATUS_MAP = {
  MID_TERM_REVIEW: 'PERFORMANCE_REVIEW',
  COMPLETION_PENDING: 'PERFORMANCE_REVIEW',
  COMPLETED: 'CERTIFICATION',
  OFFBOARDING: 'ASSET_CLEARANCE',
  EXTENDED: 'ACTIVE',
  CERTIFICATE_ISSUED: 'CERTIFICATION'
};

// BACKLOG > TODO > IN_PROGRESS (<> BLOCKED) > SUBMITTED > IN_REVIEW > APPROVED (== DONE)
// REVISION_REQUIRED loops back to IN_PROGRESS/SUBMITTED; CANCELLED is a staff-only terminal.
export const TASK_STATUS = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  SUBMITTED: 'SUBMITTED',
  IN_REVIEW: 'IN_REVIEW',
  REVISION_REQUIRED: 'REVISION_REQUIRED',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED'
};

export const LEGACY_TASK_STATUS_MAP = { COMPLETED: 'APPROVED' };

export const TASK_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
};

export const SUBMISSION_STATUS = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REVISION_REQUIRED: 'REVISION_REQUIRED',
  REJECTED: 'REJECTED'
};

export const PROJECT_STATUS = {
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  HALF_DAY: 'HALF_DAY',
  LEAVE: 'LEAVE',
  HOLIDAY: 'HOLIDAY',
  WEEKEND: 'WEEKEND'
};

export const ATTENDANCE_MODE = {
  WEB: 'WEB',
  QR: 'QR',
  REMOTE: 'REMOTE',
  ON_SITE: 'ON_SITE',
  HYBRID: 'HYBRID',
  MANUAL: 'MANUAL',
  ADMIN_OVERRIDE: 'ADMIN_OVERRIDE'
};

export const LEAVE_TYPE = {
  SICK: 'SICK',
  CASUAL: 'CASUAL',
  ACADEMIC: 'ACADEMIC',
  EMERGENCY: 'EMERGENCY',
  UNPAID: 'UNPAID'
};

export const LEAVE_STATUS = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  CANCELLED_WORKED: 'CANCELLED_WORKED'
};

export const JOURNAL_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  REVIEWED: 'REVIEWED'
};

export const MEETING_TYPE = {
  MENTOR_1ON1: 'MENTOR_1ON1',
  TEAM: 'TEAM',
  REVIEW: 'REVIEW',
  TRAINING: 'TRAINING',
  INTERVIEW: 'INTERVIEW',
  ORIENTATION: 'ORIENTATION',
  OTHER: 'OTHER'
};

export const PERFORMANCE_REVIEW_TYPE = {
  PROBATIONARY: 'PROBATIONARY',
  MID_TERM: 'MID_TERM',
  MONTHLY: 'MONTHLY',
  FINAL: 'FINAL',
  AD_HOC: 'AD_HOC'
};

export const PERFORMANCE_REVIEW_STATUS = {
  DRAFT: 'DRAFT',
  SELF_ASSESSMENT_PENDING: 'SELF_ASSESSMENT_PENDING',
  MENTOR_ASSESSMENT_PENDING: 'MENTOR_ASSESSMENT_PENDING',
  MANAGER_REVIEW_PENDING: 'MANAGER_REVIEW_PENDING',
  FINALIZED: 'FINALIZED'
};

// 26 Enterprise Document Types (§6 & DOCUMENT_CATALOG.md)
export const DOCUMENT_TYPE = {
  APPLICATION_CONFIRMATION: 'APPLICATION_CONFIRMATION',
  INTERVIEW_INVITATION: 'INTERVIEW_INVITATION',
  INTERVIEW_RESULT: 'INTERVIEW_RESULT',
  SELECTION_LETTER: 'SELECTION_LETTER',
  OFFER_LETTER: 'OFFER_LETTER',
  INTERNSHIP_AGREEMENT: 'INTERNSHIP_AGREEMENT',
  NDA_AGREEMENT: 'NDA_AGREEMENT',
  JOINING_LETTER: 'JOINING_LETTER',
  WELCOME_LETTER: 'WELCOME_LETTER',
  VERIFICATION_LETTER: 'VERIFICATION_LETTER',
  INTERN_ID_LETTER: 'INTERN_ID_LETTER',
  PERFORMANCE_REVIEW: 'PERFORMANCE_REVIEW',
  WARNING_LETTER: 'WARNING_LETTER',
  EXTENSION_LETTER: 'EXTENSION_LETTER',
  STIPEND_LETTER: 'STIPEND_LETTER',
  PAYMENT_STATEMENT: 'PAYMENT_STATEMENT',
  COMPLETION_LETTER: 'COMPLETION_LETTER',
  EXPERIENCE_LETTER: 'EXPERIENCE_LETTER',
  CERTIFICATE: 'CERTIFICATE',
  RECOMMENDATION_LETTER: 'RECOMMENDATION_LETTER',
  EXIT_LETTER: 'EXIT_LETTER',
  RESIGNATION_ACCEPTANCE: 'RESIGNATION_ACCEPTANCE',
  TERMINATION_LETTER: 'TERMINATION_LETTER',
  RELIEVING_LETTER: 'RELIEVING_LETTER',
  FINAL_SETTLEMENT_STATEMENT: 'FINAL_SETTLEMENT_STATEMENT',
  ASSET_HANDOVER_RECEIPT: 'ASSET_HANDOVER_RECEIPT'
};

export const DOCUMENT_CATEGORY = {
  RESUME: 'RESUME',
  ID_PROOF: 'ID_PROOF',
  COLLEGE_ID: 'COLLEGE_ID',
  NDA: 'NDA',
  AGREEMENT: 'AGREEMENT',
  OFFER_LETTER: 'OFFER_LETTER',
  EVALUATION: 'EVALUATION',
  CERTIFICATE: 'CERTIFICATE',
  EXPERIENCE_LETTER: 'EXPERIENCE_LETTER',
  LOR: 'LOR',
  FINANCE: 'FINANCE',
  EXIT: 'EXIT',
  OTHER: 'OTHER'
};

export const DOCUMENT_STATUS = {
  DRAFT: 'DRAFT',
  UPLOADED: 'UPLOADED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  GENERATED: 'GENERATED',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  ARCHIVED: 'ARCHIVED'
};

// Finance Subsystem Constants (§4 & §30)
export const COMPENSATION_TYPE = {
  MONTHLY_STIPEND: 'MONTHLY_STIPEND',
  DAILY_RATE: 'DAILY_RATE',
  HOURLY_RATE: 'HOURLY_RATE',
  PERFORMANCE_BONUS: 'PERFORMANCE_BONUS',
  UNPAID: 'UNPAID'
};

export const PAYMENT_STATUS = {
  PAID: 'PAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  ON_HOLD: 'ON_HOLD',
  WAIVED: 'WAIVED',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
};

export const LEDGER_ENTRY_TYPE = {
  STIPEND: 'STIPEND',
  BONUS: 'BONUS',
  DEDUCTION: 'DEDUCTION',
  PENALTY: 'PENALTY',
  REIMBURSEMENT: 'REIMBURSEMENT',
  ADVANCE: 'ADVANCE',
  ADJUSTMENT: 'ADJUSTMENT'
};

// Exit & Offboarding Constants (§5)
export const EXIT_REASON = {
  COMPLETION: 'COMPLETION',
  EARLY_COMPLETION: 'EARLY_COMPLETION',
  RESIGNATION: 'RESIGNATION',
  TERMINATION_PERFORMANCE: 'TERMINATION_PERFORMANCE',
  TERMINATION_MISCONDUCT: 'TERMINATION_MISCONDUCT',
  ABSCONDED: 'ABSCONDED',
  MUTUAL_SEPARATION: 'MUTUAL_SEPARATION',
  MEDICAL_PERSONAL: 'MEDICAL_PERSONAL',
  CONTRACT_EXPIRED: 'CONTRACT_EXPIRED',
  EMPLOYEE_CONVERSION: 'EMPLOYEE_CONVERSION'
};

// Canonical exit pipeline. Counting the intern's ACTIVE state this is the 10-position offboarding lifecycle
// described in TMT_OPERATIONS_PLATFORM_V1.1_MASTER.md section 9.2 (its diagram and list disagree; see CANONICAL_RULES.md).
export const EXIT_STATUS = {
  EXIT_INITIATED: 'EXIT_INITIATED',
  NOTICE_PERIOD: 'NOTICE_PERIOD',
  HANDOVER: 'HANDOVER',
  ASSET_CLEARANCE: 'ASSET_CLEARANCE',
  FINAL_SETTLEMENT: 'FINAL_SETTLEMENT',
  DOCUMENTATION: 'DOCUMENTATION',
  DEACTIVATED: 'DEACTIVATED',
  ARCHIVED: 'ARCHIVED',
  ALUMNI: 'ALUMNI'
};

export const LEGACY_EXIT_STATUS_MAP = {
  EXIT_REVIEW: 'EXIT_INITIATED',
  EXIT_APPROVED: 'NOTICE_PERIOD',
  OFFBOARDING: 'HANDOVER',
  FINANCE_SETTLEMENT: 'FINAL_SETTLEMENT',
  DOCUMENT_FINALIZATION: 'DOCUMENTATION',
  ACCESS_REVOCATION: 'DEACTIVATED',
  EXIT_COMPLETED: 'ALUMNI'
};

// Asset Management Constants (§49)
export const ASSET_TYPE = {
  LAPTOP: 'LAPTOP',
  MONITOR: 'MONITOR',
  ID_CARD: 'ID_CARD',
  SIM: 'SIM',
  SOFTWARE_ACCESS: 'SOFTWARE_ACCESS',
  EMAIL_ACCOUNT: 'EMAIL_ACCOUNT',
  OTHER_EQUIPMENT: 'OTHER_EQUIPMENT'
};

export const ASSET_STATUS = {
  AVAILABLE: 'AVAILABLE',
  REQUESTED: 'REQUESTED',
  ASSIGNED: 'ASSIGNED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RETURN_PENDING: 'RETURN_PENDING',
  RETURNED: 'RETURNED',
  LOST: 'LOST',
  DAMAGED: 'DAMAGED',
  WAIVED: 'WAIVED'
};

// Email & Notification Engine Constants (§12 & §39)
export const NOTIFICATION_CHANNEL = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  WHATSAPP: 'WHATSAPP'
};

export const EMAIL_STATUS = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
  CANCELLED: 'CANCELLED'
};
