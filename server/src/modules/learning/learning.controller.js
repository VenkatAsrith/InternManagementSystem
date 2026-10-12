import { LearningPath, LearningModule, LearningLesson, LearningProgress } from './learning.model.js';
import { InternshipProgram } from '../recruitment/recruitment.model.js';
import { successResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, unprocessable } from '../../utils/errors.js';
import { Validator, isSafeHttpUrl } from '../../utils/validate.js';

const LESSON_TYPES = ['VIDEO', 'DOCUMENT', 'ARTICLE', 'LINK', 'TEXT', 'QUIZ', 'ASSIGNMENT'];

/** Flattens a path into lesson order (module order, then lesson order) so unlocking is deterministic. */
async function orderedLessons(pathId) {
  const modules = await LearningModule.find({ pathId }).sort({ order: 1, createdAt: 1 });
  const lessons = await LearningLesson.find({ moduleId: { $in: modules.map(m => m._id) } }).sort({ order: 1, createdAt: 1 });
  const byModule = new Map(modules.map(m => [String(m._id), []]));
  lessons.forEach(l => byModule.get(String(l.moduleId))?.push(l));
  return { modules, lessons: modules.flatMap(m => byModule.get(String(m._id))), byModule };
}

const stripAnswers = (lesson) => {
  const obj = lesson.toObject();
  if (obj.quiz?.questions) obj.quiz = { passScore: obj.quiz.passScore, questions: obj.quiz.questions.map(q => ({ prompt: q.prompt, options: q.options })) };
  return obj;
};

export const getLearningPaths = ah(async (req, res) => {
  const paths = await LearningPath.find({ organizationId: req.organizationId, isActive: true }).populate('programId', 'title durationDays').sort({ createdAt: 1 });
  const progress = await LearningProgress.find({ userId: req.userId, isCompleted: true }).select('pathId lessonId');
  const result = await Promise.all(paths.map(async (p) => {
    const { modules, lessons } = await orderedLessons(p._id);
    const done = progress.filter(x => String(x.pathId) === String(p._id)).length;
    return { ...p.toObject(), modulesCount: modules.length, lessonsCount: lessons.length, completedCount: done, progressPercent: lessons.length ? Math.round(done / lessons.length * 100) : 0 };
  }));
  return successResponse(res, result);
});

export const getLearningPathDetails = ah(async (req, res) => {
  const path = await LearningPath.findOne({ _id: req.params.id, organizationId: req.organizationId }).populate('programId');
  if (!path) throw notFound('Learning path not found');
  const { modules, lessons, byModule } = await orderedLessons(path._id);
  const done = new Set((await LearningProgress.find({ userId: req.userId, pathId: path._id, isCompleted: true })).map(p => String(p.lessonId)));

  // A lesson unlocks once EVERY previous lesson in the path is completed.
  const locked = new Map();
  let allPreviousDone = true;
  for (const l of lessons) { locked.set(String(l._id), !allPreviousDone); allPreviousDone = allPreviousDone && done.has(String(l._id)); }

  return successResponse(res, {
    path,
    modules: modules.map(m => ({
      ...m.toObject(),
      lessons: byModule.get(String(m._id)).map(l => ({ ...stripAnswers(l), isCompleted: done.has(String(l._id)), isLocked: locked.get(String(l._id)) }))
    }))
  });
});

async function loadLessonForUser(req, lessonId) {
  const lesson = await LearningLesson.findOne({ _id: lessonId, organizationId: req.organizationId });
  if (!lesson) throw notFound('Lesson not found');
  const module = await LearningModule.findById(lesson.moduleId);
  if (!module) throw notFound('Module not found');
  const { lessons } = await orderedLessons(module.pathId);
  const idx = lessons.findIndex(l => String(l._id) === String(lesson._id));
  const done = new Set((await LearningProgress.find({ userId: req.userId, pathId: module.pathId, isCompleted: true })).map(p => String(p.lessonId)));
  if (lessons.slice(0, idx).some(l => !done.has(String(l._id)))) throw conflict('Complete the previous lessons first.', 'LESSON_LOCKED');
  return { lesson, module };
}

async function markComplete(req, lesson, module, score) {
  return LearningProgress.findOneAndUpdate(
    { userId: req.userId, lessonId: lesson._id },
    { $set: { organizationId: req.organizationId, moduleId: module._id, pathId: module.pathId, isCompleted: true, completedAt: new Date(), ...(score !== undefined ? { score } : {}) } },
    { upsert: true, new: true }
  );
}

