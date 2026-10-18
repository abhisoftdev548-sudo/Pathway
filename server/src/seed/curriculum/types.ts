import type { Difficulty, TaskType } from '../../models/constants.js';

export interface ResourceSeed {
  title: string;
  url: string;
  type: 'documentation' | 'article' | 'video' | 'course' | 'tool' | 'suggestion';
  verified?: boolean;
}

export interface QuizQuestionSeed {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface ProblemExampleSeed {
  input: string;
  output: string;
  explanation?: string;
}

/** A concrete coding problem attached to a practice/code task. */
export interface ProblemSeed {
  title: string;
  statement: string;
  examples: ProblemExampleSeed[];
  constraints: string[];
  hints: string[];
  solution: string;
  starterCode?: string;
}

export interface TopicExtra {
  difficulty?: Difficulty;
  apply?: string;
  quiz?: QuizQuestionSeed[];
  problem?: ProblemSeed;
  type?: TaskType;
}

export interface TopicSeed {
  title: string;
  essence: string;
  practice: string;
  extra?: TopicExtra;
}

export interface ModuleSeed {
  title: string;
  description: string;
  outcomes?: string[];
  resources?: ResourceSeed[];
  topics: TopicSeed[];
}

export interface RoadmapSeed {
  title: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  difficultyLabel: string;
  estimatedDuration: { minWeeks: number; maxWeeks: number; totalHours?: number };
  prerequisites: string[];
  learningOutcomes: string[];
  skills: string[];
  tags: string[];
  icon: string;
  resources: ResourceSeed[];
  modules: ModuleSeed[];
}

/** Helpers used by the curriculum data files to stay compact and consistent. */
export const t = (title: string, essence: string, practice: string, extra?: TopicExtra): TopicSeed => ({
  title,
  essence,
  practice,
  extra,
});

export const m = (
  title: string,
  description: string,
  topics: TopicSeed[],
  extra?: Pick<ModuleSeed, 'outcomes' | 'resources'>,
): ModuleSeed => ({ title, description, topics, ...extra });

export const r = (
  title: string,
  url: string,
  type: ResourceSeed['type'] = 'documentation',
  verified = true,
): ResourceSeed => ({ title, url, type, verified });

export const q = (
  question: string,
  options: string[],
  correctOptionIndex: number,
  explanation: string,
): QuizQuestionSeed => ({ question, options, correctOptionIndex, explanation });

export const p = (
  title: string,
  statement: string,
  examples: ProblemExampleSeed[],
  constraints: string[],
  hints: string[],
  solution: string,
  starterCode?: string,
): ProblemSeed => ({ title, statement, examples, constraints, hints, solution, starterCode });

export const ex = (input: string, output: string, explanation = ''): ProblemExampleSeed => ({
  input,
  output,
  explanation,
});
