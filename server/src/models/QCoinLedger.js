import mongoose from 'mongoose';
import { ACTIVITY_TYPES, TX_DIRECTION, TX_TYPE } from '../constants/index.js';

/**
 * Immutable QCoin ledger — append-only source of truth for every credit/debit.
 *
 *  - `txId` is globally unique.
 *  - `idempotencyKey` guarantees a business action (entry fee, reward payout,
 *    refund, adjustment) can never be applied twice.
 *  - Updates and deletes are blocked by schema middleware.
 *  - Amounts are integers; positive = credit, negative = debit.
 */
const qcoinLedgerSchema = new mongoose.Schema(
  {
    txId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(TX_TYPE), required: true },
    direction: { type: String, enum: Object.values(TX_DIRECTION), required: true },
    amount: { type: Number, required: true }, // signed integer
    balanceAfter: { type: Number, required: true, min: 0 },

    activityType: {
      type: String,
      enum: Object.values(ACTIVITY_TYPES),
      default: ACTIVITY_TYPES.SYSTEM,
    },
    activityId: { type: String, default: null },

    idempotencyKey: { type: String, required: true, unique: true },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

qcoinLedgerSchema.index({ user: 1, createdAt: -1 });
qcoinLedgerSchema.index({ type: 1, createdAt: -1 });

const BLOCKED = function blockImmutable() {
  throw new Error('QCoinLedger entries are immutable.');
};
qcoinLedgerSchema.pre('findOneAndUpdate', BLOCKED);
qcoinLedgerSchema.pre('updateOne', BLOCKED);
qcoinLedgerSchema.pre('updateMany', BLOCKED);
qcoinLedgerSchema.pre('replaceOne', BLOCKED);
qcoinLedgerSchema.pre('deleteOne', BLOCKED);
qcoinLedgerSchema.pre('deleteMany', BLOCKED);
qcoinLedgerSchema.pre('findOneAndDelete', BLOCKED);

const QCoinLedger = mongoose.model('QCoinLedger', qcoinLedgerSchema);
export default QCoinLedger;
