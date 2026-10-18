import * as quizService from '../services/quizService.js';
import * as attemptService from '../services/attemptService.js';
import { sendSuccess, parsePagination, paginationMeta } from '../utils/responses.js';
import { asyncHandler } from '../utils/ApiError.js';

export const listPublished = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const q = req.validatedQuery ?? req.query;
  const result = await quizService.listPublished({ page, limit, ...pickFilters(q) });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

function pickFilters(q) {
  return {
    search: q.search,
    category: q.category,
    difficulty: q.difficulty,
    tag: q.tag,
    sort: q.sort,
  };
}

export const listMine = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const status = req.validatedQuery?.status ?? req.query.status;
  const result = await quizService.listMine({ user: req.user, page, limit, status });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const getForPlay = asyncHandler(async (req, res) => {
  const result = await quizService.getForPlay({ slugOrId: req.params.slugOrId, user: req.user });
  return sendSuccess(res, result);
});

export const getMineDetail = asyncHandler(async (req, res) => {
  const result = await quizService.getWithSolutions({ quizId: req.params.id, user: req.user });
  return sendSuccess(res, result);
});

export const create = asyncHandler(async (req, res) => {
  const quiz = await quizService.createQuiz({ creator: req.user._id, input: req.body });
  return sendSuccess(res, { quiz }, undefined, 201);
});

export const update = asyncHandler(async (req, res) => {
  const { changeNote, ...input } = req.body;
  const quiz = await quizService.updateQuiz({ quizId: req.params.id, user: req.user, input, changeNote });
  return sendSuccess(res, { quiz });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await quizService.deleteQuiz({ quizId: req.params.id, user: req.user });
  return sendSuccess(res, result);
});

export const duplicate = asyncHandler(async (req, res) => {
  const quiz = await quizService.duplicateQuiz({ quizId: req.params.id, user: req.user });
  return sendSuccess(res, { quiz }, undefined, 201);
});

export const submitForReview = asyncHandler(async (req, res) => {
  const result = await quizService.submitForReview({
    quizId: req.params.id,
    user: req.user,
    changeNote: req.body?.changeNote ?? '',
  });
  return sendSuccess(res, { quiz: result.quiz, version: { id: result.version._id, versionNumber: result.version.versionNumber } });
});

export const myVersions = asyncHandler(async (req, res) => {
  const result = await quizService.getWithSolutions({ quizId: req.params.id, user: req.user });
  return sendSuccess(res, { versions: result.versions });
});

export const listForModeration = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const status = req.validatedQuery?.status ?? req.query.status ?? 'PENDING_REVIEW';
  const result = await quizService.listForModeration({ page, limit, status: status === 'ALL' ? null : status });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const startAttempt = asyncHandler(async (req, res) => {
  const result = await attemptService.startAttempt({ quizId: req.params.id, user: req.user });
  return sendSuccess(res, result, undefined, 201);
});

export const submitAttempt = asyncHandler(async (req, res) => {
  const result = await attemptService.submitAttempt({
    attemptId: req.params.attemptId,
    user: req.user,
    answers: req.body.answers ?? [],
    timeSpentSec: req.body.timeSpentSec ?? 0,
  });
  return sendSuccess(res, result);
});

export const getAttempt = asyncHandler(async (req, res) => {
  const result = await attemptService.getAttemptResult({ attemptId: req.params.attemptId, user: req.user });
  return sendSuccess(res, result);
});
