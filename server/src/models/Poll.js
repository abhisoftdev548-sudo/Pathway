import mongoose from 'mongoose';
import {
  CONTENT_STATUS,
  POLL_REWARD_MODES,
  RESULTS_VISIBILITY,
  VOTING_TYPE,
} from '../constants/index.js';

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
  },
  { _id: false }
);

const pollOptionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
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
    votesCount: { type: Number, default: 0, min: 0 },
    uniqueVoters: { type: Number, default: 0, min: 0 },
    totalSelections: { type: Number, default: 0, min: 0 },
    ratingCount: { type: Number, default: 0, min: 0 },
    ratingRawAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingBayes: { type: Number, default: 0, min: 0, max: 5 },
    totalRewardsPaid: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const pollSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    question: { type: String, required: true, trim: true, maxlength: 1000 },
    description: { type: String, trim: true, maxlength: 4000, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    tags: { type: [String], default: [] },
    language: { type: String, default: 'en', maxlength: 20 },
    cover: { type: imageSchema, default: () => ({}) },

    votingType: { type: String, enum: Object.values(VOTING_TYPE), default: VOTING_TYPE.SINGLE },
    options: { type: [pollOptionSchema], default: [] },

    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true },
    anonymous: { type: Boolean, default: true },
    resultsVisibility: {
      type: String,
      enum: Object.values(RESULTS_VISIBILITY),
      default: RESULTS_VISIBILITY.AFTER_VOTE,
    },

    entryFee: { type: Number, min: 0, max: 1000, default: 0 },
    reward: { type: Number, min: 0, max: 5000, default: 0 },
    rewardMode: {
      type: String,
      enum: Object.values(POLL_REWARD_MODES),
      default: POLL_REWARD_MODES.ALL_PARTICIPANTS,
    },
    maxRewardRecipients: { type: Number, min: 0, default: 0 },

    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.DRAFT, index: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    publishedAt: { type: Date },
    unpublishedAt: { type: Date },
    cancelledAt: { type: Date },
    revisionHistory: {
      type: [
        new mongoose.Schema(
          {
            note: { type: String, maxlength: 500, default: '' },
            changedAt: { type: Date, default: Date.now },
            changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    moderation: { type: moderationSchema, default: () => ({}) },
    stats: { type: statsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

pollSchema.index({ status: 1, publishedAt: -1 });
pollSchema.index({ creator: 1, status: 1 });
pollSchema.index({ endsAt: 1 });
pollSchema.index({ title: 'text', question: 'text', description: 'text' });

const Poll = mongoose.model('Poll', pollSchema);
export default Poll;
