import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { jsonOptions } from '../utils/serializers.js';
import { ROLES } from './constants.js';

const preferencesSchema = new Schema(
  {
    emailNotifications: { type: Boolean, default: false },
    inAppReminders: { type: Boolean, default: true },
    reminderTime: { type: String, default: '19:00' },
    weekStartsOn: { type: Number, enum: [0, 1], default: 1 },
    showCompletedTasks: { type: Boolean, default: true },
    reduceMotion: { type: Boolean, default: false },
    weeklyGoalTasks: { type: Number, default: 10, min: 1, max: 200 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'user', index: true },
    avatar: { type: String, default: '', maxlength: 500 },
    bio: { type: String, default: '', maxlength: 280 },
    dailyGoalMinutes: { type: Number, default: 45, min: 5, max: 480 },
    timezone: { type: String, default: 'UTC' },
    preferences: { type: preferencesSchema, default: () => ({}) },
    tokenVersion: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: jsonOptions, toObject: jsonOptions },
);

export type UserDocument = InferSchemaType<typeof userSchema> & mongoose.Document;
export const User = mongoose.model('User', userSchema);
