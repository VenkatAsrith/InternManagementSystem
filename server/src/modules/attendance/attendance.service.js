import { AttendanceRecord } from './attendance.model.js';
import { Leave } from '../leaves/leave.model.js';
import { ATTENDANCE_STATUS, LEAVE_STATUS, LEAVE_TYPE } from '../../../../shared/constants.js';
import { weekdaysBetween, startOfDay, round2 } from '../../utils/time.js';
import { env } from '../../config/env.js';

/**
 * The ONE attendance calculation used by the dashboards, certificate eligibility and analytics.
 *
 *   expectedDays = Mon-Fri days from the intern's start to min(today, end of engagement)
 *                  minus days covered by APPROVED leave (excused)
 *   attended     = PRESENT + LATE count 1, HALF_DAY counts 0.5
 *   percent      = attended / expectedDays x 100   (null when nothing is expected yet)
 */
export async function attendanceSummary(intern, { asOf = new Date(), tz = env.ORG_TIMEZONE, endDate } = {}) {
  const from = startOfDay(intern.startDate, tz);
  const limit = endDate || intern.actualEndDate || intern.expectedEndDate;
  const to = startOfDay(limit && limit < asOf ? limit : asOf, tz);

  const [records, leaves] = await Promise.all([
    AttendanceRecord.find({ internId: intern._id, date: { $gte: from, $lte: to } }).lean(),
    Leave.find({ internId: intern._id, status: LEAVE_STATUS.APPROVED, startDate: { $lte: to }, endDate: { $gte: from } }).lean()
  ]);

  const days = from <= to ? weekdaysBetween(from, to, tz) : [];
  const key = (d) => startOfDay(d, tz).getTime();
  const worked = new Map(records.filter(r => [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.HALF_DAY].includes(r.status)).map(r => [key(r.date), r]));

  const excused = new Set();
  const lop = new Set();
  for (const l of leaves) {
    for (const d of weekdaysBetween(l.startDate < from ? from : l.startDate, l.endDate > to ? to : l.endDate, tz)) {
      (l.leaveType === LEAVE_TYPE.UNPAID ? lop : excused).add(key(d));
    }
  }

  let expectedDays = 0, attended = 0, lateDays = 0, halfDays = 0, absentDays = 0, leaveDays = 0;
  for (const d of days) {
    const k = key(d);
    const rec = worked.get(k);
    if (excused.has(k) && !rec) { leaveDays += 1; continue; }   // excused: not expected
    expectedDays += 1;
    if (lop.has(k) && !rec) { absentDays += 1; continue; }        // unpaid leave still counts against attendance
    if (!rec) { absentDays += 1; continue; }
    if (rec.status === ATTENDANCE_STATUS.HALF_DAY) { attended += 0.5; halfDays += 1; }
    else { attended += 1; if (rec.status === ATTENDANCE_STATUS.LATE) lateDays += 1; }
  }
  const daySet = new Set(days.map(key));
  const workedOutsideExpected = [...worked.keys()].filter(k => !daySet.has(k)).length; // e.g. weekend shifts
  const totalHours = round2(records.reduce((s, r) => s + (r.totalHours || 0), 0));
  return {
    expectedDays, attendedDays: attended, lateDays, halfDays, absentDays, leaveDays, totalHours,
    // Nothing expected yet: 100% if they worked anyway (e.g. a weekend shift), otherwise unknown (null).
    percent: expectedDays > 0 ? round2(Math.min(100, attended / expectedDays * 100)) : (attended > 0 || workedOutsideExpected > 0 ? 100 : null),
    avgHoursPerWorkedDay: worked.size ? round2(totalHours / worked.size) : null
  };
}