export const completeLesson = ah(async (req, res) => {
  const { lesson, module } = await loadLessonForUser(req, req.params.lessonId);
  if (lesson.contentType === 'QUIZ') throw conflict('Quizzes are completed by submitting answers.', 'QUIZ_REQUIRES_ANSWERS');
  const progress = await markComplete(req, lesson, module);
  return successResponse(res, progress, 'Lesson marked as completed');
});

export const submitQuiz = ah(async (req, res) => {
  const { lesson, module } = await loadLessonForUser(req, req.params.lessonId);
  if (lesson.contentType !== 'QUIZ' || !lesson.quiz?.questions?.length) throw conflict('This lesson is not a quiz.', 'NOT_A_QUIZ');
  const answers = req.body?.answers;
  if (!Array.isArray(answers) || answers.length !== lesson.quiz.questions.length || answers.some(a => !Number.isInteger(a))) {
    throw unprocessable('Answer every question.', [{ field: 'answers', message: `Expected ${lesson.quiz.questions.length} answers` }]);
  }
  const correct = lesson.quiz.questions.filter((q, i) => answers[i] === q.correctIndex).length;
  const score = Math.round(correct / lesson.quiz.questions.length * 100);
  const passed = score >= (lesson.quiz.passScore ?? 70);
  const progress = passed ? await markComplete(req, lesson, module, score) : null;
  return successResponse(res, { score, passScore: lesson.quiz.passScore, passed, correct, total: lesson.quiz.questions.length, progress },
    passed ? 'Quiz passed. Lesson completed.' : 'Score below the pass mark. Review the material and try again.');
});

// ---- authoring ---------------------------------------------------------------------------------
export const createLearningPath = ah(async (req, res) => {
  const body = new Validator(req.body).string('title', { required: true, max: 150 }).string('description', { max: 2000 }).objectId('programId').string('targetRole', { max: 100 }).done();
  if (body.programId && !(await InternshipProgram.exists({ _id: body.programId, organizationId: req.organizationId }))) {
    throw unprocessable('Program not found in your organization', [{ field: 'programId', message: 'Unknown program' }]);
  }
  const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : undefined;
  const reminder = req.body?.reminder ? {
    enabled: Boolean(req.body.reminder.enabled),
    daysBefore: Number(req.body.reminder.daysBefore) || 2,
    reminderDate: req.body.reminder.reminderDate ? new Date(req.body.reminder.reminderDate) : (dueDate ? new Date(dueDate.getTime() - (Number(req.body.reminder.daysBefore) || 2) * 86400000) : undefined),
    note: String(req.body.reminder.note || '')
  } : undefined;

  const path = await LearningPath.create({
    organizationId: req.organizationId,
    ...body,
    dueDate,
    reminder,
    targetRole: body.targetRole || 'Intern'
  });
  await recordAuditLog({ action: 'LEARNING_PATH_CREATED', entityType: 'LearningPath', entityId: path._id, after: { title: path.title }, req });
  return successResponse(res, path, 'Learning path created', 201);
});

export const updateLearningPath = ah(async (req, res) => {
  const path = await LearningPath.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!path) throw notFound('Learning path not found');

  if (req.body.title) path.title = String(req.body.title).trim();
  if (req.body.description !== undefined) path.description = String(req.body.description).trim();
  if (req.body.targetRole !== undefined) path.targetRole = String(req.body.targetRole).trim();
  if (req.body.programId !== undefined) path.programId = req.body.programId || undefined;
  if (req.body.dueDate !== undefined) path.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : undefined;
  if (req.body.reminder !== undefined) {
    path.reminder = {
      enabled: Boolean(req.body.reminder.enabled),
      daysBefore: Number(req.body.reminder.daysBefore) || 2,
      reminderDate: req.body.reminder.reminderDate ? new Date(req.body.reminder.reminderDate) : (path.dueDate ? new Date(path.dueDate.getTime() - (Number(req.body.reminder.daysBefore) || 2) * 86400000) : undefined),
      note: String(req.body.reminder.note || '')
    };
  }

  await path.save();
  return successResponse(res, path, 'Learning path updated');
});

export const addPathDocument = ah(async (req, res) => {
  const path = await LearningPath.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!path) throw notFound('Learning path not found');

  const { title, description, url, fileType } = req.body;
  if (!title) throw badRequest('Document title is required');

  const doc = {
    title: String(title).trim(),
    description: String(description || '').trim(),
    url: String(url || '').trim(),
    fileType: fileType || 'DOCUMENT',
    addedAt: new Date()
  };

  path.documents.push(doc);
  await path.save();
  return successResponse(res, path, 'Document added to learning path', 201);
});

