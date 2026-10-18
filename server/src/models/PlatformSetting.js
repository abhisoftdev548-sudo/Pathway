import mongoose from 'mongoose';

/**
 * Singleton-ish key/value platform settings (fee limits, reward limits, rules).
 * Every mutation is performed by admins and recorded in the audit log.
 */
const platformSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String, maxlength: 300, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const SETTING_KEYS = Object.freeze({
  ECONOMY_LIMITS: 'economy_limits',
  QUIZ_RULES: 'quiz_rules',
  POLL_RULES: 'poll_rules',
  NOTIFICATION_TEMPLATES: 'notification_templates',
  PLATFORM_META: 'platform_meta',
});

const PlatformSetting = mongoose.model('PlatformSetting', platformSettingSchema);
export default PlatformSetting;
