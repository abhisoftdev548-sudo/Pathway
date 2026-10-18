import mongoose from 'mongoose';
import { ATTEMPT_STATUS } from '../constants/index.js';

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    // Single-choice: option id. Multiple-choice: array of option ids.
    // True/false: boolean. Fill-blank/short-answer: string.
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    type: { type: String },
    awardedPoints: { type: Number, default: 0 },
    maxPoints: { type: Number, default: 0 },
    correct: { type: Boolean, default: false },
    needsReview: { type: Boolean, default: false },
    matchedKeywords: { type: [String], default: [] },
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    quizVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizVersion', required: true },
    versionNumber: { type: Number, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Presentation snapshot (participant-safe: no correct answers).
    presentedQuestions: { type: [mongoose.Schema.Types.Mixed], default: [] },

    answers: { type: [answerSchema], default: [] },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date },
    timeSpentSec: { type: Number, default: 0, min: 0 },

    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    needsReview: { type: Boolean, default: false },
    questionResults: { type: [resultSchema], default: [] },

    status: {
      type: String,
      enum: Object.values(ATTEMPT_STATUS),
      default: ATTEMPT_STATUS.IN_PROGRESS,
      index: true,
    },

    // QCoin bookkeeping (immutable ledger holds source of truth)
    entryFeeCharged: { type: Number, default: 0, min: 0 },
    entryFeeTxId: { type: String },
    rewardPaid: { type: Number, default: 0, min: 0 },
    rewardTxId: { type: String },
    refundTxId: { type: String },
    suspicious: { type: Boolean, default: false },
    suspiciousReason: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

// Attempt-count limits and duplicate-submit protection are enforced in the
// service layer (attemptsAllowed per quiz, IN_PROGRESS→SUBMITTED transition guard),
// so multi-attempt quizzes remain possible without partial-index gymnastics.
quizAttemptSchema.index({ quiz: 1, user: 1, status: 1 });
quizAttemptSchema.index({ user: 1, createdAt: -1 });
quizAttemptSchema.index({ quiz: 1, percentage: -1 });

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
export default QuizAttempt;
