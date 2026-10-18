import * as pollService from '../services/pollService.js';
import { sendSuccess, parsePagination, paginationMeta } from '../utils/responses.js';
import { asyncHandler } from '../utils/ApiError.js';

export const listPublished = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const q = req.validatedQuery ?? req.query;
  const result = await pollService.listPublishedPolls({
    page,
    limit,
    search: q.search,
    category: q.category,
    tag: q.tag,
    sort: q.sort,
  });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const listMine = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const status = req.validatedQuery?.status ?? req.query.status;
  const result = await pollService.listMyPolls({ user: req.user, page, limit, status });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const getDetail = asyncHandler(async (req, res) => {
  const result = await pollService.getPollDetail({ slugOrId: req.params.slugOrId, user: req.user });
  return sendSuccess(res, result);
});

export const create = asyncHandler(async (req, res) => {
  const poll = await pollService.createPoll({ creator: req.user._id, input: req.body });
  return sendSuccess(res, { poll }, undefined, 201);
});

export const update = asyncHandler(async (req, res) => {
  const poll = await pollService.updatePoll({ pollId: req.params.id, user: req.user, input: req.body });
  return sendSuccess(res, { poll });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await pollService.deletePoll({ pollId: req.params.id, user: req.user });
  return sendSuccess(res, result);
});

export const submitForReview = asyncHandler(async (req, res) => {
  const poll = await pollService.submitPollForReview({
    pollId: req.params.id,
    user: req.user,
    changeNote: req.body?.changeNote ?? '',
  });
  return sendSuccess(res, { poll });
});

export const vote = asyncHandler(async (req, res) => {
  const result = await pollService.castVote({
    pollId: req.params.id,
    user: req.user,
    optionIds: req.body.optionIds,
  });
  return sendSuccess(res, result, undefined, 201);
});

export const listForModeration = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const status = req.validatedQuery?.status ?? req.query.status ?? 'PENDING_REVIEW';
  const { default: Poll } = await import('../models/Poll.js');
  const filter = status === 'ALL' ? {} : { status };
  const [items, total] = await Promise.all([
    Poll.find(filter)
      .sort({ updatedAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('creator', 'name email')
      .lean(),
    Poll.countDocuments(filter),
  ]);
  return sendSuccess(res, { items }, paginationMeta({ page, limit, total }));
});
