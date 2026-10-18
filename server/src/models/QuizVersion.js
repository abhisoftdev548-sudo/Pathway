import mongoose from 'mongoose';
import { questionSchema } from './Quiz.js';

/**
 * Immutable snapshot of a quiz at review/publish time.
 * Attempts always reference the exact version a participant saw.
 */
const quizVersionSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    versionNumber: { type: Number, required: true, min: 1 },
    snapshot: {
      title: { type: String, required: true },
      description: { type: String, default: '' },
      category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
      subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
      tags: { type: [String], default: [] },
      difficulty: { type: String },
      language: { type: String, default: 'en' },
      cover: {
        url: { type: String, default: '' },
        publicId: { type: String, default: '' },
      },
      timeLimitMinutes: { type: Number, default: 0 },
      passingScore: { type: Number, default: 50 },
      entryFee: { type: Number, default: 0 },
      reward: { type: Number, default: 0 },
      rewardMode: { type: String },
      topPercent: { type: Number, default: 20 },
      maxRewardRecipients: { type: Number, default: 0 },
      attemptsAllowed: { type: Number, default: 1 },
      questions: { type: [questionSchema], default: [] },
    },
    changeNote: { type: String, maxlength: 500, default: '' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

quizVersionSchema.index({ quiz: 1, versionNumber: -1 }, { unique: true });

const QuizVersion = mongoose.model('QuizVersion', quizVersionSchema);
export default QuizVersion;
