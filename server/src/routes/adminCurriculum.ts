import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { requireValidObjectIdParam, validate } from '../middleware/validate.js';
import { ModuleModel } from '../models/Module.js';
import { Roadmap } from '../models/Roadmap.js';
import { Task } from '../models/Task.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { Topic } from '../models/Topic.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { slugify } from '../utils/slug.js';
import {
  moduleCreateSchema,
  moduleUpdateSchema,
  moveSchema,
  taskCreateSchema,
  taskUpdateSchema,
  topicCreateSchema,
  topicUpdateSchema,
} from '../validation/admin.js';
import {
  countPublishedContent,
  loadFullCurriculum,
  serializeAdminTask,
  validateRoadmapContent,
} from '../services/adminContent.js';

export const adminCurriculumRouter = Router();
adminCurriculumRouter.use(requireAuth, requireAdmin);

const keyFor = (prefix: string) => `${prefix}-${crypto.randomBytes(5).toString('hex')}`;

async function getRoadmapOrThrow(roadmapId: string) {
  const roadmap = await Roadmap.findById(roadmapId);
  if (!roadmap) throw notFound('Roadmap not found');
  return roadmap;
}

async function touchRoadmap(roadmapId: unknown) {
  await Roadmap.updateOne({ _id: roadmapId }, { $inc: { version: 1 } });
}

async function assertModulePrereqs(roadmapId: unknown, ids: string[], selfId?: string) {
  if (ids.length === 0) return;
  if (selfId && ids.includes(selfId)) throw badRequest('A module cannot be its own prerequisite');
  const found = await ModuleModel.find({ _id: { $in: ids }, roadmapId }).select('_id');
  if (found.length !== new Set(ids).size) {
    throw badRequest('Module prerequisites must belong to the same roadmap');
  }
}

async function assertTopicPrereqs(roadmapId: unknown, ids: string[], selfId?: string) {
  if (ids.length === 0) return;
  if (selfId && ids.includes(selfId)) throw badRequest('A topic cannot be its own prerequisite');
  const found = await Topic.find({ _id: { $in: ids }, roadmapId }).select('_id');
  if (found.length !== new Set(ids).size) {
    throw badRequest('Topic prerequisites must belong to the same roadmap');
  }
}

async function assertTaskPrereqs(roadmapId: unknown, ids: string[], selfId?: string) {
  if (ids.length === 0) return;
  if (selfId && ids.includes(selfId)) throw badRequest('A task cannot be its own prerequisite');
  const found = await Task.find({ _id: { $in: ids }, roadmapId }).select('_id');
  if (found.length !== new Set(ids).size) {
    throw badRequest('Task prerequisites must belong to the same roadmap');
  }
}

async function ownedModule(moduleId: string) {
  const module = await ModuleModel.findById(moduleId);
  if (!module) throw notFound('Module not found');
  return module;
}

async function ownedTopic(topicId: string) {
  const topic = await Topic.findById(topicId);
  if (!topic) throw notFound('Topic not found');
  return topic;
}

async function ownedTask(taskId: string) {
  const task = await Task.findById(taskId);
  if (!task) throw notFound('Task not found');
  return task;
}

adminCurriculumRouter.get(
  '/roadmaps/:roadmapId/curriculum',
  requireValidObjectIdParam('roadmapId'),
  asyncHandler(async (req, res) => {
    const roadmap = await getRoadmapOrThrow(req.params.roadmapId);
    const [curriculum, validation, publishedCounts] = await Promise.all([
      loadFullCurriculum(String(roadmap._id)),
      validateRoadmapContent(roadmap),
      countPublishedContent(String(roadmap._id)),
    ]);
    res.json({ ...curriculum, validation, publishedCounts });
  }),
);

adminCurriculumRouter.get(
  '/roadmaps/:roadmapId/preview',
  requireValidObjectIdParam('roadmapId'),
  asyncHandler(async (req, res) => {
    const roadmap = await getRoadmapOrThrow(req.params.roadmapId);
    const [curriculum, validation, publishedCounts] = await Promise.all([
      loadFullCurriculum(String(roadmap._id)),
      validateRoadmapContent(roadmap, { includeInfo: true }),
      countPublishedContent(String(roadmap._id)),
    ]);
    res.json({
      ...curriculum,
      validation,
      publishedCounts,
      preview: true,
      notice: 'Admin preview includes unpublished and archived content. Learners only see published, non-archived items.',
    });
  }),
);

