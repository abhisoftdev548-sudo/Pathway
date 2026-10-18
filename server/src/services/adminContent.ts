import { ModuleModel } from '../models/Module.js';
import { Roadmap, type RoadmapDocument } from '../models/Roadmap.js';
import { Task } from '../models/Task.js';
import { Topic } from '../models/Topic.js';
import { loadCurriculum } from './curriculum.js';

export interface CurriculumIssue {
  severity: 'error' | 'warning' | 'info';
  roadmapId: string;
  roadmapTitle: string;
  entityType: 'roadmap' | 'module' | 'topic' | 'task';
  entityId: string;
  entityTitle: string;
  message: string;
}

export interface RoadmapValidationSummary {
  roadmapId: string;
  title: string;
  slug: string;
  published: boolean;
  moduleCount: number;
  topicCount: number;
  taskCount: number;
  publishedTaskCount: number;
  errors: number;
  warnings: number;
  issues: CurriculumIssue[];
}

export function serializeAdminTask(task: InstanceType<typeof Task>) {
  const raw = task.toObject();
  return {
    id: String((raw as { id?: unknown }).id ?? raw._id),
    roadmapId: String(raw.roadmapId),
    moduleId: String(raw.moduleId),
    topicId: String(raw.topicId),
    title: raw.title,
    description: raw.description,
    type: raw.type,
    difficulty: raw.difficulty,
    estimatedDuration: raw.estimatedDuration,
    learningObjectives: raw.learningObjectives,
    instructions: raw.instructions,
    acceptanceCriteria: raw.acceptanceCriteria,
    resources: raw.resources,
    prerequisites: (raw.prerequisites ?? []).map(String),
    quizQuestions: raw.quizQuestions,
    codingExercise: raw.codingExercise,
    published: raw.published,
    archivedAt: raw.archivedAt,
    order: raw.order,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function loadFullCurriculum(roadmapId: string) {
  const roadmap = await Roadmap.findById(roadmapId);
  if (!roadmap) return null;
  const [modules, topics, tasks] = await Promise.all([
    ModuleModel.find({ roadmapId: roadmap._id }).sort({ order: 1 }),
    Topic.find({ roadmapId: roadmap._id }).sort({ order: 1 }),
    Task.find({ roadmapId: roadmap._id }).sort({ order: 1 }),
  ]);

  const moduleTree = modules.map((module) => ({
    id: String(module._id),
    title: module.title,
    description: module.description,
    order: module.order,
    learningOutcomes: module.learningOutcomes,
    prerequisiteModuleIds: (module.prerequisiteModuleIds ?? []).map(String),
    published: module.published,
    archivedAt: module.archivedAt,
    topics: topics
      .filter((topic) => String(topic.moduleId) === String(module._id))
      .map((topic) => ({
        id: String(topic._id),
        moduleId: String(topic.moduleId),
        title: topic.title,
        description: topic.description,
        order: topic.order,
        estimatedDuration: topic.estimatedDuration,
        learningOutcomes: topic.learningOutcomes,
        prerequisites: (topic.prerequisites ?? []).map(String),
        resources: topic.resources,
        published: topic.published,
        archivedAt: topic.archivedAt,
        tasks: tasks
          .filter((task) => String(task.topicId) === String(topic._id))
          .map((task) => serializeAdminTask(task)),
      })),
  }));

  return {
    roadmap: {
      id: String(roadmap._id),
      title: roadmap.title,
      slug: roadmap.slug,
      tagline: roadmap.tagline,
      description: roadmap.description,
      category: roadmap.category,
      difficulty: roadmap.difficulty,
      difficultyLabel: roadmap.difficultyLabel,
      estimatedDuration: roadmap.estimatedDuration,
      prerequisites: roadmap.prerequisites,
      learningOutcomes: roadmap.learningOutcomes,
      skills: roadmap.skills,
      tags: roadmap.tags,
      icon: roadmap.icon,
      published: roadmap.published,
      archivedAt: roadmap.archivedAt,
      version: roadmap.version,
      publishedAt: roadmap.publishedAt,
      createdAt: roadmap.createdAt,
      updatedAt: roadmap.updatedAt,
    },
    modules: moduleTree,
  };
}

/** Counts *visible* published content, matching what learners see. */
export async function countPublishedContent(roadmapId: string) {
  const bundle = await loadCurriculum(roadmapId);
  if (!bundle) return { modules: 0, topics: 0, tasks: 0 };
  return { modules: bundle.modules.length, topics: bundle.topics.length, tasks: bundle.tasks.length };
}

export async function validateRoadmapContent(
  roadmap: RoadmapDocument,
  options: { includeInfo?: boolean } = {},
): Promise<RoadmapValidationSummary> {
  const issues: CurriculumIssue[] = [];
  const add = (
    severity: CurriculumIssue['severity'],
    entityType: CurriculumIssue['entityType'],
    entityId: string,
    entityTitle: string,
    message: string,
  ) => {
    if (severity === 'info' && !options.includeInfo) return;
    issues.push({
      severity,
      roadmapId: String(roadmap._id),
      roadmapTitle: roadmap.title,
      entityType,
      entityId,
      entityTitle,
      message,
    });
  };

  const [modules, topics, tasks] = await Promise.all([
    ModuleModel.find({ roadmapId: roadmap._id }).sort({ order: 1 }),
    Topic.find({ roadmapId: roadmap._id }).sort({ order: 1 }),
    Task.find({ roadmapId: roadmap._id }).sort({ order: 1 }),
  ]);
  const activeModules = modules.filter((module) => !module.archivedAt);
  const activeTopics = topics.filter((topic) => !topic.archivedAt && activeModules.some((m) => String(m._id) === String(topic.moduleId)));
  const activeTasks = tasks.filter(
    (task) =>
      !task.archivedAt &&
      activeTopics.some((t) => String(t._id) === String(task.topicId)) &&
      activeModules.some((m) => String(m._id) === String(task.moduleId)),
  );
  const publishedTasks = activeTasks.filter((task) => task.published);

  if (roadmap.published) {
    if (!roadmap.tagline) add('warning', 'roadmap', String(roadmap._id), roadmap.title, 'Published roadmap has no tagline.');
    if (roadmap.learningOutcomes.length === 0) {
      add('warning', 'roadmap', String(roadmap._id), roadmap.title, 'Published roadmap has no learning outcomes.');
    }
    if (roadmap.skills.length === 0) add('warning', 'roadmap', String(roadmap._id), roadmap.title, 'Add skills to help learners evaluate the roadmap.');
    if (activeModules.filter((m) => m.published).length === 0) {
      add('error', 'roadmap', String(roadmap._id), roadmap.title, 'Published roadmap has no published modules.');
    }
    if (publishedTasks.length === 0) {
      add('error', 'roadmap', String(roadmap._id), roadmap.title, 'Published roadmap has no published tasks.');
    }
  }
  if (roadmap.archivedAt) add('info', 'roadmap', String(roadmap._id), roadmap.title, 'Roadmap is archived.');

  for (const module of activeModules) {
    const moduleTopics = activeTopics.filter((topic) => String(topic.moduleId) === String(module._id));
    const modulePublishedTopics = moduleTopics.filter((topic) => topic.published);
    if (module.published && moduleTopics.length === 0) {
      add('error', 'module', String(module._id), module.title, 'Published module has no topics.');
    }
    if (module.published && modulePublishedTopics.length === 0) {
      add('error', 'module', String(module._id), module.title, 'Published module has no published topics.');
    }
    if (!module.description) add('warning', 'module', String(module._id), module.title, 'Module has no description.');
    if (module.learningOutcomes.length === 0) {
      add('warning', 'module', String(module._id), module.title, 'Module has no learning outcomes.');
    }
    if (module.published && moduleTopics.length > 0 && moduleTopics.every((topic) => !topic.published)) {
      add('warning', 'module', String(module._id), module.title, 'All topics in this module are unpublished.');
    }
    for (const prereqId of module.prerequisiteModuleIds ?? []) {
      if (!modules.some((m) => String(m._id) === String(prereqId))) {
        add('error', 'module', String(module._id), module.title, 'Module references a prerequisite module from another roadmap.');
      }
    }
  }

  for (const topic of activeTopics) {
    const topicTasks = activeTasks.filter((task) => String(task.topicId) === String(topic._id));
    const publishedTopicTasks = topicTasks.filter((task) => task.published);
    if (!topic.description) add('warning', 'topic', String(topic._id), topic.title, 'Topic has no description.');
    if (topic.learningOutcomes.length === 0) {
      add('warning', 'topic', String(topic._id), topic.title, 'Topic has no learning outcomes.');
    }
    if (topic.published && publishedTopicTasks.length === 0) {
      add('error', 'topic', String(topic._id), topic.title, 'Published topic has no published tasks.');
    } else if (topic.published && publishedTopicTasks.length < 3) {
      add('warning', 'topic', String(topic._id), topic.title, `Topic has only ${publishedTopicTasks.length} published task(s); aim for at least 3 actionable tasks.`);
    }
    if (topic.published && !topicTasks.some((task) => task.type === 'learn' || task.type === 'revision' || task.type === 'quiz')) {
      add('warning', 'topic', String(topic._id), topic.title, 'Topic has no learn, revision or quiz task.');
    }
    for (const prereqId of topic.prerequisites ?? []) {
      if (!topics.some((t) => String(t._id) === String(prereqId))) {
        add('error', 'topic', String(topic._id), topic.title, 'Topic references a prerequisite from another roadmap.');
      }
    }
  }

  for (const task of activeTasks) {
    if (!task.published) {
      add('info', 'task', String(task._id), task.title, 'Task is unpublished and excluded from learner progress.');
      continue;
    }
    if (!task.instructions) add('error', 'task', String(task._id), task.title, 'Published task has no instructions.');
    if (task.acceptanceCriteria.length === 0) {
      add('error', 'task', String(task._id), task.title, 'Published task has no measurable acceptance criteria.');
    }
    if (task.learningObjectives.length === 0) {
      add('warning', 'task', String(task._id), task.title, 'Task has no learning objectives.');
    }
    if (task.estimatedDuration < 5) add('warning', 'task', String(task._id), task.title, 'Task estimate is under 5 minutes.');
    if (task.resources.length === 0 && (task.type === 'learn' || task.type === 'revision')) {
      add('warning', 'task', String(task._id), task.title, 'Learning task has no resources.');
    }
    if (task.type === 'quiz' && task.quizQuestions.length === 0) {
      add('error', 'task', String(task._id), task.title, 'Quiz task has no quiz questions.');
    }
    for (const question of task.quizQuestions ?? []) {
      if (question.correctOptionIndex >= question.options.length) {
        add('error', 'task', String(task._id), task.title, 'Quiz question has an invalid correct option index.');
      }
    }
    if (task.codingExercise && !task.codingExercise.problemStatement) {
      add('warning', 'task', String(task._id), task.title, 'Coding exercise has no problem statement.');
    }
    if (task.codingExercise && !task.codingExercise.solutionExplanation) {
      add('warning', 'task', String(task._id), task.title, 'Coding exercise has no solution explanation for learners to reveal.');
    }
    for (const prereqId of task.prerequisites ?? []) {
      if (!tasks.some((t) => String(t._id) === String(prereqId))) {
        add('error', 'task', String(task._id), task.title, 'Task references a prerequisite from another roadmap.');
      }
    }
  }

  return {
    roadmapId: String(roadmap._id),
    title: roadmap.title,
    slug: roadmap.slug,
    published: roadmap.published,
    moduleCount: activeModules.length,
    topicCount: activeTopics.length,
    taskCount: activeTasks.length,
    publishedTaskCount: publishedTasks.length,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    issues,
  };
}

export async function validateAllContent(options: { includeInfo?: boolean; roadmapId?: string } = {}) {
  const filter: Record<string, unknown> = {};
  if (options.roadmapId) filter._id = options.roadmapId;
  const roadmaps = await Roadmap.find(filter).sort({ title: 1 });
  const summaries: RoadmapValidationSummary[] = [];
  for (const roadmap of roadmaps) {
    summaries.push(await validateRoadmapContent(roadmap, { includeInfo: options.includeInfo }));
  }
  const issues = summaries.flatMap((summary) => summary.issues);
  return {
    summary: {
      roadmaps: summaries.length,
      publishedRoadmaps: summaries.filter((summary) => summary.published).length,
      errors: issues.filter((issue) => issue.severity === 'error').length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
      infos: issues.filter((issue) => issue.severity === 'info').length,
      roadmapsWithErrors: summaries.filter((summary) => summary.errors > 0).length,
    },
    roadmaps: summaries,
  };
}
