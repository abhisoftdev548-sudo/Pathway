import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { jsonOptions } from '../utils/serializers.js';

/**
 * DSA / coding practice submissions are stored separately from authoritative
 * completion state. There is no code execution service integrated: users record
 * their solution and self-verify against the provided acceptance criteria.
 */
const taskSubmissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    kind: { type: String, enum: ['code', 'text', 'quiz'], default: 'code' },
    language: { type: String, default: 'cpp', maxlength: 40 },
    content: { type: String, required: true, maxlength: 50000 },
    notes: { type: String, default: '', maxlength: 2000 },
    selfVerified: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: jsonOptions, toObject: jsonOptions },
);

taskSubmissionSchema.index({ userId: 1, taskId: 1, createdAt: -1 });

export type TaskSubmissionDocument = InferSchemaType<typeof taskSubmissionSchema> & mongoose.Document;
export const TaskSubmission = mongoose.model('TaskSubmission', taskSubmissionSchema);
