import mongoose, { Schema } from 'mongoose';

/** Mongoose schemas used in production (MongoDB Atlas).
 *  Documents carry a string `id` so the repository layer is identical
 *  across the Atlas store and the local JSON dev store. */
const base = { id: { type: String, required: true, unique: true, index: true }, createdAt: { type: String }, updatedAt: { type: String } };

const UserSchema = new Schema({
  ...base, displayName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  avatar: String, bio: String, isSuspended: { type: Boolean, default: false },
  resetTokenHash: String, resetTokenExpiresAt: String, preferences: Schema.Types.Mixed,
}, { versionKey: false });

const CategorySchema = new Schema({
  ...base, name: { type: String, required: true }, slug: { type: String, required: true, unique: true, index: true },
  description: String, parentCategoryId: { type: String, default: null, index: true }, isActive: { type: Boolean, default: true, index: true },
}, { versionKey: false });

const QuizSchema = new Schema({
  ...base, slug: { type: String, required: true, unique: true, index: true },
  creatorId: { type: String, required: true, index: true },
  status: { type: String, index: true }, draftVersionId: String, pendingVersionId: { type: String, index: true, sparse: true },
  currentPublishedVersionId: String, isLive: { type: Boolean, default: false, index: true },
  nextVersionNumber: Number, attemptsCount: { type: Number, default: 0, index: true },
  ratingAvg: Number, ratingCount: Number, latestFeedback: String, publishedAt: String,
}, { versionKey: false });
QuizSchema.index({ isLive: 1, status: 1, attemptsCount: -1 });

const VersionSchema = new Schema({
  ...base, quizId: { type: String, required: true, index: true }, versionNumber: Number,
  state: { type: String, index: true },
  // Metadata snapshot + immutable question set for this version (discovery indexes on snapshot fields)
  'metadata.categoryId': { type: String }, 'metadata.subcategoryId': String,
  'metadata.difficulty': String, 'metadata.language': String,
  metadata: Schema.Types.Mixed, questions: [Schema.Types.Mixed],
  totalPoints: Number, createdBy: String,
}, { versionKey: false });
VersionSchema.index({ quizId: 1, versionNumber: -1 });
VersionSchema.index({ 'metadata.categoryId': 1, 'metadata.difficulty': 1, 'metadata.language': 1 });
VersionSchema.index({ 'metadata.tags': 1 });

const AttemptSchema = new Schema({
  ...base, userId: { type: String, required: true, index: true }, quizId: { type: String, required: true, index: true },
  quizVersionId: { type: String, required: true }, responses: [Schema.Types.Mixed],
  displayedQuestionOrder: [String], displayedOptionOrders: Schema.Types.Mixed,
  status: { type: String, index: true }, score: Number, maximumScore: Number, pendingMarks: Number,
  percentage: Number, correctCount: Number, incorrectCount: Number, unansweredCount: Number,
  results: [Schema.Types.Mixed], evaluationStatus: String, startedAt: String, submittedAt: String, timeTaken: Number,
}, { versionKey: false });
AttemptSchema.index({ userId: 1, quizId: 1, status: 1 });

const BookmarkSchema = new Schema({ id: base.id, userId: { type: String, index: true }, quizId: { type: String, index: true }, createdAt: String }, { versionKey: false });
BookmarkSchema.index({ userId: 1, quizId: 1 }, { unique: true });

const ModerationLogSchema = new Schema({
  id: base.id, quizId: { type: String, index: true }, quizVersionId: String, adminId: { type: String, index: true },
  action: String, previousStatus: String, newStatus: String, feedback: String, createdAt: String,
}, { versionKey: false });

const ReportSchema = new Schema({
  ...base, quizId: { type: String, index: true }, reporterId: String, reason: String, details: String,
  status: { type: String, index: true }, reviewedBy: String,
}, { versionKey: false });

const NotificationSchema = new Schema({
  id: base.id, userId: { type: String, index: true }, type: String, message: String, quizId: String, read: Boolean, createdAt: String,
}, { versionKey: false });

const RatingSchema = new Schema({ ...base, userId: { type: String, index: true }, quizId: { type: String, index: true }, rating: Number }, { versionKey: false });
RatingSchema.index({ userId: 1, quizId: 1 }, { unique: true });

function model(name: string, schema: Schema) { return mongoose.models[name] || mongoose.model(name, schema); }

export const MODELS: Record<string, any> = {
  users: model('User', UserSchema), categories: model('Category', CategorySchema),
  quizzes: model('Quiz', QuizSchema), versions: model('QuizVersion', VersionSchema),
  attempts: model('QuizAttempt', AttemptSchema), bookmarks: model('Bookmark', BookmarkSchema),
  moderationLogs: model('ModerationLog', ModerationLogSchema), reports: model('QuizReport', ReportSchema),
  notifications: model('Notification', NotificationSchema), ratings: model('QuizRating', RatingSchema),
};