adminCurriculumRouter.post(
  '/roadmaps/:roadmapId/modules',
  requireValidObjectIdParam('roadmapId'),
  validate(moduleCreateSchema),
  asyncHandler(async (req, res) => {
    const roadmap = await getRoadmapOrThrow(req.params.roadmapId);
    const body = req.body as z.infer<typeof moduleCreateSchema>;
    await assertModulePrereqs(roadmap._id, body.prerequisiteModuleIds);
    const last = await ModuleModel.findOne({ roadmapId: roadmap._id, archivedAt: null }).sort({ order: -1 }).select('order');
    const module = await ModuleModel.create({
      roadmapId: roadmap._id,
      key: keyFor('module'),
      title: body.title,
      description: body.description,
      learningOutcomes: body.learningOutcomes,
      prerequisiteModuleIds: body.prerequisiteModuleIds,
      published: body.published,
      order: (last?.order ?? 0) + 1,
    });
    await touchRoadmap(roadmap._id);
    res.status(201).json({ module, message: 'Module added' });
  }),
);

adminCurriculumRouter.patch(
  '/modules/:moduleId',
  requireValidObjectIdParam('moduleId'),
  validate(moduleUpdateSchema),
  asyncHandler(async (req, res) => {
    const module = await ownedModule(req.params.moduleId);
    const body = req.body as z.infer<typeof moduleUpdateSchema>;
    if (body.prerequisiteModuleIds) {
      await assertModulePrereqs(module.roadmapId, body.prerequisiteModuleIds, String(module._id));
    }
    Object.assign(module, body);
    await module.save();
    await touchRoadmap(module.roadmapId);
    res.json({ module, message: 'Module updated' });
  }),
);

adminCurriculumRouter.post(
  '/modules/:moduleId/move',
  requireValidObjectIdParam('moduleId'),
  validate(moveSchema),
  asyncHandler(async (req, res) => {
    const module = await ownedModule(req.params.moduleId);
    const siblings = await ModuleModel.find({ roadmapId: module.roadmapId, archivedAt: null }).sort({ order: 1, _id: 1 });
    const index = siblings.findIndex((item) => String(item._id) === String(module._id));
    const targetIndex = req.body.direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      throw badRequest(req.body.direction === 'up' ? 'Module is already first' : 'Module is already last');
    }
    const other = siblings[targetIndex];
    const currentOrder = module.order;
    module.order = other.order;
    other.order = currentOrder;
    await module.save();
    await other.save();
    await touchRoadmap(module.roadmapId);
    res.json({ message: 'Module reordered' });
  }),
);

adminCurriculumRouter.delete(
  '/modules/:moduleId',
  requireValidObjectIdParam('moduleId'),
  asyncHandler(async (req, res) => {
    const module = await ownedModule(req.params.moduleId);
    if (module.archivedAt) {
      res.json({ message: 'Module is already archived' });
      return;
    }
    module.archivedAt = new Date();
    module.published = false;
    await module.save();
    await touchRoadmap(module.roadmapId);
    res.json({
      message: 'Module archived (safe delete). Topics and tasks underneath are hidden from learners; completion history is preserved.',
    });
  }),
);

adminCurriculumRouter.post(
  '/modules/:moduleId/restore',
  requireValidObjectIdParam('moduleId'),
  asyncHandler(async (req, res) => {
    const module = await ownedModule(req.params.moduleId);
    module.archivedAt = null;
    module.published = false;
    await module.save();
    await touchRoadmap(module.roadmapId);
    res.json({ module, message: 'Module restored as unpublished. Review its content and publish when ready.' });
  }),
);

adminCurriculumRouter.post(
  '/modules/:moduleId/topics',
  requireValidObjectIdParam('moduleId'),
  validate(topicCreateSchema),
  asyncHandler(async (req, res) => {
    const module = await ownedModule(req.params.moduleId);
    if (module.archivedAt) throw badRequest('Restore the module before adding topics');
    const body = req.body as z.infer<typeof topicCreateSchema>;
    await assertTopicPrereqs(module.roadmapId, body.prerequisites);
    const last = await Topic.findOne({ moduleId: module._id, archivedAt: null }).sort({ order: -1 }).select('order');
    const topic = await Topic.create({
      roadmapId: module.roadmapId,
      moduleId: module._id,
      key: keyFor('topic'),
      title: body.title,
      description: body.description,
      estimatedDuration: body.estimatedDuration,
      learningOutcomes: body.learningOutcomes,
      prerequisites: body.prerequisites,
      resources: body.resources,
      published: body.published,
      order: (last?.order ?? 0) + 1,
    });
    await touchRoadmap(module.roadmapId);
    res.status(201).json({ topic, message: 'Topic added' });
  }),
);

