import { PerformanceReview } from './performance.model.js';
import { Intern } from '../interns/intern.model.js';
import { internScope, loadScopedIntern, getOwnIntern } from '../interns/intern.access.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { PERFORMANCE_REVIEW_STATUS as S, PERFORMANCE_REVIEW_TYPE, INTERN_STATUS, ROLES } from '../../../../shared/constants.js';
import { INTERN_WORKING_STATUSES } from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, forbidden, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId } from '../../utils/validate.js';
import { round2 } from '../../utils/time.js';

export const DEFAULT_PERFORMANCE_METRICS = [
  { metricName: 'Technical Skills & Code Quality', weightPercent: 20, score: 0, comments: '' },
  { metricName: 'Task Completion & Velocity', weightPercent: 15, score: 0, comments: '' },
  { metricName: 'Quality & Attention to Detail', weightPercent: 15, score: 0, comments: '' },
  { metricName: 'Communication & Collaboration', weightPercent: 10, score: 0, comments: '' },
  { metricName: 'Problem Solving & Critical Thinking', weightPercent: 10, score: 0, comments: '' },
  { metricName: 'Learning Agility & Curiosity', weightPercent: 10, score: 0, comments: '' },
  { metricName: 'Initiative & Proactivity', weightPercent: 10, score: 0, comments: '' },
  { metricName: 'Professionalism & Attendance', weightPercent: 10, score: 0, comments: '' }
];

const OPEN_STATUSES = [S.SELF_ASSESSMENT_PENDING, S.MENTOR_ASSESSMENT_PENDING, S.MANAGER_REVIEW_PENDING];

function weighted(metrics) {
  return round2(metrics.reduce((sum, m) => sum + (Number(m.score) || 0) * (Number(m.weightPercent) || 0) / 100, 0));
}

function parseScores(input, metrics, { requireAll }) {
  if (!Array.isArray(input) || (requireAll && input.length !== metrics.length)) {
    throw unprocessable(requireAll ? `Score all ${metrics.length} competencies.` : 'Scores must be a list.', [{ field: 'scores', message: 'Invalid scores' }]);
  }
  const errors = [];
  const byName = new Map();
  input.forEach((s, i) => {
    const name = String(s?.metricName || '');
    const score = Number(s?.score);
    if (!metrics.some(m => m.metricName === name)) errors.push({ field: `scores[${i}].metricName`, message: 'Unknown competency' });
    else if (!Number.isFinite(score) || score < 0 || score > 10) errors.push({ field: `scores[${i}].score`, message: 'Score must be between 0 and 10' });
    else if (byName.has(name)) errors.push({ field: `scores[${i}].metricName`, message: 'Duplicate competency' });
    else byName.set(name, { score, comments: String(s?.comments || '').slice(0, 500) });
  });
  if (requireAll && byName.size !== metrics.length) errors.push({ field: 'scores', message: 'Every competency must be scored exactly once' });
  if (errors.length) throw unprocessable('Invalid scores', errors);
  return metrics.map(m => ({ metricName: m.metricName, weightPercent: m.weightPercent, score: byName.get(m.metricName)?.score ?? m.score ?? 0, comments: byName.get(m.metricName)?.comments ?? '' }));
}

/** Interns only see what is theirs to see: in-progress reviews show no mentor/manager content until FINALIZED. */
function shape(review, req) {
  const obj = review.toObject ? review.toObject() : review;
  if (req.userRole === ROLES.INTERN && obj.status !== S.FINALIZED) {
    delete obj.mentorAssessment; delete obj.managerReview;
    obj.metrics = (obj.metrics || []).map(m => ({ metricName: m.metricName, weightPercent: m.weightPercent }));
    obj.finalScore = null;
  }
  return obj;
}

async function reviewScope(req) {
  const internIds = await Intern.find(internScope(req)).distinct('_id');
  return { organizationId: req.organizationId, internId: { $in: internIds } };
}

