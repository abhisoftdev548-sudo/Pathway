import { Router } from 'express';
import { z } from 'zod';
import * as pollController from '../controllers/pollController.js';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { pollInput, pollUpdateSchema, pollListQuery, pollVoteSchema } from '../validators/poll.js';
import { idParam, paginationQuery } from '../validators/common.js';

const router = Router();

router.get('/', optionalAuthenticate, validate({ query: pollListQuery }), pollController.listPublished);
router.get('/mine', authenticate, validate({ query: pollListQuery }), pollController.listMine);
router.get(
  '/moderation',
  authenticate,
  authorize('ADMIN'),
  validate({ query: paginationQuery.extend({ status: z.string().optional() }) }),
  pollController.listForModeration
);
router.get('/:slugOrId', optionalAuthenticate, pollController.getDetail);

router.post('/', authenticate, writeLimiter, validate({ body: pollInput }), pollController.create);
router.patch('/:id', authenticate, validate({ params: idParam, body: pollUpdateSchema }), pollController.update);
router.delete('/:id', authenticate, validate({ params: idParam }), pollController.remove);
router.post(
  '/:id/submit',
  authenticate,
  validate({ params: idParam, body: z.object({ changeNote: z.string().max(500).optional() }) }),
  pollController.submitForReview
);
router.post('/:id/vote', authenticate, validate({ params: idParam, body: pollVoteSchema }), pollController.vote);

export default router;
