import mongoose from 'mongoose';

/**
 * Immutable audit trail for every sensitive administrative action.
 * Nothing here is ever edited or deleted — evidence is preserved.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, maxlength: 80 },
    targetType: { type: String, maxlength: 40, default: 'SYSTEM' },
    targetId: { type: String, maxlength: 64, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const BLOCKED = function blockImmutable() {
  throw new Error('Audit logs are immutable.');
};
auditLogSchema.pre('findOneAndUpdate', BLOCKED);
auditLogSchema.pre('updateOne', BLOCKED);
auditLogSchema.pre('updateMany', BLOCKED);
auditLogSchema.pre('deleteOne', BLOCKED);
auditLogSchema.pre('deleteMany', BLOCKED);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
