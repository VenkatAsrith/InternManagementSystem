// ============================================================================
// CANONICAL LIFECYCLE RULES  (single source of truth for API, database layer and UI)
// See docs/qa/CANONICAL_RULES.md for the human readable version of these tables.
// ============================================================================
import {
  APPLICATION_STATUS as A,
  OFFER_STATUS as O,
  INTERN_STATUS as I,
  TASK_STATUS as T,
  EXIT_STATUS as E,
  LEAVE_STATUS as L,
  PAYMENT_STATUS as P
} from './constants.js';

export class TransitionError extends Error {
  constructor(entity, from, to, allowed = []) {
    super(`Invalid ${entity} transition: ${from} -> ${to}. Allowed from ${from}: ${allowed.join(', ') || 'none'}.`);
    this.name = 'TransitionError';
    this.statusCode = 409;
    this.code = 'INVALID_TRANSITION';
    this.details = { entity, from, to, allowed };
  }
}

export function canTransition(table, from, to) {
  return Array.isArray(table[from]) && table[from].includes(to);
}

export function assertTransition(entity, table, from, to) {
  if (!canTransition(table, from, to)) {
    throw new TransitionError(entity, from, to, table[from] || []);
  }
}

// ---------------------------------------------------------------------------
// APPLICATION  (full table = everything the system may do; manual table = what a human may request)
// ---------------------------------------------------------------------------
export const APPLICATION_TRANSITIONS = {
  [A.APPLIED]: [A.UNDER_REVIEW, A.REJECTED, A.WITHDRAWN, A.ON_HOLD],
  [A.UNDER_REVIEW]: [A.SHORTLISTED, A.REJECTED, A.WITHDRAWN, A.ON_HOLD],
  [A.SHORTLISTED]: [A.INTERVIEW_SCHEDULED, A.REJECTED, A.WITHDRAWN, A.ON_HOLD],
  [A.INTERVIEW_SCHEDULED]: [A.INTERVIEWED, A.SHORTLISTED, A.REJECTED, A.WITHDRAWN],
  [A.INTERVIEWED]: [A.SELECTED, A.INTERVIEW_SCHEDULED, A.REJECTED, A.WITHDRAWN, A.ON_HOLD],
  [A.SELECTED]: [A.OFFER_DRAFT, A.REJECTED, A.WITHDRAWN, A.ON_HOLD],
  [A.OFFER_DRAFT]: [A.OFFER_SENT, A.SELECTED, A.REJECTED, A.WITHDRAWN],
  [A.OFFER_SENT]: [A.OFFER_ACCEPTED, A.OFFER_DECLINED, A.OFFER_EXPIRED, A.SELECTED, A.WITHDRAWN],
  [A.OFFER_EXPIRED]: [A.OFFER_DRAFT, A.REJECTED],
  [A.ON_HOLD]: [A.UNDER_REVIEW, A.SHORTLISTED, A.INTERVIEWED, A.SELECTED, A.REJECTED, A.WITHDRAWN],
  [A.OFFER_ACCEPTED]: [],
  [A.OFFER_DECLINED]: [],
  [A.REJECTED]: [],
  [A.WITHDRAWN]: []
};

// Stage changes an HR user may request through PATCH /recruitment/applications/:id/stage.
// Everything else (INTERVIEW_SCHEDULED, INTERVIEWED, OFFER_*) is produced by its owning workflow.
export const APPLICATION_MANUAL_TRANSITIONS = {
  [A.APPLIED]: [A.UNDER_REVIEW, A.REJECTED, A.WITHDRAWN, A.ON_HOLD],
  [A.UNDER_REVIEW]: [A.SHORTLISTED, A.REJECTED, A.WITHDRAWN, A.ON_HOLD],
  [A.SHORTLISTED]: [A.REJECTED, A.WITHDRAWN, A.ON_HOLD],
  [A.INTERVIEW_SCHEDULED]: [A.REJECTED, A.WITHDRAWN],
  [A.INTERVIEWED]: [A.SELECTED, A.REJECTED, A.WITHDRAWN, A.ON_HOLD],
  [A.SELECTED]: [A.REJECTED, A.WITHDRAWN, A.ON_HOLD],
  [A.OFFER_DRAFT]: [A.REJECTED, A.WITHDRAWN],
  [A.OFFER_SENT]: [A.WITHDRAWN],
  [A.ON_HOLD]: [A.UNDER_REVIEW, A.SHORTLISTED, A.INTERVIEWED, A.SELECTED, A.REJECTED, A.WITHDRAWN]
};

