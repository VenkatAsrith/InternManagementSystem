import mongoose from 'mongoose';

const learningLessonSchema = new mongoose.Schema({
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningModule', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  title: { type: String, required: true },
  contentType: {
    type: String,
    enum: ['VIDEO', 'DOCUMENT', 'ARTICLE', 'LINK', 'TEXT', 'QUIZ', 'ASSIGNMENT'],
    default: 'ARTICLE'
  },
  content: { type: String, default: '' },
  externalUrl: { type: String, default: '' },
  durationMinutes: { type: Number, default: 30, min: 0 },
  order: { type: Number, default: 1 },
  // QUIZ lessons are graded by the server; correct answers are never sent to the browser.
  quiz: {
    passScore: { type: Number, default: 70, min: 0, max: 100 },
    questions: [{
      prompt: { type: String, required: true },
      options: [{ type: String, required: true }],
      correctIndex: { type: Number, required: true, min: 0 }
    }]
  }
}, { timestamps: true });

const learningModuleSchema = new mongoose.Schema({
  pathId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningPath', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  order: { type: Number, default: 1 }
}, { timestamps: true });

const learningPathSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'InternshipProgram', index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  targetRole: { type: String, default: 'Software Engineer Intern' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const learningProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningLesson', required: true, index: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningModule', required: true },
  pathId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningPath', required: true },
  isCompleted: { type: Boolean, default: true },
  completedAt: { type: Date, default: Date.now },
  score: { type: Number }
}, { timestamps: true });

learningProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

export const LearningPath = mongoose.models.LearningPath || mongoose.model('LearningPath', learningPathSchema);
export const LearningModule = mongoose.models.LearningModule || mongoose.model('LearningModule', learningModuleSchema);
export const LearningLesson = mongoose.models.LearningLesson || mongoose.model('LearningLesson', learningLessonSchema);
export const LearningProgress = mongoose.models.LearningProgress || mongoose.model('LearningProgress', learningProgressSchema);
