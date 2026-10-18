import mongoose from 'mongoose';

/**
 * One vote document per voter per poll (duplicate voting is prevented with a
 * unique index plus service-level checks). Anonymous polls never expose the
 * `user` reference through public endpoints.
 */
const pollVoteSchema = new mongoose.Schema(
  {
    poll: { type: mongoose.Schema.Types.ObjectId, ref: 'Poll', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    optionIds: { type: [String], default: [] },
    votedAt: { type: Date, default: Date.now },

    entryFeeCharged: { type: Number, default: 0, min: 0 },
    entryFeeTxId: { type: String },
    rewardPaid: { type: Number, default: 0, min: 0 },
    rewardTxId: { type: String },
    refundTxId: { type: String },
    suspicious: { type: Boolean, default: false },
  },
  { timestamps: true }
);

pollVoteSchema.index({ poll: 1, user: 1 }, { unique: true });
pollVoteSchema.index({ poll: 1, votedAt: 1 });

const PollVote = mongoose.model('PollVote', pollVoteSchema);
export default PollVote;