export const APPLICATION_TERMINAL = [A.OFFER_ACCEPTED, A.OFFER_DECLINED, A.REJECTED, A.WITHDRAWN];
// Only these statuses RELEASE the candidate's claim on an opening (they may re-apply).
// Every other status - including OFFER_ACCEPTED and OFFER_EXPIRED - keeps the claim, which is what the
// unique `activeKey` index on Application enforces at database level.
export const APPLICATION_CLAIM_RELEASED = [A.REJECTED, A.WITHDRAWN, A.OFFER_DECLINED];
export const APPLICATION_ACTIVE_STATUSES = Object.values(A).filter(s => !APPLICATION_CLAIM_RELEASED.includes(s));
// Statuses that require a recorded reason/note.
export const APPLICATION_NOTE_REQUIRED = [A.REJECTED, A.WITHDRAWN, A.ON_HOLD];

// ---------------------------------------------------------------------------
// OFFER
// ---------------------------------------------------------------------------
export const OFFER_TRANSITIONS = {
  [O.DRAFT]: [O.SENT, O.REVOKED],
  [O.SENT]: [O.VIEWED, O.ACCEPTED, O.DECLINED, O.EXPIRED, O.REVOKED],
  [O.VIEWED]: [O.ACCEPTED, O.DECLINED, O.EXPIRED, O.REVOKED],
  [O.ACCEPTED]: [],
  [O.DECLINED]: [],
  [O.EXPIRED]: [],
  [O.REVOKED]: []
};
export const OFFER_OPEN_STATUSES = [O.DRAFT, O.SENT, O.VIEWED];
export const OFFER_ACCEPTABLE_STATUSES = [O.SENT, O.VIEWED];

// ---------------------------------------------------------------------------
// INTERN
// ---------------------------------------------------------------------------
export const INTERN_TRANSITIONS = {
  [I.PRE_ONBOARDING]: [I.ONBOARDING, I.TERMINATED],
  [I.ONBOARDING]: [I.ACTIVE, I.TERMINATED],
  [I.ACTIVE]: [I.PERFORMANCE_REVIEW, I.EXIT_INITIATED, I.TERMINATED],
  [I.PERFORMANCE_REVIEW]: [I.ACTIVE, I.EXIT_INITIATED, I.TERMINATED],
  [I.EXIT_INITIATED]: [I.ACTIVE, I.ASSET_CLEARANCE, I.TERMINATED],
  [I.ASSET_CLEARANCE]: [I.FINAL_SETTLEMENT, I.TERMINATED],
  [I.FINAL_SETTLEMENT]: [I.CERTIFICATION, I.TERMINATED],
  [I.CERTIFICATION]: [I.ALUMNI, I.TERMINATED],
  [I.ALUMNI]: [],
  [I.TERMINATED]: []
};

// Transitions a human may request via PATCH /interns/:id. Exit-related moves belong to the Exit module.
export const INTERN_MANUAL_TRANSITIONS = {
  [I.PRE_ONBOARDING]: [I.ONBOARDING],
  [I.ONBOARDING]: [I.ACTIVE],
  [I.ACTIVE]: [I.PERFORMANCE_REVIEW],
  [I.PERFORMANCE_REVIEW]: [I.ACTIVE]
};

// Statuses in which the intern is operationally working (attendance, tasks, journals, payroll accrual).
export const INTERN_WORKING_STATUSES = [I.ACTIVE, I.PERFORMANCE_REVIEW, I.EXIT_INITIATED];
export const INTERN_PAYABLE_STATUSES = [I.ACTIVE, I.PERFORMANCE_REVIEW, I.EXIT_INITIATED, I.ASSET_CLEARANCE, I.FINAL_SETTLEMENT, I.CERTIFICATION, I.ALUMNI, I.TERMINATED];
export const INTERN_CLOSED_STATUSES = [I.ALUMNI, I.TERMINATED];