export const createModule = ah(async (req, res) => {
  const path = await LearningPath.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!path) throw notFound('Learning path not found');
  const body = new Validator(req.body).string('title', { required: true, max: 150 }).string('description', { max: 1000 }).done();
  const order = (await LearningModule.countDocuments({ pathId: path._id })) + 1;

  const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : undefined;
  const reminder = req.body?.reminder ? {
    enabled: Boolean(req.body.reminder.enabled),
    daysBefore: Number(req.body.reminder.daysBefore) || 2,
    reminderDate: req.body.reminder.reminderDate ? new Date(req.body.reminder.reminderDate) : (dueDate ? new Date(dueDate.getTime() - (Number(req.body.reminder.daysBefore) || 2) * 86400000) : undefined),
    note: String(req.body.reminder.note || '')
  } : undefined;

  const module = await LearningModule.create({
    pathId: path._id,
    organizationId: req.organizationId,
    ...body,
    dueDate,
    reminder,
    order
  });
  return successResponse(res, module, 'Module created', 201);
});

export const updateModule = ah(async (req, res) => {
  const module = await LearningModule.findOne({ _id: req.params.moduleId, organizationId: req.organizationId });
  if (!module) throw notFound('Module not found');

  if (req.body.title) module.title = String(req.body.title).trim();
  if (req.body.description !== undefined) module.description = String(req.body.description).trim();
  if (req.body.dueDate !== undefined) module.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : undefined;
  if (req.body.reminder !== undefined) {
    module.reminder = {
      enabled: Boolean(req.body.reminder.enabled),
      daysBefore: Number(req.body.reminder.daysBefore) || 2,
      reminderDate: req.body.reminder.reminderDate ? new Date(req.body.reminder.reminderDate) : (module.dueDate ? new Date(module.dueDate.getTime() - (Number(req.body.reminder.daysBefore) || 2) * 86400000) : undefined),
      note: String(req.body.reminder.note || '')
    };
  }

  await module.save();
  return successResponse(res, module, 'Module updated');
});

export const addModuleDocument = ah(async (req, res) => {
  const module = await LearningModule.findOne({ _id: req.params.moduleId, organizationId: req.organizationId });
  if (!module) throw notFound('Module not found');

  const { title, description, url, fileType } = req.body;
  if (!title) throw badRequest('Document title is required');

  const doc = {
    title: String(title).trim(),
    description: String(description || '').trim(),
    url: String(url || '').trim(),
    fileType: fileType || 'DOCUMENT',
    addedAt: new Date()
  };

  module.documents.push(doc);
  await module.save();
  return successResponse(res, module, 'Document added to module', 201);
});

export const createLesson = ah(async (req, res) => {
  const module = await LearningModule.findOne({ _id: req.params.moduleId, organizationId: req.organizationId });
  if (!module) throw notFound('Module not found');
  const v = new Validator(req.body).string('title', { required: true, max: 150 }).oneOf('contentType', LESSON_TYPES, { defaultValue: 'ARTICLE' })
    .string('content', { max: 20000 }).url('externalUrl').number('durationMinutes', { min: 0, max: 600 });
  const body = v.done();
  const lesson = { moduleId: module._id, organizationId: req.organizationId, ...body, order: (await LearningLesson.countDocuments({ moduleId: module._id })) + 1 };
  if (req.body?.dueDate) lesson.dueDate = new Date(req.body.dueDate);
  if (req.body?.reminder) lesson.reminder = req.body.reminder;
  if (body.contentType === 'QUIZ') {
    const qs = req.body?.quiz?.questions;
    if (!Array.isArray(qs) || !qs.length || qs.some(q => !q?.prompt || !Array.isArray(q.options) || q.options.length < 2 || !Number.isInteger(q.correctIndex) || q.correctIndex >= q.options.length)) {
      throw unprocessable('A quiz needs questions with at least two options and a valid correct answer.', [{ field: 'quiz', message: 'Invalid quiz' }]);
    }
    lesson.quiz = { passScore: Number(req.body.quiz.passScore) || 70, questions: qs.map(q => ({ prompt: String(q.prompt), options: q.options.map(String), correctIndex: q.correctIndex })) };
  }
  if (lesson.externalUrl && !isSafeHttpUrl(lesson.externalUrl)) throw unprocessable('Invalid URL', [{ field: 'externalUrl', message: 'Enter a valid http(s) URL' }]);
  const created = await LearningLesson.create(lesson);
  return successResponse(res, stripAnswers(created), 'Lesson created', 201);
});
