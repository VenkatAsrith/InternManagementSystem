import mongoose from 'mongoose';
import { Application } from '../recruitment/recruitment.model.js';
import { Intern } from '../interns/intern.model.js';
import { Task } from '../tasks/task.model.js';
import { AttendanceRecord } from '../attendance/attendance.model.js';
import { PerformanceReview } from '../performance/performance.model.js';
import { attendanceSummary } from '../attendance/attendance.service.js';
import { successResponse } from '../../utils/response.js';
import { APPLICATION_STATUS as A, INTERN_STATUS as I, TASK_STATUS as T, ATTENDANCE_STATUS, PERFORMANCE_REVIEW_STATUS } from '../../../../shared/constants.js';
import { INTERN_WORKING_STATUSES } from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { round2, startOfDay, addDays } from '../../utils/time.js';

const FUNNEL = [
  [A.APPLIED, 'Applied'], [A.UNDER_REVIEW, 'Under Review'], [A.SHORTLISTED, 'Shortlisted'], [A.INTERVIEW_SCHEDULED, 'Interview Scheduled'],
  [A.INTERVIEWED, 'Interviewed'], [A.SELECTED, 'Selected'], [A.OFFER_DRAFT, 'Offer Draft'], [A.OFFER_SENT, 'Offer Sent'], [A.OFFER_ACCEPTED, 'Offer Accepted']
];
const BRANCHES = [[A.REJECTED, 'Rejected'], [A.WITHDRAWN, 'Withdrawn'], [A.ON_HOLD, 'On Hold'], [A.OFFER_DECLINED, 'Offer Declined'], [A.OFFER_EXPIRED, 'Offer Expired']];

const counts = (rows) => Object.fromEntries(rows.map(r => [r._id, r.count]));
const group = (Model, orgId, extra = {}) => Model.aggregate([{ $match: { organizationId: orgId, ...extra } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);

/**
 * Every figure below is aggregated from the database. When there is no data the value is 0 or null
 * (the UI shows a dash); nothing is ever replaced by a made-up default.
 */
export const getDashboardAnalytics = ah(async (req, res) => {
  const orgId = new mongoose.Types.ObjectId(String(req.organizationId));

  const [appRows, internRows, taskRows, reviewAgg] = await Promise.all([
    group(Application, orgId), group(Intern, orgId), group(Task, orgId),
    PerformanceReview.aggregate([{ $match: { organizationId: orgId, status: PERFORMANCE_REVIEW_STATUS.FINALIZED } }, { $group: { _id: null, avg: { $avg: '$finalScore' }, n: { $sum: 1 } } }])
  ]);

  const a = counts(appRows);
  const totalApplications = appRows.reduce((s, r) => s + r.count, 0);
  const i = counts(internRows);
  const totalInterns = internRows.reduce((s, r) => s + r.count, 0);
  const t = counts(taskRows);
  const totalTasks = taskRows.filter(r => r._id !== T.CANCELLED).reduce((s, r) => s + r.count, 0);
  const completedTasks = t[T.APPROVED] || 0;

  // Attendance over the last 30 days for interns who are currently working (same engine as certificates).
  const tz = req.timezone;
  const windowStart = addDays(startOfDay(new Date(), tz), -30, tz);
  const working = await Intern.find({ organizationId: orgId, status: { $in: INTERN_WORKING_STATUSES } }).select('startDate expectedEndDate actualEndDate').lean();
  let expected = 0, attended = 0;
  for (const intern of working) {
    const s = await attendanceSummary({ ...intern, startDate: intern.startDate > windowStart ? intern.startDate : windowStart }, { tz });
    expected += s.expectedDays; attended += s.attendedDays;
  }
  const hours = await AttendanceRecord.aggregate([
    { $match: { organizationId: orgId, date: { $gte: windowStart }, status: { $in: [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.HALF_DAY] }, totalHours: { $gt: 0 } } },
    { $group: { _id: null, avg: { $avg: '$totalHours' } } }
  ]);

  return successResponse(res, {
    recruitment: {
      totalApplications,
      // Current distribution: how many applications sit in each stage right now (every stage, no gaps).
      funnel: FUNNEL.map(([key, stage]) => ({ key, stage, count: a[key] || 0 })),
      branches: BRANCHES.map(([key, stage]) => ({ key, stage, count: a[key] || 0 })),
      offerAcceptanceRate: (a[A.OFFER_ACCEPTED] || 0) + (a[A.OFFER_DECLINED] || 0) > 0 ? round2((a[A.OFFER_ACCEPTED] || 0) / ((a[A.OFFER_ACCEPTED] || 0) + (a[A.OFFER_DECLINED] || 0)) * 100) : null
    },
    interns: {
      total: totalInterns,
      active: (i[I.ACTIVE] || 0) + (i[I.PERFORMANCE_REVIEW] || 0),
      onboarding: (i[I.PRE_ONBOARDING] || 0) + (i[I.ONBOARDING] || 0),
      exiting: (i[I.EXIT_INITIATED] || 0) + (i[I.ASSET_CLEARANCE] || 0) + (i[I.FINAL_SETTLEMENT] || 0) + (i[I.CERTIFICATION] || 0),
      completed: i[I.ALUMNI] || 0,
      terminated: i[I.TERMINATED] || 0,
      byStatus: internRows.map(r => ({ status: r._id, count: r.count })),
      completionRate: totalInterns > 0 ? Math.round((i[I.ALUMNI] || 0) / totalInterns * 100) : null
    },
    tasks: {
      total: totalTasks,
      completed: completedTasks,
      completionRate: totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : null,
      breakdown: [
        { name: 'To Do', value: (t[T.BACKLOG] || 0) + (t[T.TODO] || 0) },
        { name: 'In Progress', value: (t[T.IN_PROGRESS] || 0) + (t[T.BLOCKED] || 0) + (t[T.REVISION_REQUIRED] || 0) },
        { name: 'In Review', value: (t[T.SUBMITTED] || 0) + (t[T.IN_REVIEW] || 0) },
        { name: 'Approved', value: completedTasks }
      ]
    },
    attendance: {
      windowDays: 30,
      attendanceRate: expected > 0 ? round2(attended / expected * 100) : null,
      avgHours: hours[0]?.avg ? round2(hours[0].avg) : null,
      internsCounted: working.length
    },
    performance: { avgScore: reviewAgg[0]?.avg ? round2(reviewAgg[0].avg) : null, reviewsFinalized: reviewAgg[0]?.n || 0 }
  });
});
