import { ModuleModel } from '../models/Module.js';
import { Task } from '../models/Task.js';
import { Topic } from '../models/Topic.js';

export interface RoadmapStats {
  moduleCount: number;
  topicCount: number;
  taskCount: number;
  totalMinutes: number;
  estimatedHours: number;
}

/** Aggregates published curriculum counts for a set of roadmaps. */
export async function getRoadmapStats(roadmapIds: string[]): Promise<Map<string, RoadmapStats>> {
  const stats = new Map<string, RoadmapStats>();
  if (roadmapIds.length === 0) return stats;
  const ids = roadmapIds.map((id) => id);

  const [modules, topics, tasks] = await Promise.all([
    ModuleModel.find({ roadmapId: { $in: ids }, published: true, archivedAt: null }).select('_id roadmapId').lean(),
    Topic.find({ roadmapId: { $in: ids }, published: true, archivedAt: null }).select('_id roadmapId moduleId').lean(),
    Task.find({ roadmapId: { $in: ids }, published: true, archivedAt: null })
      .select('roadmapId moduleId topicId estimatedDuration')
      .lean(),
  ]);

  const moduleRoadmap = new Map(modules.map((m) => [String(m._id), String(m.roadmapId)]));
  const topicInfo = new Map<string, { roadmapId: string; moduleId: string; valid: boolean }>();
  for (const topic of topics) {
    const moduleId = String(topic.moduleId);
    if (!moduleRoadmap.has(moduleId)) continue;
    topicInfo.set(String(topic._id), {
      roadmapId: String(topic.roadmapId),
      moduleId,
      valid: true,
    });
  }

  for (const id of ids) {
    stats.set(id, { moduleCount: 0, topicCount: 0, taskCount: 0, totalMinutes: 0, estimatedHours: 0 });
  }
  for (const module of modules) {
    const entry = stats.get(String(module.roadmapId));
    if (entry) entry.moduleCount += 1;
  }
  for (const topic of topics) {
    const info = topicInfo.get(String(topic._id));
    const entry = info ? stats.get(info.roadmapId) : undefined;
    if (entry) entry.topicCount += 1;
  }
  for (const task of tasks) {
    const moduleId = String(task.moduleId);
    const roadmapId = moduleRoadmap.get(moduleId);
    if (!roadmapId) continue;
    const topic = topicInfo.get(String(task.topicId));
    if (!topic || topic.moduleId !== moduleId) continue;
    const entry = stats.get(roadmapId);
    if (entry) {
      entry.taskCount += 1;
      entry.totalMinutes += task.estimatedDuration;
    }
  }
  for (const entry of stats.values()) {
    entry.estimatedHours = Math.round((entry.totalMinutes / 60) * 10) / 10;
  }
  return stats;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
