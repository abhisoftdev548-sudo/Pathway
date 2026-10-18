import Quiz from '../models/Quiz.js';
import QuizVersion from '../models/QuizVersion.js';
import QuizAttempt from '../models/QuizAttempt.js';
import Rating from '../models/Rating.js';
import Category from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { uniqueSlug, slugify } from '../utils/crypto.js';
import { toSolutionQuestion, toParticipantQuestion } from '../utils/scoring.js';
import { validateEconomyConfig } from '../utils/walletRules.js';
import {
  ACTIVITY_TYPES,
  CONTENT_STATUS,
  NOTIFICATION_TYPES,
} from '../constants/index.js';
import { notify } from './notificationService.js';
import { destroyImage } from '../config/cloudinary.js';

const EDITABLE_STATUSES = [CONTENT_STATUS.DRAFT, CONTENT_STATUS.CHANGES_REQUESTED];
const PUBLISHED_VISIBLE = [CONTENT_STATUS.APPROVED];

function assertEconomy({ entryFee, reward, maxRewardRecipients }) {
  const problems = validateEconomyConfig({
    entryFee,
    reward,
    maxRewardRecipients: maxRewardRecipients > 0 ? maxRewardRecipients : undefined,
  });
  if (problems.length > 0) {
    throw ApiError.badRequest(problems[0], 'ECONOMY_CONFIG_INVALID', problems);
  }
}

function assertQuestions(questions = []) {
  if (questions.length === 0) return; // drafts may be saved empty
  // Extra guard beyond zod: at least one correct answer per question.
  for (const q of questions) {
    if (q.type === 'SINGLE_CHOICE' && q.options.filter((o) => o.isCorrect).length !== 1) {
      throw ApiError.badRequest(`Question "${q.text.slice(0, 40)}" needs exactly one correct option`, 'INVALID_QUESTION');
    }
    if (q.type === 'MULTIPLE_CHOICE' && q.options.filter((o) => o.isCorrect).length < 1) {
      throw ApiError.badRequest(`Question "${q.text.slice(0, 40)}" needs at least one correct option`, 'INVALID_QUESTION');
    }
    if (q.type === 'TRUE_FALSE' && typeof q.correctBoolean !== 'boolean') {
      throw ApiError.badRequest(`Question "${q.text.slice(0, 40)}" needs a true/false answer key`, 'INVALID_QUESTION');
    }
    if (q.type === 'FILL_BLANK' && q.correctAnswers.length === 0) {
      throw ApiError.badRequest(`Question "${q.text.slice(0, 40)}" needs accepted answers`, 'INVALID_QUESTION');
    }
  }
}

export async function createQuiz({ creator, input }) {
  assertEconomy(input);
  assertQuestions(input.questions);

  const quiz = await Quiz.create({
    ...input,
    slug: uniqueSlug(input.title),
    creator,
    status: CONTENT_STATUS.DRAFT,
    revisionHistory: [{ versionNumber: 1, note: 'Draft created', changedAt: new Date(), changedBy: creator }],
  });
  return quiz;
}

export async function updateQuiz({ quizId, user, input, changeNote = '' }) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  if (String(quiz.creator) !== String(user._id) && user.role !== 'ADMIN') {
    throw ApiError.forbidden('Not your quiz');
  }
  if (!EDITABLE_STATUSES.includes(quiz.status) && user.role !== 'ADMIN') {
    throw ApiError.badRequest(
      `Cannot edit a quiz in ${quiz.status} status. Duplicate it or request a new version.`,
      'NOT_EDITABLE'
    );
  }

  if (input.questions) assertQuestions(input.questions);
  if (input.entryFee !== undefined || input.reward !== undefined || input.maxRewardRecipients !== undefined) {
    assertEconomy({
      entryFee: input.entryFee ?? quiz.entryFee,
      reward: input.reward ?? quiz.reward,
      maxRewardRecipients: input.maxRewardRecipients ?? quiz.maxRewardRecipients,
    });
  }

  Object.assign(quiz, input);
  quiz.revisionHistory.push({
    versionNumber: quiz.versionNumber,
    note: changeNote || 'Draft updated',
    changedAt: new Date(),
    changedBy: user._id,
  });
  await quiz.save();
  return quiz;
}

