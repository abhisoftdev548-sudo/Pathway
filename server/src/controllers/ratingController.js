import * as ratingService from '../services/ratingService.js';
import { sendSuccess, parsePagination, paginationMeta } from '../utils/responses.js';
import { asyncHandler } from '../utils/ApiError.js';

export const create = asyncHandler(async (req, res) => {
  const rating = await ratingService.createRating({ user: req.user, ...req.body });
  return sendSuccess(res, { rating }, undefined, 201);
});

export const listForTarget = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { targetType, targetId } = req.params;
  const result = await ratingService.listTargetRatings({ targetType, targetId, page, limit, user: req.user });
  return sendSuccess(
    res,
    { items: result.items, summary: result.summary },
    paginationMeta({ page, limit, total: result.total })
  );
});

export const creatorFeedback = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await ratingService.listCreatorFeedback({ user: req.user, page, limit });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const creatorReputation = asyncHandler(async (req, res) => {
  const reputation = await ratingService.getCreatorReputation(req.params.userId ?? req.user._id);
  return sendSuccess(res, reputation);
});