adminCurriculumRouter.patch(
  '/topics/:topicId',
  requireValidObjectIdParam('topicId'),
  validate(topicUpdateSchema),
  asyncHandler(async (req, res) => {
    const topic = await ownedTopic(req.params.topicId);
    const body = req.body as z.infer<typeof topicUpdateSchema>;
    if (body.prerequisites) await assertTopicPrereqs(topic.roadmapId, body.prerequisites, String(topic._id));
    Object.assign(topic, body);
    await topic.save();
    await touchRoadmap(topic.roadmapId);
    res.json({ topic, message: 'Topic updated' });
  }),
);

adminCurriculumRouter.post(
  '/topics/:topicId/move',
  requireValidObjectIdParam('topicId'),
  validate(moveSchema),
  asyncHandler(async (req, res) => {
    const topic = await ownedTopic(req.params.topicId);
    const siblings = await Topic.find({ moduleId: topic.moduleId, archivedAt: null }).sort({ order: 1, _id: 1 });
    const index = siblings.findIndex((item) => String(item._id) === String(topic._id));
    const targetIndex = req.body.direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      throw badRequest(req.body.direction === 'up' ? 'Topic is already first' : 'Topic is already last');
    }
    const other = siblings[targetIndex];
    const currentOrder = topic.order;
    topic.order = other.order;
    other.order = currentOrder;
    await topic.save();
    await other.save();
    await touchRoadmap(topic.roadmapId);
    res.json({ message: 'Topic reordered' });
  }),
);

adminCurriculumRouter.delete(
  '/topics/:topicId',
  requireValidObjectIdParam('topicId'),
  asyncHandler(async (req, res) => {
    const topic = await ownedTopic(req.params.topicId);
    if (topic.archivedAt) {
      res.json({ message: 'Topic is already archived' });
      return;
    }
    topic.archivedAt = new Date();
    topic.published = false;
    await topic.save();
    await touchRoadmap(topic.roadmapId);
    res.json({ message: 'Topic archived (safe delete). Task completion history is preserved.' });
  }),
);

adminCurriculumRouter.post(
  '/topics/:topicId/restore',
  requireValidObjectIdParam('topicId'),
  asyncHandler(async (req, res) => {
    const topic = await ownedTopic(req.params.topicId);
    topic.archivedAt = null;
    topic.published = false;
    await topic.save();
    await touchRoadmap(topic.roadmapId);
    res.json({ topic, message: 'Topic restored as unpublished' });
  }),
);

adminCurriculumRouter.post(
  '/topics/:topicId/tasks',
  requireValidObjectIdParam('topicId'),
  validate(taskCreateSchema),
  asyncHandler(async (req, res) => {
    const topic = await ownedTopic(req.params.topicId);
    if (topic.archivedAt) throw badRequest('Restore the topic before adding tasks');
    const body = req.body as z.infer<typeof taskCreateSchema>;
    await assertTaskPrereqs(topic.roadmapId, body.prerequisites);
    const last = await Task.findOne({ topicId: topic._id, archivedAt: null }).sort({ order: -1 }).select('order');
    const task = await Task.create({
      roadmapId: topic.roadmapId,
      moduleId: topic.moduleId,
      topicId: topic._id,
      key: keyFor('task'),
      title: body.title,
      description: body.description,
      type: body.type,
      difficulty: body.difficulty,
      estimatedDuration: body.estimatedDuration,
      learningObjectives: body.learningObjectives,
      instructions: body.instructions,
      acceptanceCriteria: body.acceptanceCriteria,
      resources: body.resources,
      prerequisites: body.prerequisites,
      quizQuestions: body.quizQuestions,
      codingExercise: body.codingExercise,
      published: body.published,
      order: (last?.order ?? 0) + 1,
    });
    await touchRoadmap(topic.roadmapId);
    res.status(201).json({
      task: serializeAdminTask(task),
      message: 'Task created. Published tasks become available to existing enrollments immediately; completed progress is untouched.',
    });
  }),
);

adminCurriculumRouter.get(
  '/tasks/:taskId',
  requireValidObjectIdParam('taskId'),
  asyncHandler(async (req, res) => {
    const task = await ownedTask(req.params.taskId);
    res.json({ task: serializeAdminTask(task) });
  }),
);

