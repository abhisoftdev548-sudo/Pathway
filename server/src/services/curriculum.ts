import type { Types } from 'mongoose';
import { ModuleModel, type ModuleDocument } from '../models/Module.js';
import { Roadmap, type RoadmapDocument } from '../models/Roadmap.js';
import { Task, type TaskDocument } from '../models/Task.js';
import { Topic, type TopicDocument } from '../models/Topic.js';
import { TaskProgress } from '../models/TaskProgress.js';
import type { TaskType } from '../models/constants.js';

export interface CurriculumBundle {
  roadmap: RoadmapDocument;
  modules: ModuleDocument[];
  topics: TopicDocument[];
  tasks: TaskDocument[];
  moduleById: Map<string, ModuleDocument>;
  topicById: Map<string, TopicDocument>;
  taskById: Map<string, TaskDocument>;
  tasksByModule: Map<string, TaskDocument[]>;
  tasksByTopic: Map<string, TaskDocument[]>;
  topicsByModule: Map<string, TopicDocument[]>;
}

interface LoadOptions {
  includeUnpublished?: boolean;
}

/** Loads a roadmap's curriculum, excluding soft-deleted content. */
export async function loadCurriculum(
  roadmapId: string | Types.ObjectId,
  options: LoadOptions = {},
): Promise<CurriculumBundle | null> {
  const roadmap = await Roadmap.findOne({
    _id: roadmapId,
    ...(options.includeUnpublished ? {} : { published: true }),
    archivedAt: null,
  });
  if (!roadmap) return null;

  const publishedFilter = options.includeUnpublished ? {} : { published: true };
  const [modules, topics, tasks] = await Promise.all([
    ModuleModel.find({ roadmapId: roadmap._id, archivedAt: null, ...publishedFilter }).sort({ order: 1 }),
    Topic.find({ roadmapId: roadmap._id, archivedAt: null, ...publishedFilter }).sort({ order: 1 }),
    Task.find({ roadmapId: roadmap._id, archivedAt: null, ...publishedFilter }).sort({ order: 1 }),
  ]);

  const publishedModuleIds = new Set(modules.map((m) => String(m._id)));
  const publishedTopicIds = new Set(topics.map((t) => String(t._id)));
  const visibleTopics = topics.filter((t) => publishedModuleIds.has(String(t.moduleId)));
  const visibleTasks = tasks.filter(
    (t) => publishedTopicIds.has(String(t.topicId)) && publishedModuleIds.has(String(t.moduleId)),
  );

  const moduleById = new Map(visibleModuleIds(modules).map((m) => [String(m._id), m]));
  const topicById = new Map(visibleTopics.map((t) => [String(t._id), t]));
  const taskById = new Map(visibleTasks.map((t) => [String(t._id), t]));

  const tasksByModule = new Map<string, TaskDocument[]>();
  const tasksByTopic = new Map<string, TaskDocument[]>();
  const topicsByModule = new Map<string, TopicDocument[]>();

  for (const topic of visibleTopics) {
    const list = topicsByModule.get(String(topic.moduleId)) ?? [];
    list.push(topic);
    topicsByModule.set(String(topic.moduleId), list);
  }
  for (const task of visibleTasks) {
    const byTopic = tasksByTopic.get(String(task.topicId)) ?? [];
    byTopic.push(task);
    tasksByTopic.set(String(task.topicId), byTopic);
    const byModule = tasksByModule.get(String(task.moduleId)) ?? [];
    byModule.push(task);
    tasksByModule.set(String(task.moduleId), byModule);
  }

  return {
    roadmap,
    modules: [...moduleById.values()],
    topics: visibleTopics,
    tasks: visibleTasks,
    moduleById,
    topicById,
    taskById,
    tasksByModule,
    tasksByTopic,
    topicsByModule,
  };
}

function visibleModuleIds(modules: ModuleDocument[]): ModuleDocument[] {
  return modules;
}

export async function loadCurriculumsForRoadmaps(
  roadmapIds: (string | Types.ObjectId)[],
  options: LoadOptions = {},
): Promise<Map<string, CurriculumBundle>> {
  const unique = [...new Set(roadmapIds.map(String))];
  const result = new Map<string, CurriculumBundle>();
  await Promise.all(
    unique.map(async (id) => {
      const bundle = await loadCurriculum(id, options);
      if (bundle) result.set(id, bundle);
    }),
  );
  return result;
}

/** Public task shape: hides quiz answers and coding solutions. */
export function serializeTask(task: TaskDocument, options: { revealSolutions?: boolean } = {}) {
  const raw = task.toObject ? task.toObject() : task;
  const codingExercise = raw.codingExercise
    ? {
        problemStatement: raw.codingExercise.problemStatement,
        examples: raw.codingExercise.examples,
        constraints: raw.codingExercise.constraints,
        hints: raw.codingExercise.hints,
        starterCode: raw.codingExercise.starterCode,
        selfVerified: raw.codingExercise.selfVerified,
        ...(options.revealSolutions ? { solutionExplanation: raw.codingExercise.solutionExplanation } : {}),
      }
    : null;

  return {
    id: String(raw.id ?? raw._id),
    roadmapId: String(raw.roadmapId),
    moduleId: String(raw.moduleId),
    topicId: String(raw.topicId),
    title: raw.title,
    description: raw.description,
    type: raw.type as TaskType,
    difficulty: raw.difficulty,
    estimatedDuration: raw.estimatedDuration,
    learningObjectives: raw.learningObjectives,
    instructions: raw.instructions,
    acceptanceCriteria: raw.acceptanceCriteria,
    resources: raw.resources,
    published: raw.published,
    archivedAt: raw.archivedAt,
    order: raw.order,
    quizQuestions: (raw.quizQuestions ?? []).map((q: { question: string; options: string[] }) => ({
      question: q.question,
      options: q.options,
    })),
    hasQuiz: (raw.quizQuestions ?? []).length > 0,
    hasCodingExercise: Boolean(raw.codingExercise?.problemStatement),
    codingExercise,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export interface TaskWithProgress {
  id: string;
  roadmapId: string;
  moduleId: string;
  topicId: string;
  title: string;
  description: string;
  type: TaskType;
  difficulty: string;
  estimatedDuration: number;
  learningObjectives: string[];
  instructions: string;
  acceptanceCriteria: string[];
  resources: unknown[];
  order: number;
  moduleTitle: string;
  topicTitle: string;
  moduleOrder: number;
  topicOrder: number;
  published: boolean;
  status: 'not_started' | 'in_progress' | 'completed';
  locked: boolean;
  lockReason: string | null;
  prerequisiteIds: string[];
  completedAt: string | null;
  actualDuration: number;
  privateNotes: string;
  attemptCount: number;
  quizQuestions: { question: string; options: string[] }[];
  codingExercise: ReturnType<typeof serializeTask>['codingExercise'];
  hasCodingExercise: boolean;
}

export async function loadProgressByTask(userId: string, taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, Awaited<ReturnType<typeof TaskProgress.findOne>>>();
  const records = await TaskProgress.find({ userId, taskId: { $in: taskIds } });
  return new Map(records.map((record) => [String(record.taskId), record]));
}
