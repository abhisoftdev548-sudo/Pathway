export type Role = 'user' | 'admin';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type TaskType = 'learn' | 'practice' | 'code' | 'quiz' | 'project' | 'revision' | 'assessment';
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';
export type Pace = 'relaxed' | 'standard' | 'intensive' | 'custom';
export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'archived';
export type ResourceType = 'documentation' | 'article' | 'video' | 'course' | 'tool' | 'suggestion';

export interface Resource {
  title: string;
  url: string;
  type: ResourceType;
  verified?: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
}

export interface CodingExercise {
  problemStatement: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  hints: string[];
  starterCode?: string;
  selfVerified?: boolean;
  solutionExplanation?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  bio: string;
  dailyGoalMinutes: number;
  timezone: string;
  preferences: {
    emailNotifications: boolean;
    inAppReminders: boolean;
    reminderTime: string;
    weekStartsOn: number;
    showCompletedTasks: boolean;
    reduceMotion: boolean;
    weeklyGoalTasks: number;
  };
  lastLoginAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RoadmapSummary {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  difficultyLabel: string;
  estimatedDuration: { minWeeks: number; maxWeeks: number; totalHours: number };
  prerequisites: string[];
  skills: string[];
  tags: string[];
  icon: string;
  moduleCount?: number;
  topicCount?: number;
  taskCount?: number;
  enrollmentCount?: number;
  published?: boolean;
  version?: number;
  stats?: { moduleCount: number; topicCount: number; taskCount: number; totalMinutes: number; estimatedHours: number };
  enrollment?: { enrollmentId: string; status: EnrollmentStatus; percent: number } | null;
}

export interface CurriculumTopicSummary {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedDuration: number;
  taskCount: number;
  resources: Resource[];
}

export interface CurriculumModuleSummary {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedDuration: number;
  topicCount: number;
  taskCount: number;
  estimatedMinutes: number;
  topics: CurriculumTopicSummary[];
}

export interface RoadmapDetail {
  roadmap: RoadmapSummary & { learningOutcomes: string[]; resources?: Resource[]; publishedAt?: string | null };
  modules: CurriculumModuleSummary[];
  enrollment: EnrollmentSummary | null;
  relatedRoadmaps?: RoadmapSummary[];
}

export interface ModuleProgress {
  id: string;
  title: string;
  description: string;
  order: number;
  learningOutcomes: string[];
  prerequisiteModuleIds: string[];
  totalTasks: number;
  completedTasks: number;
  percent: number;
  estimatedMinutes: number;
  completedMinutes: number;
  topicCount: number;
  locked: boolean;
  tasks?: Task[];
  topics?: TopicProgress[];
}

export interface TopicProgress {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  order: number;
  estimatedDuration: number;
  learningOutcomes: string[];
  resources: Resource[];
  totalTasks: number;
  completedTasks: number;
  percent: number;
  estimatedMinutes: number;
  locked: boolean;
}

export interface Task {
  id: string;
  roadmapId: string;
  moduleId: string;
  topicId: string;
  title: string;
  description: string;
  type: TaskType;
  difficulty: Difficulty;
  estimatedDuration: number;
  learningObjectives: string[];
  instructions: string;
  acceptanceCriteria: string[];
  resources: Resource[];
  order: number;
  status: ProgressStatus;
  locked: boolean;
  lockReason: string | null;
  prerequisiteIds: string[];
  completedAt: string | null;
  actualDuration: number;
  privateNotes: string;
  attemptCount: number;
  quizQuestions: QuizQuestion[];
  codingExercise: CodingExercise | null;
  hasCodingExercise: boolean;
  moduleTitle?: string;
  topicTitle?: string;
  moduleOrder?: number;
  topicOrder?: number;
  enrollmentId?: string;
  enrollmentStatus?: EnrollmentStatus;
  learningPace?: Pace;
  paceMinutes?: number;
  roadmapTitle?: string;
  roadmapSlug?: string;
  roadmapCategory?: string;
}

export interface EnrollmentSummary {
  enrollmentId: string;
  status: EnrollmentStatus;
  learningPace: Pace;
  customDailyGoal: number | null;
  paceMinutes: number;
  enrolledAt: string;
  completedAt: string | null;
  lastActivityAt: string | null;
  percent: number;
  completedTasks: number;
  totalTasks: number;
  completedMinutes: number;
  totalMinutes: number;
  completedToday: number;
  nextTask: Pick<Task, 'id' | 'title' | 'estimatedDuration' | 'topicTitle' | 'moduleTitle'> | null;
  roadmap: RoadmapSummary;
}

export interface Workspace {
  enrollment: EnrollmentSummary;
  roadmap: RoadmapSummary & { learningOutcomes: string[] };
  modules: ModuleProgress[];
  tasks: Task[];
  progress: {
    percent: number;
    totalTasks: number;
    completedTasks: number;
    totalMinutes: number;
    completedMinutes: number;
    completedToday: number;
    nextTask: Task | null;
  };
}

export interface DashboardData {
  user: Pick<User, 'id' | 'name' | 'email' | 'timezone' | 'dailyGoalMinutes' | 'preferences'>;
  welcome: { message: string; date: string; timezone: string };
  streak: StreakData;
  plan: DailyPlan;
  stats: {
    overallPercent: number;
    completedTasks: number;
    totalTasks: number;
    completedMinutes: number;
    totalMinutes: number;
    completedToday: number;
    todayMinutes: number;
    activeRoadmaps: number;
    enrolledRoadmaps: number;
    weeklyCompleted: number;
    weeklyGoal: number;
    weeklyMinutes: number;
    unreadNotifications: number;
    achievements: number;
  };
  roadmaps: EnrollmentSummary[];
  recentCompletions: {
    id: string;
    title: string;
    completedAt: string;
    estimatedDuration: number;
    type: TaskType;
    roadmapTitle: string;
    roadmapSlug: string;
    enrollmentId: string;
    topicTitle: string;
  }[];
  recentAchievements: Achievement[];
  upcomingMilestones: {
    roadmapTitle: string;
    roadmapSlug: string;
    enrollmentId: string;
    moduleId: string;
    moduleTitle: string;
    percent: number;
    completedTasks: number;
    totalTasks: number;
    remainingMinutes: number;
  }[];
  learningTime: { date: string; minutes: number; completedTasks: number }[];
  heatmap: { date: string; completedTasks: number; learningMinutes: number }[];
  continueLearning: {
    enrollmentId: string;
    roadmapTitle: string;
    roadmapSlug: string;
    percent: number;
    nextTask: Task | null;
  } | null;
  generatedAt: string;
}

export interface PlanRoadmap {
  enrollmentId: string;
  roadmapId: string;
  title: string;
  slug: string;
  category: string;
  pace: Pace;
  paceMinutes: number;
  percent: number;
  completedTasks: number;
  totalTasks: number;
  warnings?: string[];
  counts?: { recommended: number; completedToday: number; remainingUnlocked: number };
}

export interface DailyPlan {
  date: string;
  timezone: string;
  algorithm: string;
  budgetMinutes: number;
  spentMinutes: number;
  remainingBudgetMinutes: number;
  totalRecommendedMinutes: number;
  recommendations: (Task & { exceedsDailyBudget?: boolean })[];
  completedToday: Task[];
  upcoming: Task[];
  activeRoadmaps: PlanRoadmap[];
  warnings: string[];
  counts: { recommended: number; completedToday: number; remainingUnlocked: number };
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  todayCompleted: number;
  todayMinutes: number;
  lastActiveDate: string | null;
  weekly: { date: string; completedTasks: number; learningMinutes: number; active: boolean }[];
  heatmap?: { date: string; completedTasks: number; learningMinutes: number }[];
  currentWeekCompleted?: number;
  currentWeekMinutes?: number;
}

export interface AnalyticsData {
  range: { days: number; startDate: string; endDate: string; timezone: string };
  overall: {
    percent: number;
    totalTasks: number;
    completedTasks: number;
    totalMinutes: number;
    completedMinutes: number;
  };
  streak: StreakData;
  stats: {
    completedTasks: number;
    totalTasks: number;
    completedMinutes: number;
    remainingMinutes: number;
    recordedMinutes: number;
    activeDays: number;
    avgDailyMinutes: number;
    avgPerActiveDay: number;
    dailyGoalMinutes: number;
    modulesCompleted: number;
    modulesTotal: number;
    daysToFinish: number;
    projectedCompletionDate: string;
  };
  roadmaps: EnrollmentSummary[];
  modules: {
    id: string;
    title: string;
    roadmapTitle: string;
    roadmapSlug: string;
    percent: number;
    completedTasks: number;
    totalTasks: number;
    estimatedMinutes: number;
    remainingMinutes: number;
  }[];
  activity: {
    series: { date: string; completedTasks: number; minutes: number }[];
    trend: { date: string; completedTasks: number; minutes: number }[];
    completions: number;
    reopens: number;
    byDifficulty: { difficulty: Difficulty; count: number }[];
    byType: { type: TaskType; count: number }[];
    timeByRoadmap: {
      roadmapTitle: string;
      roadmapSlug: string;
      estimatedMinutes: number;
      recordedMinutes: number;
      remainingMinutes: number;
    }[];
  };
  generatedAt: string;
}

export interface Achievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: 'milestone' | 'streak' | 'consistency' | 'completion';
  earned: boolean;
  earnedAt: string | null;
  progress?: { current: number; target: number; unit: string };
}

