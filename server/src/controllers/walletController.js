import * as walletService from '../services/walletService.js';
import { sendSuccess, parsePagination, paginationMeta } from '../utils/responses.js';
import { asyncHandler } from '../utils/ApiError.js';

export const getWallet = asyncHandler(async (req, res) => {
  return sendSuccess(res, { wallet: req.user.wallet });
});

export const getTransactions = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const type = req.validatedQuery?.type ?? req.query.type;
  const result = await walletService.getTransactions({
    userId: req.user._id,
    page,
    limit,
    type: type || null,
  });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const getRewards = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await walletService.getTransactions({
    userId: req.user._id,
    page,
    limit,
    type: 'REWARD',
  });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

/**
 * QCoin policy documentation served from the API so client and server agree.
 * Stated rules: no cash withdrawal, no user-to-user transfers.
 */
export const getWalletPolicy = asyncHandler(async (_req, res) => {
  return sendSuccess(res, {
    withdrawable: false,
    transferableBetweenUsers: false,
    description:
      'QCoins are internal, non-withdrawable platform credits. They cannot be exchanged for cash or transferred between users. Entry fees, rewards, refunds, and authorized adjustments are recorded in an immutable ledger.',
    rules: {
      entryFees: 'Optional per quiz/poll, deducted at participation start and refundable per the refund policy.',
      rewards: 'Optional per quiz/poll, paid after server-verified completion according to the reward mode.',
      refunds: 'Abandoned attempts, platform-cancelled content, and admin-approved requests are refunded.',
      adjustments: 'Admin adjustments always require a written reason and are permanently audited.',
    },
  });
});
