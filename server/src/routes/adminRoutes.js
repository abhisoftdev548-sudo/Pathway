import { Router } from 'express';
import { z } from 'zod';
import * as adminController from '../controllers/adminController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  adminModerationSchema,
  adminUserActionSchema,
  adminRefundSchema,
  adminSettingSchema,
  adminQuery,
} from '../validators/social.js';
import { idParam, objectId, paginationQuery } from '../validators/common.js';

const router = Router();

// Everything below requires an authenticated admin.
router.use(authenticate, authorize('ADMIN'));

// Overview & analytics
router.get('/overview', adminController.overview);
router.get('/analytics', adminController.analytics);
router.get('/diagnostics', adminController.diagnostics);

// Moderation
router.post(
  '/moderate/:targetType/:id',
  validate({
    params: z.object({ targetType: z.enum(['quiz', 'poll', 'QUIZ', 'POLL']), id: objectId }),
    body: adminModerationSchema,
  }),
  adminController.moderate
);
router.get('/moderation/history', validate({ query: paginationQuery }), adminController.moderationHistory);
router.get('/quality-ratings', validate({ query: paginationQuery }), adminController.qualityRatings);

// Users
router.get('/users', validate({ query: adminQuery }), adminController.listUsers);
router.get('/users/:id', validate({ params: idParam }), adminController.getUserDetail);
router.post('/users/:id/manage', validate({ params: idParam, body: adminUserActionSchema }), adminController.manageUser);
router.get('/users/:id/reconcile', validate({ params: idParam }), adminController.reconcileUser);

// QCoin administration
router.get('/ledger', validate({ query: adminQuery }), adminController.ledger);
router.get('/suspicious-transactions', validate({ query: paginationQuery }), adminController.suspiciousTransactions);
router.get('/refunds', validate({ query: paginationQuery }), adminController.refundRequests);
router.post(
  '/refunds/:kind/:id',
  validate({
    params: z.object({ kind: z.enum(['quiz-attempt', 'poll-vote', 'QUIZ_ATTEMPT', 'POLL_VOTE']), id: objectId }),
    body: adminRefundSchema,
  }),
  adminController.processRefund
);

// Reports
router.get('/reports', validate({ query: adminQuery }), adminController.reports);
router.post(
  '/reports/:id/resolve',
  validate({
    params: idParam,
    body: z.object({
      status: z.enum(['UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
      resolution: z.string().max(1000).optional(),
    }),
  }),
  adminController.resolveReport
);

// Categories & tags
router.get('/categories', adminController.listCategories);
router.post(
  '/categories',
  validate({ body: z.object({ name: z.string().min(2).max(60), description: z.string().max(300).optional(), parent: objectId.nullable().optional() }) }),
  adminController.createCategory
);
router.patch('/categories/:id', validate({ params: idParam }), adminController.updateCategory);
router.delete('/categories/:id', validate({ params: idParam }), adminController.deleteCategory);
router.post('/tags', validate({ body: z.object({ name: z.string().min(1).max(40) }) }), adminController.createTag);
router.patch('/tags/:id', validate({ params: idParam }), adminController.updateTag);
router.delete('/tags/:id', validate({ params: idParam }), adminController.deleteTag);

// Settings & notifications
router.get('/settings', adminController.getSettings);
router.put('/settings', validate({ body: adminSettingSchema }), adminController.updateSetting);
router.post(
  '/notifications/broadcast',
  validate({
    body: z.object({
      title: z.string().min(3).max(160),
      body: z.string().max(1000).optional(),
      link: z.string().max(500).optional(),
      userRole: z.enum(['USER', 'ADMIN']).optional(),
    }),
  }),
  adminController.broadcastNotification
);
router.get('/notifications/templates', adminController.listNotificationTemplates);
router.post(
  '/notifications/templates',
  validate({
    body: z.object({
      key: z.string().min(2).max(80),
      title: z.string().min(3).max(160),
      body: z.string().max(1000).optional(),
      link: z.string().max(500).optional(),
    }),
  }),
  adminController.saveNotificationTemplate
);

// Audit
router.get('/audit-logs', validate({ query: adminQuery }), adminController.auditLogs);

export default router;
