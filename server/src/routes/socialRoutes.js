import { Router } from 'express';
import * as ratingController from '../controllers/ratingController.js';
import * as reportController from '../controllers/reportController.js';
import * as notificationController from '../controllers/notificationController.js';
import * as walletController from '../controllers/walletController.js';
import * as leaderboardController from '../controllers/leaderboardController.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ratingSchema, reportSchema, notificationListQuery, walletQuery, leaderboardQuery } from '../validators/social.js';
import { paginationQuery, idParam } from '../validators/common.js';
import { z } from 'zod';

const router = Router();

// Ratings
router.post('/ratings', authenticate, validate({ body: ratingSchema }), ratingController.create);
router.get(
  '/ratings/:targetType/:targetId',
  optionalAuthenticate,
  validate({
    params: z.object({ targetType: z.enum(['QUIZ', 'POLL']), targetId: z.string().regex(/^[0-9a-fA-F]{24}$/) }),
    query: paginationQuery,
  }),
  ratingController.listForTarget
);
router.get('/ratings/creator/feedback', authenticate, validate({ query: paginationQuery }), ratingController.creatorFeedback);
router.get('/reputation/:userId', ratingController.creatorReputation);

// Reports
router.post('/reports', authenticate, validate({ body: reportSchema }), reportController.create);
router.get('/reports/mine', authenticate, validate({ query: paginationQuery }), reportController.myReports);

// Notifications
router.get('/notifications', authenticate, validate({ query: notificationListQuery }), notificationController.list);
router.post('/notifications/:id/read', authenticate, validate({ params: idParam }), notificationController.markRead);
router.post('/notifications/read-all', authenticate, notificationController.markAllRead);

// Wallet
router.get('/wallet', authenticate, walletController.getWallet);
router.get('/wallet/transactions', authenticate, validate({ query: walletQuery }), walletController.getTransactions);
router.get('/wallet/rewards', authenticate, validate({ query: paginationQuery }), walletController.getRewards);
router.get('/wallet/policy', walletController.getWalletPolicy);

// Leaderboards (public)
router.get('/leaderboards/performance', validate({ query: leaderboardQuery }), leaderboardController.performance);
router.get('/leaderboards/consistency', validate({ query: leaderboardQuery }), leaderboardController.consistency);
router.get('/leaderboards/creators', validate({ query: leaderboardQuery }), leaderboardController.creators);

export default router;