export const createPerformanceReview = ah(async (req, res) => {
  const v = new Validator(req.body).objectId('internId', { required: true }).oneOf('type', PERFORMANCE_REVIEW_TYPE, { defaultValue: PERFORMANCE_REVIEW_TYPE.MID_TERM }).string('cycleTitle', { max: 150 });
  const body = v.done();
  const intern = await loadScopedIntern(req, body.internId);
  if (!INTERN_WORKING_STATUSES.includes(intern.status)) throw conflict(`Reviews can only be opened for working interns (status: ${intern.status}).`, 'INTERN_NOT_ACTIVE');

  const metrics = req.body?.metrics ? req.body.metrics : DEFAULT_PERFORMANCE_METRICS;
  if (!Array.isArray(metrics) || !metrics.length) throw unprocessable('Provide at least one competency.', [{ field: 'metrics', message: 'Required' }]);
  const names = metrics.map(m => String(m.metricName || '').trim());
  if (names.some(n => !n) || new Set(names).size !== names.length) throw unprocessable('Competency names must be unique and non-empty.', [{ field: 'metrics', message: 'Invalid names' }]);
  const total = metrics.reduce((s, m) => s + Number(m.weightPercent), 0);
  if (!metrics.every(m => Number.isFinite(Number(m.weightPercent)) && Number(m.weightPercent) > 0) || Math.abs(total - 100) > 0.001) {
    throw unprocessable(`Sum of metric weights must equal 100%. Current sum: ${total}%`, [{ field: 'metrics', message: 'Weights must total 100' }]);
  }

  if (await PerformanceReview.exists({ internId: intern._id, type: body.type, status: { $in: OPEN_STATUSES } })) {
    throw conflict(`An open ${body.type} review already exists for this intern.`, 'REVIEW_ALREADY_OPEN');
  }
  const review = await PerformanceReview.create({
    organizationId: req.organizationId, internId: intern._id, userId: intern.userId,
    cycleTitle: body.cycleTitle || 'Standard Internship Evaluation Cycle', type: body.type,
    metrics: metrics.map((m, i) => ({ metricName: names[i], weightPercent: Number(m.weightPercent), score: 0, comments: '' })),
    status: S.SELF_ASSESSMENT_PENDING
  });

  // Opening a mid-term / final review moves the intern ACTIVE -> PERFORMANCE_REVIEW (system transition).
  if ([PERFORMANCE_REVIEW_TYPE.MID_TERM, PERFORMANCE_REVIEW_TYPE.FINAL].includes(body.type)) {
    await Intern.updateOne({ _id: intern._id, status: INTERN_STATUS.ACTIVE }, { $set: { status: INTERN_STATUS.PERFORMANCE_REVIEW } });
  }
  await createNotification({
    organizationId: req.organizationId, recipientId: intern.userId, type: 'PERFORMANCE_REVIEW_OPEN', title: 'Performance Review Open',
    message: `Your ${review.type} performance review is open. Please complete your self-assessment.`, entityType: 'PerformanceReview', entityId: review._id
  });
  await recordAuditLog({ action: 'PERFORMANCE_REVIEW_CREATED', entityType: 'PerformanceReview', entityId: review._id, after: { type: review.type, internId: intern.internId }, req });
  return successResponse(res, review, 'Performance review created successfully', 201);
});

export const getPerformanceReviews = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = await reviewScope(req);
  if (isObjectId(req.query.internId) && req.userRole !== ROLES.INTERN) query.internId = { $in: query.internId.$in.filter(id => String(id) === req.query.internId) };
  if (Object.values(S).includes(req.query.status)) query.status = req.query.status;
  const [reviews, total] = await Promise.all([
    PerformanceReview.find(query)
      .populate('userId', 'firstName lastName email avatarUrl').populate('internId', 'internId programId')
      .populate('mentorAssessment.evaluatorId', 'firstName lastName').populate('managerReview.reviewerId', 'firstName lastName')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    PerformanceReview.countDocuments(query)
  ]);
  return paginatedResponse(res, reviews.map(r => shape(r, req)), { page, limit, total });
});

export const getPerformanceReviewById = ah(async (req, res) => {
  const review = await PerformanceReview.findOne({ ...(await reviewScope(req)), _id: req.params.id })
    .populate('userId', 'firstName lastName email avatarUrl').populate('internId', 'internId programId status')
    .populate('mentorAssessment.evaluatorId', 'firstName lastName').populate('managerReview.reviewerId', 'firstName lastName');
  if (!review) throw notFound('Performance review not found');
  return successResponse(res, shape(review, req));
});

export const submitSelfAssessment = ah(async (req, res) => {
  const v = new Validator(req.body).string('strengths', { required: true, min: 5, max: 3000 }).string('growthAreas', { required: true, min: 5, max: 3000 }).string('generalComments', { max: 2000 });
  const body = v.done();
  const intern = await getOwnIntern(req);
  const review = await PerformanceReview.findOne({ _id: req.params.id, organizationId: req.organizationId, internId: intern._id });
  if (!review) throw notFound('Performance review not found');
  const scores = req.body?.scores === undefined ? review.metrics.map(m => ({ metricName: m.metricName, weightPercent: m.weightPercent, score: 0, comments: '' })) : parseScores(req.body.scores, review.metrics, { requireAll: false });

  // Atomic and status-gated: cannot be re-submitted, and can never pull a later stage backwards.
  const updated = await PerformanceReview.findOneAndUpdate(
    { _id: review._id, status: S.SELF_ASSESSMENT_PENDING },
    { $set: { selfAssessment: { scores, strengths: body.strengths, growthAreas: body.growthAreas, generalComments: body.generalComments || '', submittedAt: new Date() }, status: S.MENTOR_ASSESSMENT_PENDING } },
    { new: true }
  );
  if (!updated) throw conflict(`Self-assessment is closed (review status: ${review.status}).`, 'INVALID_TRANSITION');
  if (intern.mentorId) {
    await createNotification({
      organizationId: req.organizationId, recipientId: intern.mentorId, type: 'PERFORMANCE_REVIEW_DUE', title: 'Self-assessment submitted',
      message: `${req.user.firstName} completed a self-assessment. Please submit your mentor evaluation.`, entityType: 'PerformanceReview', entityId: review._id
    });
  }
  await recordAuditLog({ action: 'PERFORMANCE_SELF_ASSESSMENT_SUBMITTED', entityType: 'PerformanceReview', entityId: review._id, req });
  return successResponse(res, shape(updated, req), 'Self-assessment submitted successfully');
});

