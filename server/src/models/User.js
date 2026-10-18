import mongoose from 'mongoose';
import { ACCOUNT_STATUS, ROLES } from '../constants/index.js';

const avatarSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
  },
  { _id: false }
);

const walletSchema = new mongoose.Schema(
  {
    balance: { type: Number, default: 0, min: 0 },
    totalEarned: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    emailNotifications: { type: Boolean, default: true },
    showOnLeaderboards: { type: Boolean, default: true },
    theme: { type: String, enum: ['system', 'light', 'dark'], default: 'system' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
    status: { type: String, enum: Object.values(ACCOUNT_STATUS), default: ACCOUNT_STATUS.ACTIVE },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    avatar: { type: avatarSchema, default: () => ({}) },
    wallet: { type: walletSchema, default: () => ({}) },
    settings: { type: settingsSchema, default: () => ({}) },

    // Password reset (store only hashes of reset tokens)
    resetPasswordHash: { type: String, select: false },
    resetPasswordExpiresAt: { type: Date, select: false },
    passwordChangedAt: { type: Date },

    // Suspension bookkeeping
    suspendedAt: { type: Date },
    suspendedReason: { type: String, maxlength: 500 },

    lastActiveAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.resetPasswordHash;
        delete ret.resetPasswordExpiresAt;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'wallet.balance': -1 });

userSchema.methods.changedPasswordAfter = function changedPasswordAfter(jwtIatSeconds) {
  if (!this.passwordChangedAt) return false;
  const changedAt = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return jwtIatSeconds < changedAt;
};

const User = mongoose.model('User', userSchema);
export default User;
