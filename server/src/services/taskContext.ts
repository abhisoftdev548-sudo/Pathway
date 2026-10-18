import { Enrollment } from '../models/Enrollment.js';
import { Task } from '../models/Task.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { User } from '../models/User.js';
import { forbidden, notFound } from '../utils/errors.js';
import { loadCurriculum, type CurriculumBundle } from './curriculum.js';
import { computeRoadmapProgress, type ProgressTask, type RoadmapProgress } from './progress.js';
import type { EnrollmentDocument } from '../models/Enrollment.js';

export interface TaskContext {
  task: NonNullable<CurriculumBundle['taskById'] extends Map<string, infer T> ? T : never>;
  enrollment: EnrollmentDocument;
  bundle: CurriculumBundle;
  progress: RoadmapProgress;
  progressTask: ProgressTask;
  userTimezone: string;
}

export async function getTaskContextForUser(userId: string, taskId: string): Promise<TaskContext> {
  const task = await Task.findOne({ _id: taskId, archivedAt: null });
  if (!task) throw notFound('Task not found');

  const enrollment = await Enrollment.findOne({ userId, roadmapId: task.roadmapId });
  if (!enrollment) throw forbidden('Enroll in this roadmap to open its tasks');

  const bundle = await loadCurriculum(task.roadmapId);
  if (!bundle || !bundle.taskById.has(String(task._id))) throw notFound('Task is not available');

  const [user, progressRecords] = await Promise.all([
    User.findById(userId).select('timezone').lean(),
    TaskProgress.find({ userId, roadmapId: task.roadmapId }),
  ]);
  const timeZone = user?.timezone ?? 'UTC';
  const progress = computeRoadmapProgress(bundle, progressRecords, timeZone);
  const progressTask = progress.tasks.find((item) => item.id === String(task._id));
  if (!progressTask) throw notFound('Task is not available');

  return {
    task: bundle.taskById.get(String(task._id))!,
    enrollment,
    bundle,
    progress,
    progressTask,
    userTimezone: timeZone,
  };
}

export function assertMutableEnrollment(enrollment: EnrollmentDocument): void {
  if (enrollment.status === 'archived') {
    throw forbidden('This enrollment is archived. Restore it before changing progress.');
  }
}