// ---------------------------------------------------------------------------
// TASK
// ---------------------------------------------------------------------------
export const TASK_TRANSITIONS = {
  [T.BACKLOG]: [T.TODO, T.CANCELLED],
  [T.TODO]: [T.IN_PROGRESS, T.BACKLOG, T.CANCELLED],
  [T.IN_PROGRESS]: [T.BLOCKED, T.TODO, T.SUBMITTED, T.CANCELLED],
  [T.BLOCKED]: [T.IN_PROGRESS, T.CANCELLED],
  [T.SUBMITTED]: [T.IN_REVIEW, T.APPROVED, T.REVISION_REQUIRED, T.IN_PROGRESS, T.CANCELLED],
  [T.IN_REVIEW]: [T.APPROVED, T.REVISION_REQUIRED, T.IN_PROGRESS, T.CANCELLED],
  [T.REVISION_REQUIRED]: [T.IN_PROGRESS, T.SUBMITTED, T.CANCELLED],
  [T.APPROVED]: [],
  [T.CANCELLED]: [T.TODO]
};
// What the assignee may do through POST /tasks/:id/status (submission has its own endpoint).
export const TASK_ASSIGNEE_TRANSITIONS = {
  [T.TODO]: [T.IN_PROGRESS],
  [T.IN_PROGRESS]: [T.BLOCKED, T.TODO],
  [T.BLOCKED]: [T.IN_PROGRESS],
  [T.REVISION_REQUIRED]: [T.IN_PROGRESS]
};
// What staff (tasks.assign / tasks.review) may do through POST /tasks/:id/status (review decisions have their own endpoint).
export const TASK_STAFF_TRANSITIONS = {
  [T.BACKLOG]: [T.TODO, T.CANCELLED],
  [T.TODO]: [T.IN_PROGRESS, T.BACKLOG, T.CANCELLED],
  [T.IN_PROGRESS]: [T.BLOCKED, T.TODO, T.CANCELLED],
  [T.BLOCKED]: [T.IN_PROGRESS, T.CANCELLED],
  [T.SUBMITTED]: [T.IN_REVIEW, T.CANCELLED],
  [T.IN_REVIEW]: [T.CANCELLED],
  [T.REVISION_REQUIRED]: [T.IN_PROGRESS, T.CANCELLED],
  [T.CANCELLED]: [T.TODO]
};
export const TASK_OPEN_STATUSES = [T.BACKLOG, T.TODO, T.IN_PROGRESS, T.BLOCKED, T.SUBMITTED, T.IN_REVIEW, T.REVISION_REQUIRED];
export const TASK_DONE_STATUSES = [T.APPROVED];
export const TASK_SUBMITTABLE_STATUSES = [T.IN_PROGRESS, T.REVISION_REQUIRED];
export const TASK_REVIEWABLE_STATUSES = [T.SUBMITTED, T.IN_REVIEW];

// ---------------------------------------------------------------------------
// LEAVE / PAYMENT
// ---------------------------------------------------------------------------
export const LEAVE_TRANSITIONS = {
  [L.REQUESTED]: [L.APPROVED, L.REJECTED, L.CANCELLED],
  [L.APPROVED]: [L.CANCELLED, L.CANCELLED_WORKED],
  [L.REJECTED]: [],
  [L.CANCELLED]: [],
  [L.CANCELLED_WORKED]: []
};

export const PAYMENT_TRANSITIONS = {
  [P.PENDING]: [P.PAID, P.ON_HOLD, P.CANCELLED, P.WAIVED],
  [P.ON_HOLD]: [P.PENDING, P.CANCELLED],
  [P.PAID]: [],
  [P.CANCELLED]: [],
  [P.WAIVED]: []
};
export const PAYMENT_MUTABLE_STATUSES = [P.PENDING, P.ON_HOLD];
export const PAYMENT_UNSETTLED_STATUSES = [P.PENDING, P.ON_HOLD, P.PROCESSING, P.FAILED, P.PARTIALLY_PAID];