export interface Certificate {
  id: string;
  roadmapTitle: string;
  roadmapSlug: string;
  completedAt: string;
  certificateId: string;
  learnerName: string;
  totalTasks: number;
  totalMinutes: number;
}

export interface Notification {
  id: string;
  type: 'achievement' | 'milestone' | 'enrollment' | 'reminder' | 'system';
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  activityType: string;
  timestamp: string;
  localDate: string;
  minutes: number;
  task: { id: string; title: string; type: TaskType; difficulty?: Difficulty } | null;
  roadmap: { id: string; title: string; slug: string } | null;
  metadata?: Record<string, unknown>;
}

export interface AdminRoadmap extends Omit<RoadmapSummary, 'stats'> {
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  seedVersion?: number;
  stats?: { moduleCount: number; topicCount: number; taskCount: number; totalMinutes?: number; estimatedHours?: number; enrollmentCount?: number };
  enrollmentCount?: number;
}

export interface AdminIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  entityType?: string;
  entityId?: string;
  path?: string;
}

export interface ValidationReport {
  summary: {
    roadmaps: number;
    publishedRoadmaps: number;
    errors: number;
    warnings: number;
    infos: number;
    roadmapsWithErrors: number;
  };
  roadmaps: {
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
    issues: AdminIssue[];
  }[];
}
