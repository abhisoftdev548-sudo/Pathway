import * as adminService from '../services/adminService.js';
import * as auditService from '../services/auditService.js';
import * as walletService from '../services/walletService.js';
import Category from '../models/Category.js';
import Tag from '../models/Tag.js';
import Notification from '../models/Notification.js';
import { sendSuccess, parsePagination, paginationMeta } from '../utils/responses.js';
import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { uniqueSlug } from '../utils/crypto.js';

// ── Overview & analytics ─────────────────────────────────────────────────────

export const overview = asyncHandler(async (_req, res) => {
  const metrics = await adminService.getOverviewMetrics();
  return sendSuccess(res, metrics);
});

export const analytics = asyncHandler(async (_req, res) => {
  const data = await adminService.getPlatformAnalytics();
  return sendSuccess(res, data);
});

export const diagnostics = asyncHandler(async (_req, res) => {
  const data = await adminService.getDiagnostics();
  return sendSuccess(res, data);
});

// ── Moderation ───────────────────────────────────────────────────────────────

export const moderate = asyncHandler(async (req, res) => {
  const { targetType } = req.params;
  const { action, notes, qualityRating } = req.body;
  const doc = await adminService.moderateContent({
    targetType: targetType.toUpperCase(),
    targetId: req.params.id,
    action,
    notes,
    qualityRating,
    admin: req.user,
    req,
  });
  return sendSuccess(res, { id: String(doc._id), status: doc.status, moderation: doc.moderation });
});

export const moderationHistory = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await adminService.listModerationHistory({
    page,
    limit,
    targetType: req.query.targetType,
  });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const qualityRatings = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await adminService.listQualityRatings({ page, limit });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

// ── Users ────────────────────────────────────────────────────────────────────

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const q = req.validatedQuery ?? req.query;
  const result = await adminService.listUsers({
    page,
    limit,
    search: q.search,
    role: q.role,
    status: q.status,
    sort: q.sort,
  });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const getUserDetail = asyncHandler(async (req, res) => {
  const result = await adminService.getUserDetail(req.params.id);
  return sendSuccess(res, result);
});

export const manageUser = asyncHandler(async (req, res) => {
  const result = await adminService.manageUser({
    admin: req.user,
    targetUserId: req.params.id,
    ...req.body,
    req,
  });
  return sendSuccess(res, result);
});

// ── QCoin administration ─────────────────────────────────────────────────────

export const ledger = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const q = req.validatedQuery ?? req.query;
  const result = await adminService.listLedger({
    page,
    limit,
    userId: q.userId,
    type: q.type,
    minAmount: q.minAmount ? Number(q.minAmount) : undefined,
  });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const suspiciousTransactions = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await adminService.findSuspiciousTransactions({ page, limit });
  return sendSuccess(res, result.items, paginationMeta({ page, limit, total: result.total }));
});

export const refundRequests = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await adminService.listRefundRequests({ page, limit });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const processRefund = asyncHandler(async (req, res) => {
  const result = await adminService.processRefund({
    admin: req.user,
    kind: req.params.kind.toUpperCase(),
    id: req.params.id,
    approve: req.body.approve,
    reason: req.body.reason,
    req,
  });
  return sendSuccess(res, result);
});

export const reconcileUser = asyncHandler(async (req, res) => {
  const result = await walletService.reconcileWallet(req.params.id);
  return sendSuccess(res, result);
});

// ── Reports ──────────────────────────────────────────────────────────────────

export const reports = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await adminService.listReports({
    page,
    limit,
    status: req.query.status,
    targetType: req.query.targetType,
  });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const resolveReport = asyncHandler(async (req, res) => {
  const report = await adminService.resolveReport({
    admin: req.user,
    reportId: req.params.id,
    status: req.body.status,
    resolution: req.body.resolution,
    req,
  });
  return sendSuccess(res, { report });
});

// ── Categories & tags ────────────────────────────────────────────────────────