export const submitMentorAssessment = ah(async (req, res) => {
  const { feedback } = new Validator(req.body).string('feedback', { required: true, min: 10, max: 3000 }).done();
  const review = await PerformanceReview.findOne({ ...(await reviewScope(req)), _id: req.params.id });
  if (!review) throw notFound('Performance review not found');
  if (String(review.userId) === String(req.userId)) throw forbidden('You cannot evaluate yourself.', 'SELF_REVIEW');
  const scores = parseScores(req.body?.scores, review.metrics, { requireAll: true });

  const updated = await PerformanceReview.findOneAndUpdate(
    { _id: review._id, status: S.MENTOR_ASSESSMENT_PENDING },
    { $set: { metrics: scores, mentorAssessment: { scores, feedback, evaluatorId: req.userId, submittedAt: new Date() }, finalScore: weighted(scores), status: S.MANAGER_REVIEW_PENDING } },
    { new: true }
  );
  if (!updated) throw conflict(review.status === S.SELF_ASSESSMENT_PENDING ? 'The intern must complete the self-assessment first.' : `Mentor assessment is closed (review status: ${review.status}).`, 'INVALID_TRANSITION');
  await recordAuditLog({ action: 'PERFORMANCE_MENTOR_ASSESSMENT_SUBMITTED', entityType: 'PerformanceReview', entityId: review._id, after: { preliminaryScore: updated.finalScore }, req });
  return successResponse(res, updated, 'Mentor assessment recorded successfully');
});

export const finalizePerformanceReview = ah(async (req, res) => {
  const { comments } = new Validator(req.body).string('comments', { required: true, min: 5, max: 3000 }).done();
  const review = await PerformanceReview.findOne({ organizationId: req.organizationId, _id: req.params.id });
  if (!review) throw notFound('Performance review not found');
  if (String(review.userId) === String(req.userId)) throw forbidden('You cannot finalize your own review.', 'SELF_REVIEW');

  // Managers may only adjust SCORES. Competencies and weights are fixed when the cycle is opened.
  let metrics = review.metrics;
  if (req.body?.adjustedScores !== undefined) metrics = parseScores(req.body.adjustedScores, review.metrics, { requireAll: true });
  const finalScore = weighted(metrics);

  const updated = await PerformanceReview.findOneAndUpdate(
    { _id: review._id, status: S.MANAGER_REVIEW_PENDING },
    { $set: { metrics, finalScore, managerReview: { comments, reviewerId: req.userId, reviewedAt: new Date() }, status: S.FINALIZED, finalizedAt: new Date() } },
    { new: true }
  );
  if (!updated) throw conflict(review.status === S.FINALIZED ? 'This review is already finalized and locked.' : 'The mentor assessment must be completed before finalizing.', 'INVALID_TRANSITION');

  const intern = await Intern.findById(review.internId);
  if (intern) {
    intern.completionDetails.finalPerformanceScore = finalScore;
    // Back to ACTIVE once no review is still open (unless the exit has already started).
    if (intern.status === INTERN_STATUS.PERFORMANCE_REVIEW && !(await PerformanceReview.exists({ internId: intern._id, status: { $in: OPEN_STATUSES } }))) intern.status = INTERN_STATUS.ACTIVE;
    await intern.save();
  }
  await createNotification({
    organizationId: req.organizationId, recipientId: review.userId, type: 'PERFORMANCE_FINALIZED', title: 'Performance Evaluation Finalized',
    message: `Your ${review.type} review is finalized with an overall score of ${finalScore} / 10.`, entityType: 'PerformanceReview', entityId: review._id
  });
  await recordAuditLog({ action: 'PERFORMANCE_REVIEW_FINALIZED', entityType: 'PerformanceReview', entityId: review._id, after: { finalScore }, req });
  return successResponse(res, updated, `Performance review finalized with score ${finalScore} / 10`);
});
