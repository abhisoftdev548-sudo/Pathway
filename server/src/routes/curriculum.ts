import { Router } from 'express';
import { ModuleModel } from '../models/Module.js';
import { Roadmap } from '../models/Roadmap.js';
import { Task } from '../models/Task.js';
import { Topic } from '../models/Topic.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound } from '../utils/errors.js';
import { isValidObjectId } from '../utils/ids.js';
import { serializeTask } from '../services/curriculum.js';

export const curriculumRouter = Router();

async function findPublishedRoadmap(idOrSlug: string) {
  return Roadmap.findOne(
    isValidObjectId(idOrSlug)
      ? { _id: idOrSlug, published: true, archivedAt: null }
      : { slug: idOrSlug.toLowerCase(), published: true, archivedAt: null },
  );
}

curriculumRouter.get(
  '/roadmaps/:id/modules',
  asyncHandler(async (req, res) => {
    const roadmap = await findPublishedRoadmap(req.params.id);
    if (!roadmap) throw notFound('Roadmap not found');
    const modules = await ModuleModel.find({ roadmapId: roadmap._id, published: true, archivedAt: null }).sort({ order: 1 }).lean();
    const modulesWithCounts = await Promise.all(
      modules.map(async (module) => {
        const [topicCount, tasks] = await Promise.all([
          Topic.countDocuments({ moduleId: module._id, published: true, archivedAt: null }),
          Task.find({ moduleId: module._id, published: true, archivedAt: null }).select('estimatedDuration').lean(),
        ]);
        return {
          id: String(module._id),
          title: module.title,
          description: module.description,
          order: module.order,
          learningOutcomes: module.learningOutcomes,
          prerequisiteModuleIds: module.prerequisiteModuleIds,
          topicCount,
          taskCount: tasks.length,
          estimatedMinutes: tasks.reduce((sum, task) => sum + task.estimatedDuration, 0),
        };
      }),
    );
    res.json({ roadmap: { id: String(roadmap._id), title: roadmap.title, slug: roadmap.slug }, modules: modulesWithCounts });
  }),
);

curriculumRouter.get(
  '/modules/:id/topics',
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw notFound('Module not found');
    const module = await ModuleModel.findOne({ _id: req.params.id, published: true, archivedAt: null });
    if (!module) throw notFound('Module not found');
    const roadmap = await Roadmap.findOne({ _id: module.roadmapId, published: true, archivedAt: null });
    if (!roadmap) throw notFound('Module not found');
    const topics = await Topic.find({ moduleId: module._id, published: true, archivedAt: null }).sort({ order: 1 }).lean();
    const topicsWithCounts = await Promise.all(
      topics.map(async (topic) => {
        const tasks = await Task.find({ topicId: topic._id, published: true, archivedAt: null }).select('estimatedDuration').lean();
        return {
          id: String(topic._id),
          title: topic.title,
          description: topic.description,
          order: topic.order,
          estimatedDuration: topic.estimatedDuration,
          learningOutcomes: topic.learningOutcomes,
          resources: topic.resources,
          taskCount: tasks.length,
          estimatedMinutes: tasks.reduce((sum, task) => sum + task.estimatedDuration, 0),
        };
      }),
    );
    res.json({
      module: {
        id: String(module._id),
        title: module.title,
        description: module.description,
        order: module.order,
        learningOutcomes: module.learningOutcomes,
      },
      roadmap: { id: String(roadmap._id), slug: roadmap.slug, title: roadmap.title },
      topics: topicsWithCounts,
    });
  }),
);

curriculumRouter.get(
  '/topics/:id/tasks',
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw notFound('Topic not found');
    const topic = await Topic.findOne({ _id: req.params.id, published: true, archivedAt: null });
    if (!topic) throw notFound('Topic not found');
    const module = await ModuleModel.findOne({ _id: topic.moduleId, published: true, archivedAt: null });
    if (!module) throw notFound('Topic not found');
    const roadmap = await Roadmap.findOne({ _id: topic.roadmapId, published: true, archivedAt: null });
    if (!roadmap) throw notFound('Topic not found');
    const tasks = await Task.find({ topicId: topic._id, published: true, archivedAt: null }).sort({ order: 1 });
    res.json({
      topic: {
        id: String(topic._id),
        title: topic.title,
        description: topic.description,
        estimatedDuration: topic.estimatedDuration,
        learningOutcomes: topic.learningOutcomes,
        resources: topic.resources,
      },
      module: { id: String(module._id), title: module.title, order: module.order },
      roadmap: { id: String(roadmap._id), slug: roadmap.slug, title: roadmap.title },
      tasks: tasks.map((task) => serializeTask(task)),
    });
  }),
);
