import mongoose from 'mongoose';
import {
  CONTENT_STATUS,
  DIFFICULTY,
  QUIZ_REWARD_MODES,
} from '../constants/index.js';

export const optionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

export const keywordSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 120 },
    weight: { type: Number, default: 1, min: 0, max: 100 },
  },
  { _id: false }
);

export const evaluationRulesSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['KEYWORDS', 'MANUAL'], default: 'KEYWORDS' },
    keywords: { type: [keywordSchema], default: [] },
    minMatches: { type: Number, default: 1, min: 0 },
    passRatio: { type: Number, default: 0.7, min: 0, max: 1 },
    caseSensitive: { type: Boolean, default: false },
    flagForReviewOnFail: { type: Boolean, default: false },
  },
  { _id: false }
);

export const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'],
    },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    hint: { type: String, trim: true, maxlength: 500, default: '' },
    explanation: { type: String, trim: true, maxlength: 2000, default: '' },
    points: { type: Number, default: 1, min: 1, max: 100 },
    options: { type: [optionSchema], default: [] },
    correctBoolean: { type: Boolean, default: null },
    correctAnswers: { type: [String], default: [] },
    evaluationRules: { type: evaluationRulesSchema, default: undefined },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
  },
  { _id: false }
);

const revisionSchema = new mongoose.Schema(
  {
    versionNumber: { type: Number, required: true },
    note: { type: String, maxlength: 500, default: '' },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const moderationSchema = new mongoose.Schema(
  {
    lastDecision: { type: String, enum: ['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'UNPUBLISH', 'RESTORE'], default: null },
    lastNotes: { type: String, maxlength: 2000, default: '' },
    lastReviewedAt: { type: Date },
    lastReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminQualityRating: { type: Number, min: 1, max: 5, default: null },
    changesRequestedNote: { type: String, maxlength: 2000, default: '' },
  },
  { _id: false }
);

const statsSchema = new mongoose.Schema(
  {
    attemptsCount: { type: Number, default: 0, min: 0 },
    completionsCount: { type: Number, default: 0, min: 0 },
    passesCount: { type: Number, default: 0, min: 0 },
    avgScore: { type: Number, default: 0, min: 0, max: 100 },
    ratingCount: { type: Number, default: 0, min: 0 },
    ratingRawAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingBayes: { type: Number, default: 0, min: 0, max: 5 },
    totalRewardsPaid: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 4000, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    tags: { type: [String], default: [] },
    difficulty: { type: String, enum: Object.values(DIFFICULTY), default: DIFFICULTY.MEDIUM },
    language: { type: String, default: 'en', maxlength: 20 },
    cover: { type: imageSchema, default: () => ({}) },

    timeLimitMinutes: { type: Number, min: 0, max: 600, default: 0 }, // 0 = untimed
    passingScore: { type: Number, min: 0, max: 100, default: 50 },

    entryFee: { type: Number, min: 0, max: 1000, default: 0 },
    reward: { type: Number, min: 0, max: 5000, default: 0 },
    rewardMode: { type: String, enum: Object.values(QUIZ_REWARD_MODES), default: QUIZ_REWARD_MODES.ALL_PASSERS },
    topPercent: { type: Number, min: 1, max: 100, default: 20 },
    maxRewardRecipients: { type: Number, min: 0, default: 0 }, // 0 = unlimited
    attemptsAllowed: { type: Number, min: 1, max: 20, default: 1 },

    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.DRAFT, index: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    currentVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizVersion', default: null },
    versionNumber: { type: Number, default: 1, min: 1 },
    questions: { type: [questionSchema], default: [] }, // draft working copy

    publishedAt: { type: Date },
    unpublishedAt: { type: Date },
    revisionHistory: { type: [revisionSchema], default: [] },
    moderation: { type: moderationSchema, default: () => ({}) },
    stats: { type: statsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

quizSchema.index({ status: 1, publishedAt: -1 });
quizSchema.index({ creator: 1, status: 1 });
quizSchema.index({ category: 1, status: 1 });
quizSchema.index({ tags: 1 });
quizSchema.index({ title: 'text', description: 'text', tags: 'text' });

const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;