export const listCategories = asyncHandler(async (_req, res) => {
  const [categories, tags] = await Promise.all([
    Category.find({}).sort({ name: 1 }).lean(),
    Tag.find({}).sort({ usageCount: -1, name: 1 }).limit(200).lean(),
  ]);
  return sendSuccess(res, { categories, tags });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create({
    name: req.body.name,
    slug: uniqueSlug(req.body.name),
    description: req.body.description ?? '',
    parent: req.body.parent ?? null,
    createdBy: req.user._id,
  });
  return sendSuccess(res, { category }, undefined, 201);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { $set: { name: req.body.name, description: req.body.description, isActive: req.body.isActive, parent: req.body.parent ?? null } },
    { new: true }
  );
  if (!category) throw ApiError.notFound('Category not found');
  return sendSuccess(res, { category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');
  return sendSuccess(res, { deleted: true });
});

export const createTag = asyncHandler(async (req, res) => {
  const tag = await Tag.create({
    name: req.body.name,
    slug: uniqueSlug(req.body.name),
    createdBy: req.user._id,
  });
  return sendSuccess(res, { tag }, undefined, 201);
});

export const updateTag = asyncHandler(async (req, res) => {
  const tag = await Tag.findByIdAndUpdate(
    req.params.id,
    { $set: { name: req.body.name, isActive: req.body.isActive } },
    { new: true }
  );
  if (!tag) throw ApiError.notFound('Tag not found');
  return sendSuccess(res, { tag });
});

export const deleteTag = asyncHandler(async (req, res) => {
  const tag = await Tag.findByIdAndDelete(req.params.id);
  if (!tag) throw ApiError.notFound('Tag not found');
  return sendSuccess(res, { deleted: true });
});

// ── Settings, notifications, audit ───────────────────────────────────────────

export const getSettings = asyncHandler(async (_req, res) => {
  const result = await adminService.listSettings();
  return sendSuccess(res, result);
});

export const updateSetting = asyncHandler(async (req, res) => {
  const doc = await adminService.upsertSetting({ admin: req.user, ...req.body, req });
  return sendSuccess(res, { setting: doc });
});

export const broadcastNotification = asyncHandler(async (req, res) => {
  const { title, body, link, userRole } = req.body;
  const User = (await import('../models/User.js')).default;
  const filter = userRole ? { role: userRole } : {};
  const users = await User.find(filter).select('_id').lean();

  const docs = users.map((u) => ({
    user: u._id,
    type: 'SYSTEM',
    title,
    body: body ?? '',
    link: link ?? '',
    metadata: { broadcast: true, by: String(req.user._id) },
  }));
  if (docs.length > 0) await Notification.insertMany(docs);

  const { audit } = await import('../services/auditService.js');
  await audit({
    actor: req.user._id,
    action: 'NOTIFICATION_BROADCAST',
    targetType: 'NOTIFICATION',
    details: { title, recipientCount: docs.length, userRole: userRole ?? 'ALL' },
    req,
  });

  return sendSuccess(res, { delivered: docs.length });
});

export const listNotificationTemplates = asyncHandler(async (_req, res) => {
  const result = await adminService.getSetting('notification_templates', []);
  return sendSuccess(res, { items: result });
});

export const saveNotificationTemplate = asyncHandler(async (req, res) => {
  const current = await adminService.getSetting('notification_templates', []);
  const templates = Array.isArray(current) ? [...current] : [];
  const idx = templates.findIndex((t) => t.key === req.body.key);
  const template = { key: req.body.key, title: req.body.title, body: req.body.body, link: req.body.link ?? '' };
  if (idx >= 0) templates[idx] = template;
  else templates.push(template);
  await adminService.upsertSetting({
    admin: req.user,
    key: 'notification_templates',
    value: templates,
    description: 'Reusable notification templates',
    req,
  });
  return sendSuccess(res, { items: templates });
});

export const auditLogs = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await auditService.listAuditLogs({
    page,
    limit,
    action: req.query.action,
    actor: req.query.actor,
  });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});
