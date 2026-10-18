import { Enrollment, type EnrollmentDocument } from '../models/Enrollment.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { Roadmap } from '../models/Roadmap.js';
import type { CurriculumBundle } from './curriculum.js';
import { computeRoadmapProgress, ensureProgressRecords, type RoadmapProgress } from './progress.js';

export interface EnrollmentContext {
  enrollment: EnrollmentDocument;
  bundle: CurriculumBundle;
  progress: RoadmapProgress;
}

export async function getEnrollmentContexts(userId: string, timeZone: string): Promise<EnrollmentContext[]> {
  const enrollments = await Enrollment.find({ userId }).sort({ enrolledAt: 1 });
  if (enrollments.length === 0) return [];
  const roadmaps = await Roadmap.find({
    _id: { $in: enrollments.map((e) => e.roadmapId) },
    published: true,
    archivedAt: null,
  });
  const roadmapIds = new Set(roadmaps.map((r) => String(r._id)));
  const visibleEnrollments = enrollments.filter((enrollment) => roadmapIds.has(String(enrollment.roadmapId)));

  const progressRecords = await TaskProgress.find({ userId });
  const { loadCurriculum } = await import('./curriculum.js');
  const contexts: EnrollmentContext[] = [];

  for (const enrollment of visibleEnrollments) {
    const bundle = await loadCurriculum(enrollment.roadmapId);
    if (!bundle) continue;
    // Newly published tasks appear for existing enrollments without a re-enroll.
    await ensureProgressRecords(userId, enrollment, bundle.tasks);
    const progress = computeRoadmapProgress(bundle, progressRecords, timeZone);
    contexts.push({ enrollment, bundle, progress });
  }
  return contexts;
}

export function enrollmentStatusOf(context: EnrollmentContext): 'active' | 'paused' | 'completed' | 'archived' {
  return context.enrollment.status as 'active' | 'paused' | 'completed' | 'archived';
}

export function serializeRoadmapCard(context: EnrollmentContext) {
  const { enrollment, bundle, progress } = context;
  return {
    enrollmentId: String(enrollment._id),
    status: enrollment.status,
    learningPace: enrollment.learningPace,
    customDailyGoal: enrollment.customDailyGoal,
    paceMinutes:
      enrollment.learningPace === 'custom'
        ? enrollment.customDailyGoal ?? 30
        : { relaxed: 20, standard: 45, intensive: 90 }[enrollment.learningPace as 'relaxed' | 'standard' | 'intensive'] ?? 45,
    enrolledAt: enrollment.enrolledAt,
    completedAt: enrollment.completedAt,
    lastActivityAt: enrollment.lastActivityAt,
    percent: progress.percent,
    completedTasks: progress.completedTasks,
    totalTasks: progress.totalTasks,
    completedMinutes: progress.completedMinutes,
    totalMinutes: progress.totalMinutes,
    completedToday: progress.completedToday,
    nextTask: progress.nextTask
      ? {
          id: progress.nextTask.id,
          title: progress.nextTask.title,
          estimatedDuration: progress.nextTask.estimatedDuration,
          topicTitle: progress.nextTask.topicTitle,
          moduleTitle: progress.nextTask.moduleTitle,
        }
      : null,
    roadmap: {
      id: String(bundle.roadmap._id),
      title: bundle.roadmap.title,
      slug: bundle.roadmap.slug,
      category: bundle.roadmap.category,
      difficulty: bundle.roadmap.difficulty,
      difficultyLabel: bundle.roadmap.difficultyLabel || bundle.roadmap.difficulty,
      estimatedDuration: bundle.roadmap.estimatedDuration,
      moduleCount: bundle.modules.length,
      topicCount: bundle.topics.length,
    },
  };
}