// ---------------------------------------------------------------------------
// EXIT  (each stage = the step currently in progress; advancing completes it)
// Every stage documents: owner, required action, blocking conditions, mirrored intern status.
// ---------------------------------------------------------------------------
export const EXIT_STAGE_ORDER = [
  E.EXIT_INITIATED, E.NOTICE_PERIOD, E.HANDOVER, E.ASSET_CLEARANCE,
  E.FINAL_SETTLEMENT, E.DOCUMENTATION, E.DEACTIVATED, E.ARCHIVED, E.ALUMNI
];

export const EXIT_STAGE_DEFS = {
  [E.EXIT_INITIATED]: {
    label: 'Exit Initiated', owner: 'HR', permission: 'exit.manage', internStatus: I.EXIT_INITIATED,
    action: 'Review the exit request and confirm the last working day.',
    blockers: 'None. Completing this stage starts the notice period.'
  },
  [E.NOTICE_PERIOD]: {
    label: 'Notice Period', owner: 'HR', permission: 'exit.manage', internStatus: I.EXIT_INITIATED,
    action: 'Knowledge-transfer window. Skipped automatically when the notice period is 0 days.',
    blockers: 'Notice period days must have elapsed since initiation unless HR waives it with a reason.'
  },
  [E.HANDOVER]: {
    label: 'Deliverable Handover', owner: 'MENTOR / PROGRAM_MANAGER', permission: 'exit.handover', internStatus: I.EXIT_INITIATED,
    action: 'Open work is completed, reassigned or cancelled and documentation is signed off.',
    blockers: 'No open tasks assigned to the intern unless waived with a reason.'
  },
  [E.ASSET_CLEARANCE]: {
    label: 'Asset Clearance', owner: 'HR / IT', permission: 'exit.manage', internStatus: I.ASSET_CLEARANCE,
    action: 'Every assigned asset is returned (or waived with a reason).',
    blockers: 'No assets in ASSIGNED / RETURN_PENDING status unless waived with a reason.'
  },
  [E.FINAL_SETTLEMENT]: {
    label: 'Final Settlement', owner: 'FINANCE', permission: 'exit.finance', internStatus: I.FINAL_SETTLEMENT,
    action: 'Pro-rated final stipend is settled. The amount is calculated by the server.',
    blockers: 'No unsettled payments (PENDING / ON_HOLD) unless waived with a reason.'
  },
  [E.DOCUMENTATION]: {
    label: 'Certification & Documents', owner: 'HR / DOCUMENT_ADMIN', permission: 'exit.documents', internStatus: I.CERTIFICATION,
    action: 'Certificate, LOR and experience / relieving letter are issued for eligible exits.',
    blockers: 'For completion-type exits the certificate eligibility engine must pass and the certificate and experience letter must be issued.'
  },
  [E.DEACTIVATED]: {
    label: 'Access Deactivated', owner: 'SYSTEM', permission: 'exit.manage', internStatus: I.CERTIFICATION,
    action: 'All sessions are revoked and the login account is deactivated.',
    blockers: 'None.'
  },
  [E.ARCHIVED]: {
    label: 'Record Archived', owner: 'SYSTEM', permission: 'exit.manage', internStatus: I.CERTIFICATION,
    action: 'The operational record is locked against further mutation.',
    blockers: 'None.'
  },
  [E.ALUMNI]: {
    label: 'Alumni', owner: 'SYSTEM', permission: 'exit.manage', internStatus: I.ALUMNI,
    action: 'Permanent alumni archive and public credential verification.',
    blockers: 'Terminal stage.'
  }
};

export const EXIT_TERMINATION_REASONS = ['TERMINATION_PERFORMANCE', 'TERMINATION_MISCONDUCT', 'ABSCONDED'];
// Exit reasons that end in a completion credential (certificate + experience letter).
export const EXIT_COMPLETION_REASONS = ['COMPLETION', 'EARLY_COMPLETION', 'CONTRACT_EXPIRED', 'EMPLOYEE_CONVERSION'];

export function nextExitStage(current) {
  const idx = EXIT_STAGE_ORDER.indexOf(current);
  return idx >= 0 && idx < EXIT_STAGE_ORDER.length - 1 ? EXIT_STAGE_ORDER[idx + 1] : null;
}

// ---------------------------------------------------------------------------
// Convenience: human readable label
// ---------------------------------------------------------------------------
export function humanize(status) {
  return String(status || '').replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
}
