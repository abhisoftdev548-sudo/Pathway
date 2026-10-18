import mongoose from 'mongoose';
import { ADMIN_ACTIONS, RATING_TARGETS } from '../constants/index.js';

/**
 * Every moderation decision on quizzes/polls: approve, reject, request changes,
 * unpublish, restore, or quality rating. Previous decisions stay queryable.
 */
const adminReviewSchema = new mongoose.Schema(
  {
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: Object.values(RATING_TARGETS), required: true, index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    versionNumber: { type: Number, default: 1 },
    action: { type: String, enum: Object.values(ADMIN_ACTIONS), required: true },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    qualityRating: { type: Number, min: 1, max: 5, default: null },
  },
  { timestamps: true }
);

adminReviewSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
adminReviewSchema.index({ reviewer: 1, createdAt: -1 });

const AdminReview = mongoose.model('AdminReview', adminReviewSchema);
export default AdminReview;
