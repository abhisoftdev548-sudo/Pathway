import { Router } from 'express';
import * as quizController from '../controllers/quizController.js';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import {
  quizInput,
  quizUpdateSchema,
  quizListQuery,
  submitQuizSchema,
  attemptSubmitSchema,
  attemptActionParam,
} from '../validators/quiz.js';
import { paginationQuery, idParam } from '../validators/common.js';
import { z } from 'zod';

const router = Router();

// Discovery (public + optional auth for "my attempts" context)
router.get('/', optionalAuthenticate, validate({ query: quizListQuery }), quizController.listPublished);
router.get('/mine', authenticate, validate({ query: quizListQuery }), quizController.listMine);
router.get(
  '/moderation',
  authenticate,
  authorize('ADMIN'),
  validate({ query: paginationQuery.extend({ status: z.string().optional() }) }),
  quizController.listForModeration
);
router.get('/:slugOrId', optionalAuthenticate, quizController.getForPlay);
router.get('/:id/detail', authenticate, validate({ params: idParam }), quizController.getMineDetail);
router.get('/:id/versions', authenticate, validate({ params: idParam }), quizController.myVersions);

router.post('/', authenticate, writeLimiter, validate({ body: quizInput }), quizController.create);
router.patch('/:id', authenticate, validate({ params: idParam, body: quizUpdateSchema }), quizController.update);
router.delete('/:id', authenticate, validate({ params: idParam }), quizController.remove);
router.post('/:id/duplicate', authenticate, validate({ params: idParam }), quizController.duplicate);
router.post(
  '/:id/submit',
  authenticate,
  validate({ params: idParam, body: submitQuizSchema }),
  quizController.submitForReview
);

// Attempts
router.post('/:id/attempts', authenticate, validate({ params: idParam }), quizController.startAttempt);
router.post(
  '/attempts/:attemptId/submit',
  authenticate,
  validate({ params: attemptActionParam, body: attemptSubmitSchema }),
  quizController.submitAttempt
);
router.get('/attempts/:attemptId', authenticate, validate({ params: attemptActionParam }), quizController.getAttempt);

export default router;
