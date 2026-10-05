import { COMPENSATION_TYPE, LEAVE_TYPE, LEAVE_STATUS, ATTENDANCE_STATUS } from '../../../../shared/constants.js';
import { weekdaysBetween, startOfDay, round2 } from '../../utils/time.js';

/**
 * PURE payroll calculation (no database access) so it can be unit tested exhaustively.
 *
 *   workingDays  = Mon-Fri days in the cycle
 *   activeDays   = Mon-Fri days in the cycle that fall inside the intern's engagement window
 *   lopDays      = active weekdays covered by an APPROVED UNPAID leave (loss of pay)
 *   absentDays   = active weekdays up to `asOf` with no attendance record and no approved leave (unexcused absence)
 *   payableDays  = activeDays - lopDays - absentDays
 *
 * MONTHLY_STIPEND : gross = base x activeDays / workingDays ; deductions = base / workingDays x (lopDays + absentDays)
 * DAILY_RATE      : gross = rate x payableDays
 * HOURLY_RATE     : gross = rate x hours worked in the cycle
 * UNPAID          : nothing to pay (caller skips)
 *
 * netPayable is NEVER negative: deductions can never exceed the gross they are taken from.
 */
export function calculatePayroll({
  compensationType = COMPENSATION_TYPE.MONTHLY_STIPEND,
  baseAmount = 0,
  cycleStart,
  cycleEnd,
  windowStart,
  windowEnd,
  leaves = [],
  attendance = [],
  asOf = new Date(),
  tz
}) {
  const cycleDays = weekdaysBetween(cycleStart, cycleEnd, tz);
  const workingDays = cycleDays.length;

  const from = windowStart && windowStart > cycleStart ? windowStart : cycleStart;
  const to = windowEnd && windowEnd < cycleEnd ? windowEnd : cycleEnd;
  const activeList = from <= to ? weekdaysBetween(from, to, tz) : [];
  const activeDays = activeList.length;

  const key = (d) => startOfDay(d, tz).getTime();
  const lopSet = new Set();
  const paidLeaveSet = new Set();
  for (const leave of leaves) {
    if (leave.status !== LEAVE_STATUS.APPROVED) continue;
    for (const d of weekdaysBetween(leave.startDate, leave.endDate, tz)) {
      (leave.leaveType === LEAVE_TYPE.UNPAID ? lopSet : paidLeaveSet).add(key(d));
    }
  }
  const attendedSet = new Set(
    attendance
      .filter(a => [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.HALF_DAY].includes(a.status))
      .map(a => key(a.date))
  );
  const todayKey = key(asOf);

  let lopDays = 0;
  let absentDays = 0;
  for (const d of activeList) {
    const k = key(d);
    if (lopSet.has(k)) { lopDays += 1; continue; }
    if (paidLeaveSet.has(k) || attendedSet.has(k)) continue;
    if (k < todayKey) absentDays += 1; // only past days can be an absence
  }
  const payableDays = Math.max(0, activeDays - lopDays - absentDays);
  const hoursWorked = round2(attendance.reduce((sum, a) => sum + (Number(a.totalHours) || 0), 0));

  let gross = 0;
  let deductions = 0;
  const base = Number(baseAmount) || 0;
  switch (compensationType) {
    case COMPENSATION_TYPE.MONTHLY_STIPEND:
      gross = workingDays > 0 ? round2(base * activeDays / workingDays) : 0;
      deductions = workingDays > 0 ? round2(base / workingDays * (lopDays + absentDays)) : 0;
      break;
    case COMPENSATION_TYPE.DAILY_RATE:
      gross = round2(base * payableDays);
      break;
    case COMPENSATION_TYPE.HOURLY_RATE:
      gross = round2(base * hoursWorked);
      break;
    default:
      gross = 0;
  }
  deductions = Math.min(deductions, gross);
  const netPayable = round2(Math.max(0, gross - deductions));

  return {
    workingDays, activeDays, lopDays, absentDays, payableDays, hoursWorked,
    grossAmount: gross, totalDeductions: round2(deductions), netPayable,
    perDayRate: workingDays > 0 ? round2(base / workingDays) : 0
  };
}