export async function duplicateQuiz({ quizId, user }) {
  const source = await Quiz.findById(quizId);
  if (!source) throw ApiError.notFound('Quiz not found');
  if (String(source.creator) !== String(user._id) && source.status !== CONTENT_STATUS.APPROVED) {
    throw ApiError.forbidden('Only your own quizzes or published quizzes can be duplicated');
  }

  return Quiz.create({
    title: `${source.title} (copy)`.slice(0, 160),
    slug: uniqueSlug(`${source.title}-copy`),
    description: source.description,
    category: source.category,
    subcategory: source.subcategory,
    tags: [...source.tags],
    difficulty: source.difficulty,
    language: source.language,
    cover: source.cover ?? {},
    timeLimitMinutes: source.timeLimitMinutes,
    passingScore: source.passingScore,
    entryFee: source.entryFee,
    reward: source.reward,
    rewardMode: source.rewardMode,
    topPercent: source.topPercent,
    maxRewardRecipients: source.maxRewardRecipients,
    attemptsAllowed: source.attemptsAllowed,
    questions: source.questions.map((q) => ({ ...q.toObject?.() ?? q })),
    creator: user._id,
    status: CONTENT_STATUS.DRAFT,
    versionNumber: 1,
    revisionHistory: [{ versionNumber: 1, note: `Duplicated from quiz ${source._id}`, changedAt: new Date(), changedBy: user._id }],
  });
}

/** Submit for admin review — freezes an immutable QuizVersion snapshot. */
export async function submitForReview({ quizId, user, changeNote = '' }) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  if (String(quiz.creator) !== String(user._id) && user.role !== 'ADMIN') {
    throw ApiError.forbidden('Not your quiz');
  }
  if (![CONTENT_STATUS.DRAFT, CONTENT_STATUS.CHANGES_REQUESTED].includes(quiz.status)) {
    throw ApiError.badRequest(`Cannot submit a quiz in ${quiz.status} status`, 'INVALID_STATUS');
  }
  if (quiz.questions.length === 0) {
    throw ApiError.badRequest('Add at least one question before submitting', 'NO_QUESTIONS');
  }
  assertQuestions(quiz.questions);
  assertEconomy(quiz);

  const versionNumber = quiz.versionNumber;
  const version = await QuizVersion.create({
    quiz: quiz._id,
    versionNumber,
    snapshot: {
      title: quiz.title,
      description: quiz.description,
      category: quiz.category,
      subcategory: quiz.subcategory,
      tags: quiz.tags,
      difficulty: quiz.difficulty,
      language: quiz.language,
      cover: quiz.cover ?? {},
      timeLimitMinutes: quiz.timeLimitMinutes,
      passingScore: quiz.passingScore,
      entryFee: quiz.entryFee,
      reward: quiz.reward,
      rewardMode: quiz.rewardMode,
      topPercent: quiz.topPercent,
      maxRewardRecipients: quiz.maxRewardRecipients,
      attemptsAllowed: quiz.attemptsAllowed,
      questions: quiz.questions.map((q) => ({ ...q.toObject?.() ?? q })),
    },
    changeNote,
    submittedBy: user._id,
  });

  quiz.status = CONTENT_STATUS.PENDING_REVIEW;
  quiz.currentVersion = version._id;
  quiz.moderation.changesRequestedNote = '';
  await quiz.save();

  return { quiz, version };
}

export async function deleteQuiz({ quizId, user }) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  if (String(quiz.creator) !== String(user._id) && user.role !== 'ADMIN') {
    throw ApiError.forbidden('Not your quiz');
  }

  const hasAttempts = (await QuizAttempt.countDocuments({ quiz: quiz._id })) > 0;
  if (hasAttempts && user.role !== 'ADMIN') {
    // Preserve attempt history: archive instead of hard delete.
    quiz.status = CONTENT_STATUS.ARCHIVED;
    quiz.unpublishedAt = new Date();
    await quiz.save();
    return { archived: true };
  }

  if (quiz.cover?.publicId) await destroyImage(quiz.cover.publicId);
  await Promise.all([
    QuizVersion.deleteMany({ quiz: quiz._id }),
    Rating.deleteMany({ targetType: 'QUIZ', targetId: quiz._id }),
    Quiz.deleteOne({ _id: quiz._id }),
  ]);
  return { archived: false };
}