adminCurriculumRouter.patch(
  '/tasks/:taskId',
  requireValidObjectIdParam('taskId'),
  validate(taskUpdateSchema),
  asyncHandler(async (req, res) => {
    const task = await ownedTask(req.params.taskId);
    const body = req.body as z.infer<typeof taskUpdateSchema>;
    if (body.prerequisites !== undefined) {
      await assertTaskPrereqs(task.roadmapId, body.prerequisites, String(task._id));
    }
    Object.assign(task, body);
    await task.save();
    await touchRoadmap(task.roadmapId);
    res.json({ task: serializeAdminTask(task), message: 'Task updated' });
  }),
);

adminCurriculumRouter.post(
  '/tasks/:taskId/publish',
  requireValidObjectIdParam('taskId'),
  asyncHandler(async (req, res) => {
    const task = await ownedTask(req.params.taskId);
    if (task.archivedAt) throw badRequest('Restore the task before publishing');
    const problems: { path: string; message: string }[] = [];
    if (!task.description) problems.push({ path: 'description', message: 'Add a description' });
    if (!task.instructions) problems.push({ path: 'instructions', message: 'Add instructions' });
    if (task.acceptanceCriteria.length === 0) problems.push({ path: 'acceptanceCriteria', message: 'Add acceptance criteria' });
    if (task.type === 'quiz' && task.quizQuestions.length === 0) problems.push({ path: 'quizQuestions', message: 'Add quiz questions' });
    if (problems.length > 0) throw badRequest('This task is not ready to publish', problems);
    task.published = true;
    await task.save();
    await touchRoadmap(task.roadmapId);
    res.json({ task: serializeAdminTask(task), message: 'Task published. Existing learners will see it without losing progress.' });
  }),
);

adminCurriculumRouter.post(
  '/tasks/:taskId/unpublish',
  requireValidObjectIdParam('taskId'),
  asyncHandler(async (req, res) => {
    const task = await ownedTask(req.params.taskId);
    task.published = false;
    await task.save();
    await touchRoadmap(task.roadmapId);
    res.json({
      task: serializeAdminTask(task),
      message: 'Task unpublished. It is excluded from progress calculations; completion history is retained.',
    });
  }),
);

adminCurriculumRouter.post(
  '/tasks/:taskId/restore',
  requireValidObjectIdParam('taskId'),
  asyncHandler(async (req, res) => {
    const task = await ownedTask(req.params.taskId);
    task.archivedAt = null;
    task.published = false;
    await task.save();
    await touchRoadmap(task.roadmapId);
    res.json({ task: serializeAdminTask(task), message: 'Task restored as unpublished' });
  }),
);

adminCurriculumRouter.post(
  '/tasks/:taskId/move',
  requireValidObjectIdParam('taskId'),
  validate(moveSchema),
  asyncHandler(async (req, res) => {
    const task = await ownedTask(req.params.taskId);
    const siblings = await Task.find({ topicId: task.topicId, archivedAt: null }).sort({ order: 1, _id: 1 });
    const index = siblings.findIndex((item) => String(item._id) === String(task._id));
    const targetIndex = req.body.direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      throw badRequest(req.body.direction === 'up' ? 'Task is already first' : 'Task is already last');
    }
    const other = siblings[targetIndex];
    const currentOrder = task.order;
    task.order = other.order;
    other.order = currentOrder;
    await task.save();
    await other.save();
    await touchRoadmap(task.roadmapId);
    res.json({ message: 'Task reordered' });
  }),
);

adminCurriculumRouter.delete(
  '/tasks/:taskId',
  requireValidObjectIdParam('taskId'),
  asyncHandler(async (req, res) => {
    const task = await ownedTask(req.params.taskId);
    if (task.archivedAt) {
      res.json({ message: 'Task is already archived' });
      return;
    }
    task.archivedAt = new Date();
    task.published = false;
    await task.save();
    await touchRoadmap(task.roadmapId);
    const preservedProgress = await TaskProgress.countDocuments({ taskId: task._id });
    res.json({
      message: 'Task archived (safe delete). It is excluded from progress denominators.',
      preservedProgressRecords: preservedProgress,
    });
  }),
);

adminCurriculumRouter.post(
  '/roadmaps/:roadmapId/slug-preview',
  requireValidObjectIdParam('roadmapId'),
  asyncHandler(async (req, res) => {
    const roadmap = await getRoadmapOrThrow(req.params.roadmapId);
    res.json({ slug: `${roadmap.slug}-${crypto.randomBytes(2).toString('hex')}` });
  }),
);

// Keeps slugify imported for future admin utilities without affecting behavior.
void slugify;
