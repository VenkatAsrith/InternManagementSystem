import React from 'react';
import { humanize } from '../../lib/format';

// One colour vocabulary for every entity. The label text is ALWAYS shown, colour is only reinforcement.
const TONE = {
  neutral: 'bg-slate-100 text-slate-800 border-slate-300',
  info: 'bg-sky-50 text-sky-800 border-sky-300',
  progress: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  warning: 'bg-amber-50 text-amber-900 border-amber-300',
  danger: 'bg-rose-50 text-rose-800 border-rose-300',
  purple: 'bg-purple-50 text-purple-800 border-purple-300'
};

const MAP = {
  // application
  APPLIED: 'info', UNDER_REVIEW: 'warning', SHORTLISTED: 'purple', INTERVIEW_SCHEDULED: 'progress', INTERVIEWED: 'progress',
  SELECTED: 'success', OFFER_DRAFT: 'neutral', OFFER_SENT: 'info', OFFER_ACCEPTED: 'success', OFFER_DECLINED: 'danger',
  OFFER_EXPIRED: 'warning', REJECTED: 'danger', WITHDRAWN: 'neutral', ON_HOLD: 'warning',
  // offer / interview / generic
  DRAFT: 'neutral', SENT: 'info', VIEWED: 'info', ACCEPTED: 'success', DECLINED: 'danger', EXPIRED: 'warning', REVOKED: 'danger',
  SCHEDULED: 'info', COMPLETED: 'success', CANCELLED: 'neutral', NO_SHOW: 'danger', RESCHEDULED: 'warning',
  // intern
  PRE_ONBOARDING: 'warning', ONBOARDING: 'info', ACTIVE: 'success', PERFORMANCE_REVIEW: 'purple', EXIT_INITIATED: 'warning',
  ASSET_CLEARANCE: 'warning', FINAL_SETTLEMENT: 'warning', CERTIFICATION: 'progress', ALUMNI: 'neutral', TERMINATED: 'danger',
  // exit stages
  NOTICE_PERIOD: 'warning', HANDOVER: 'warning', DOCUMENTATION: 'progress', DEACTIVATED: 'neutral', ARCHIVED: 'neutral',
  // tasks
  BACKLOG: 'neutral', TODO: 'neutral', IN_PROGRESS: 'info', BLOCKED: 'danger', SUBMITTED: 'progress', IN_REVIEW: 'progress',
  REVISION_REQUIRED: 'warning', APPROVED: 'success',
  // priority
  LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', URGENT: 'danger',
  // attendance / leave
  PRESENT: 'success', ABSENT: 'danger', LATE: 'warning', HALF_DAY: 'purple', LEAVE: 'info', HOLIDAY: 'neutral', WEEKEND: 'neutral',
  REQUESTED: 'warning', CANCELLED_WORKED: 'neutral',
  // finance
  PAID: 'success', PENDING: 'warning', PROCESSING: 'info', FAILED: 'danger', PARTIALLY_PAID: 'warning', WAIVED: 'neutral', NOT_APPLICABLE: 'neutral',
  // documents / journals / reviews / assets / projects
  UPLOADED: 'info', GENERATED: 'info', ARCHIVED_DOC: 'neutral', REVIEWED: 'success', FINALIZED: 'success',
  SELF_ASSESSMENT_PENDING: 'warning', MENTOR_ASSESSMENT_PENDING: 'warning', MANAGER_REVIEW_PENDING: 'warning',
  AVAILABLE: 'success', ASSIGNED: 'info', ACKNOWLEDGED: 'info', RETURN_PENDING: 'warning', RETURNED: 'success', LOST: 'danger', DAMAGED: 'danger',
  PLANNED: 'neutral', OPEN: 'success', CLOSED: 'neutral', DISABLED: 'neutral', SUSPENDED: 'danger',
  // eligibility
  PASS: 'success', FAIL: 'danger'
};

export function StatusBadge({ status, label, tone, className = '', testId }) {
  if (!status && !label) return <span className="text-slate-500">-</span>;
  const t = TONE[tone || MAP[status] || 'neutral'];
  return (
    <span
      data-testid={testId || `status-${String(status).toLowerCase()}`}
      data-status={status}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${t} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label || humanize(status)}
    </span>
  );
}