/** Public listing: approved content only, real filter/search/sort. */
export async function listPublished({ page = 1, limit = 20, search, category, difficulty, tag, sort = 'newest' }) {
  const filter = { status: { $in: PUBLISHED_VISIBLE } };
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } },
    ];
  }
  if (category) filter.$or = [{ category }, { subcategory: category }];
  if (difficulty) filter.difficulty = difficulty;
  if (tag) filter.tags = tag;

  const sortMap = {
    newest: { publishedAt: -1 },
    popular: { 'stats.attemptsCount': -1, publishedAt: -1 },
    topRated: { 'stats.ratingBayes': -1, 'stats.ratingCount': -1 },
    difficulty: { difficulty: 1, publishedAt: -1 },
  };

  const [items, total] = await Promise.all([
    Quiz.find(filter)
      .sort(sortMap[sort] ?? sortMap.newest)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-questions -revisionHistory')
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('creator', 'name avatar')
      .lean(),
    Quiz.countDocuments(filter),
  ]);

  return { items, total };
}

/** Creator workspace listing (all statuses). */
export async function listMine({ user, page = 1, limit = 20, status }) {
  const filter = { creator: user._id };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    Quiz.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-questions.correctBoolean -questions.correctAnswers -questions.options.isCorrect -questions.evaluationRules')
      .lean(),
    Quiz.countDocuments(filter),
  ]);
  return { items, total };
}

/**
 * Load a quiz for participation. Serves the frozen version snapshot so attempts
 * always match the exact content a participant saw.
 */
export async function getForPlay({ slugOrId, user }) {
  const quiz = await Quiz.findOne({
    $or: [{ slug: String(slugOrId).toLowerCase() }, ...(isValidId(slugOrId) ? [{ _id: slugOrId }] : [])],
  })
    .populate('category', 'name slug')
    .populate('subcategory', 'name slug')
    .populate('creator', 'name avatar bio');

  if (!quiz) throw ApiError.notFound('Quiz not found');

  const isOwner = user && (String(quiz.creator?._id ?? quiz.creator) === String(user._id) || user.role === 'ADMIN');
  if (!isOwner && !PUBLISHED_VISIBLE.includes(quiz.status)) {
    throw ApiError.notFound('Quiz is not published');
  }

  const version = quiz.currentVersion
    ? await QuizVersion.findById(quiz.currentVersion).lean()
    : null;

  const questionsSource = version?.snapshot?.questions ?? quiz.questions;
  const participantQuestions = questionsSource.map(toParticipantQuestion);

  const myAttempts = user
    ? await QuizAttempt.find({ quiz: quiz._id, user: user._id, status: { $in: ['SUBMITTED', 'COMPLETED', 'REVIEW_PENDING'] } })
        .sort({ createdAt: -1 })
        .select('score percentage passed submittedAt status versionNumber')
        .lean()
    : [];

  return {
    quiz,
    versionNumber: version?.versionNumber ?? quiz.versionNumber,
    questions: participantQuestions,
    questionCount: participantQuestions.length,
    totalPoints: questionsSource.reduce((sum, q) => sum + (q.points ?? 1), 0),
    myAttempts,
    solution: isOwner ? questionsSource.map(toSolutionQuestion) : undefined,
  };
}

function isValidId(value) {
  return /^[0-9a-fA-F]{24}$/.test(String(value));
}

/** Full detail view for creators and admins (includes answers). */
export async function getWithSolutions({ quizId, user }) {
  const quiz = await Quiz.findById(quizId)
    .populate('category', 'name slug')
    .populate('subcategory', 'name slug')
    .populate('creator', 'name avatar bio email');
  if (!quiz) throw ApiError.notFound('Quiz not found');
  const isOwner = String(quiz.creator._id ?? quiz.creator) === String(user._id);
  if (!isOwner && user.role !== 'ADMIN') throw ApiError.forbidden('Not your quiz');

  const versions = await QuizVersion.find({ quiz: quiz._id })
    .sort({ versionNumber: -1 })
    .select('versionNumber changeNote createdAt snapshot.title')
    .lean();

  return { quiz, versions };
}

/** Admin discovery of pending submissions. */
export async function listForModeration({ page = 1, limit = 20, status = CONTENT_STATUS.PENDING_REVIEW }) {
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Quiz.find(filter)
      .sort({ updatedAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('creator', 'name email')
      .lean(),
    Quiz.countDocuments(filter),
  ]);
  return { items, total };
}

export default {
  createQuiz,
  updateQuiz,
  duplicateQuiz,
  submitForReview,
  deleteQuiz,
  listPublished,
  listMine,
  getForPlay,
  getWithSolutions,
  listForModeration,
};
