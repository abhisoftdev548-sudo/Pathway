import Report from '../models/Report.js';
import { sendSuccess, parsePagination, paginationMeta } from '../utils/responses.js';
import { asyncHandler, ApiError } from '../utils/ApiError.js';

export const create = asyncHandler(async (req, res) => {
  const { targetType, targetId, reason, details } = req.body;

  // Prevent users from reporting the same target repeatedly.
  const existing = await Report.findOne({
    reporter: req.user._id,
    targetType,
    targetId,
    status: { $in: ['OPEN', 'UNDER_REVIEW'] },
  });
  if (existing) {
    throw ApiError.conflict('You already have an open report for this item', 'REPORT_EXISTS');
  }

  const report = await Report.create({
    reporter: req.user._id,
    targetType,
    targetId,
    reason,
    details,
  });
  return sendSuccess(res, { report }, undefined, 201);
});

export const myReports = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const filter = { reporter: req.user._id };
  const [items, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Report.countDocuments(filter),
  ]);
  return sendSuccess(res, { items }, paginationMeta({ page, limit, total }));
});
