import mongoose from 'mongoose';
import { RATING_TARGETS } from '../constants/index.js';

const ratingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: Object.values(RATING_TARGETS), required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, trim: true, maxlength: 2000, default: '' },
    creatorReply: {
      text: { type: String, trim: true, maxlength: 1000, default: '' },
      repliedAt: { type: Date },
    },
    hidden: { type: Boolean, default: false },
    hiddenReason: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

// One rating per user per target (prevents duplicate/self-review at DB level too).
ratingSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });
ratingSchema.index({ targetType: 1, targetId: 1, hidden: 1 });

const Rating = mongoose.model('Rating', ratingSchema);
export default Rating;
