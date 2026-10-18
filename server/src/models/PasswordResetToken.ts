import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { jsonOptions } from '../utils/serializers.js';

const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: jsonOptions, toObject: jsonOptions },
);

export type PasswordResetTokenDocument = InferSchemaType<typeof passwordResetTokenSchema> & mongoose.Document;
export const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
