import * as leaderboardService from '../services/leaderboardService.js';
import { sendSuccess } from '../utils/responses.js';
import { asyncHandler } from '../utils/ApiError.js';

export const performance = asyncHandler(async (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  const items = await leaderboardService.getPerformanceLeaderboard({ limit });
  return sendSuccess(res, { items });
});

export const consistency = asyncHandler(async (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  const items = await leaderboardService.getConsistencyLeaderboard({ limit });
  return sendSuccess(res, { items });
});

export const creators = asyncHandler(async (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  const items = await leaderboardService.getCreatorLeaderboard({ limit });
  return sendSuccess(res, { items });
});
