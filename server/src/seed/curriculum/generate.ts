import type { Difficulty, TaskType } from '../../models/constants.js';
import type {
  ModuleSeed,
  ProblemSeed,
  QuizQuestionSeed,
  ResourceSeed,
  RoadmapSeed,
  TopicExtra,
} from './types.js';

export interface SeedTask {
  key: string;
  title: string;
  description: string;
  type: TaskType;
  difficulty: Difficulty;
  estimatedDuration: number;
  learningObjectives: string[];
  instructions: string;
  acceptanceCriteria: string[];
  resources: ResourceSeed[];
  prerequisiteKeys: string[];
  quizQuestions: QuizQuestionSeed[];
  codingExercise: {
    problemStatement: string;
    examples: { input: string; output: string; explanation: string }[];
    constraints: string[];
    hints: string[];
    solutionExplanation: string;
    starterCode: string;
    selfVerified: boolean;
  } | null;
  order: number;
  published: boolean;
}

export interface SeedTopic {
  key: string;
  title: string;
  description: string;
  order: number;
  estimatedDuration: number;
  learningOutcomes: string[];
  resources: ResourceSeed[];
  prerequisiteKeys: string[];
  published: boolean;
  tasks: SeedTask[];
}

export interface SeedModule {
  key: string;
  title: string;
  description: string;
  order: number;
  learningOutcomes: string[];
  resources: ResourceSeed[];
  prerequisiteKeys: string[];
  published: boolean;
  topics: SeedTopic[];
}

export interface SeedRoadmap extends Omit<RoadmapSeed, 'modules' | 'estimatedDuration'> {
  estimatedDuration: { minWeeks: number; maxWeeks: number; totalHours: number };
  modules: SeedModule[];
}

const pick = <T>(items: T[], index: number): T => items[index % items.length];

const learnTitles = (title: string) => [
  `Understand ${title}`,
  `Core concepts: ${title}`,
  `Study ${title}`,
  `Learn: ${title}`,
];

const practiceTitles = (title: string) => [
  `Practice ${title}`,
  `Guided exercise: ${title}`,
  `Work through ${title}`,
  `Hands-on: ${title}`,
];

const applyTitles = (title: string, type: TaskType) => {
  if (type === 'project') return [`Build: ${title}`, `Mini project: ${title}`, `Create with ${title}`];
  if (type === 'code') return [`Implement ${title}`, `Code lab: ${title}`];
  if (type === 'revision') return [`Revise ${title}`, `Review and reinforce: ${title}`];
  if (type === 'assessment') return [`Assessment: ${title}`];
  return [`Apply ${title}`, `Put ${title} into practice`];
};

function baseDifficulty(roadmap: RoadmapSeed, moduleIndex: number, topicIndex: number): Difficulty {
  const ratio = (moduleIndex + topicIndex * 0.25) / Math.max(1, roadmap.modules.length);
  if (ratio < 0.3) return 'beginner';
  if (ratio < 0.68) return 'intermediate';
  return 'advanced';
}

function codingTypeFor(roadmap: RoadmapSeed): boolean {
  return ['Programming', 'Problem Solving', 'Software Engineering'].includes(roadmap.category);
}

function chooseApplyType(roadmap: RoadmapSeed, module: ModuleSeed, topicTitle: string, isLastModule: boolean, isLastTopic: boolean, index: number): TaskType {
  const lower = topicTitle.toLowerCase();
  if (lower.includes('final project') || lower.includes('capstone') || lower.includes('final assessment')) return 'assessment';
  if (lower.includes('project') || lower.includes('build ')) return 'project';
  if (isLastModule && isLastTopic) return 'assessment';
  if (isLastTopic) return 'project';
  if (index % 9 === 4) return 'revision';
  return codingTypeFor(roadmap) && !['Computer Science Foundations'].includes(roadmap.category) ? 'code' : 'project';
}

function resourcesFor(topicResources: ResourceSeed[], moduleResources: ResourceSeed[], roadmapResources: ResourceSeed[]): ResourceSeed[] {
  const pool = topicResources.length > 0 ? topicResources : moduleResources.length > 0 ? moduleResources : roadmapResources;
  return pool.slice(0, 3).map((resource) => ({ ...resource, verified: resource.verified ?? true }));
}

function codingExercise(problem: ProblemSeed) {
  return {
    problemStatement: problem.statement,
    examples: problem.examples.map((example) => ({
      input: example.input,
      output: example.output,
      explanation: example.explanation ?? '',
    })),
    constraints: problem.constraints,
    hints: problem.hints,
    solutionExplanation: problem.solution,
    starterCode: problem.starterCode ?? '',
    selfVerified: true,
  };
}

function topicTaskType(extra: TopicExtra | undefined): TaskType {
  // `extra.type` customises the apply task; the practice task is a coding
  // exercise when a problem is attached, otherwise a guided practice.
  return extra?.problem ? 'code' : 'practice';
}

export function buildRoadmap(seed: RoadmapSeed): SeedRoadmap {
  let totalMinutes = 0;
  const modules: SeedModule[] = seed.modules.map((module, moduleIndex) => {
    const moduleResources = module.resources ?? [];
    const isLastModule = moduleIndex === seed.modules.length - 1;
    const topics: SeedTopic[] = module.topics.map((topic, topicIndex) => {
      const extra = topic.extra;
      const title = topic.title;
      const titleLower = /[?!.]$/.test(title)
        ? `the concept of ${(title.charAt(0).toLowerCase() + title.slice(1)).replace(/[?!.]+$/, '')}`
        : title.charAt(0).toLowerCase() + title.slice(1);
      const difficulty = extra?.difficulty ?? baseDifficulty(seed, moduleIndex, topicIndex);
      const isLastTopic = topicIndex === module.topics.length - 1;
      const topicKey = `m${moduleIndex + 1}-t${topicIndex + 1}`;
      const resources = resourcesFor(extra?.quiz ? [] : [], moduleResources, seed.resources);

      const learnMinutes = 20 + (topicIndex % 3) * 5;
      const practiceMinutes = extra?.problem ? 35 + (topicIndex % 3) * 5 : 20 + (moduleIndex % 3) * 5;
      const applyType = extra?.type ?? chooseApplyType(seed, module, title, isLastModule, isLastTopic, topicIndex + moduleIndex * 7);
      const applyMinutes = applyType === 'assessment' ? 60 + (moduleIndex % 3) * 10 : 30 + (moduleIndex % 3) * 10 + (isLastTopic ? 15 : 0);

      const learnTask: SeedTask = {
        key: `${topicKey}-learn`,
        title: pick(learnTitles(title), topicIndex + moduleIndex),
        description: `${topic.essence} This lesson is part of “${module.title}” in the ${seed.title} roadmap.`,
        type: 'learn',
        difficulty,
        estimatedDuration: learnMinutes,
        learningObjectives: [
          `Explain ${titleLower} in your own words.`,
          `Describe how ${titleLower} fits into ${module.title.toLowerCase()}.`,
          `Recognise one practical example and one limitation of ${titleLower}.`,
        ],
        instructions: [
          `Study this topic: ${title}`,
          topic.essence,
          'Work through the reference material listed under Resources, taking short notes as you go.',
          'Write a five-sentence explanation in your own words, then add one concrete example and one edge case or limitation.',
          'Finish by writing down one question you still cannot answer and keep it in your private task notes.',
        ].join('\n\n'),
        acceptanceCriteria: [
          `You wrote a five-sentence explanation of ${titleLower} without copying the source text.`,
          'Your notes contain at least one concrete example and one limitation or edge case.',
          `You can explain why this concept matters inside ${module.title}.`,
        ],
        resources,
        prerequisiteKeys: [],
        quizQuestions: [],
        codingExercise: null,
        order: 1,
        published: true,
      };

      const practiceTask: SeedTask = {
        key: `${topicKey}-practice`,
        title: extra?.problem ? extra.problem.title : pick(practiceTitles(title), topicIndex + moduleIndex + 1),
        description: extra?.problem
          ? `${extra.problem.statement}\n\n${topic.practice}`
          : `${topic.practice}\n\nContext: ${topic.essence}`,
        type: topicTaskType(extra),
        difficulty,
        estimatedDuration: practiceMinutes,
        learningObjectives: [
          `Apply ${titleLower} to a concrete exercise.`,
          `Check your work against a concrete expected outcome.`,
          `Identify and correct at least one mistake.`,
        ],
        instructions: extra?.problem
          ? [
              `Solve the problem “${extra.problem.title}”.`,
              'Read the constraints before writing code. Start with a brute-force approach, then improve it if needed.',
              'Run your solution against the provided examples. Add at least two edge cases of your own.',
              'Record the time and space complexity, then reveal the solution explanation only after you have a working attempt.',
              'Save your code as a submission and mark it self-verified once the examples pass.',
            ].join('\n\n')
          : [
              `Exercise: ${topic.practice}`,
              'Attempt the exercise without checking your notes. Show your reasoning at each step.',
              'Compare your result with the expected outcome in the exercise. If anything differs, explain why before correcting it.',
              'Record what you produced and the mistake or open question you found in your private notes.',
            ].join('\n\n'),
        acceptanceCriteria: extra?.problem
          ? [
              'Your solution produces the expected output for every provided example.',
              'Your solution handles the listed constraints and at least two edge cases.',
              'You recorded time and space complexity and self-verified the submission.',
            ]
          : [
              `You completed the exercise: ${topic.practice}`,
              'You recorded your answer or artifact and the reasoning behind it.',
              'You identified and explained at least one mistake or ambiguity.',
            ],
        resources,
        prerequisiteKeys: [learnTask.key],
        quizQuestions: extra?.quiz ?? [],
        codingExercise: extra?.problem ? codingExercise(extra.problem) : null,
        order: 2,
        published: true,
      };

      const applyDescription = extra?.apply
        ? extra.apply
        : applyType === 'revision'
          ? `Revisit ${titleLower} and consolidate what you have learned. Re-do the practice from memory, then write a short revision note that connects ${topic.essence}`
          : applyType === 'code'
            ? `Implement a small, working program that demonstrates ${titleLower}. ${topic.essence} Keep the scope tight: one clear scenario, meaningful names and observable output.`
            : applyType === 'assessment'
              ? `Complete an assessment task that combines ${titleLower} with the rest of ${module.title}. Work without notes first; then review the reference material and correct gaps. ${topic.essence}`
              : `Produce a self-contained artifact that puts ${titleLower} into practice. Use the context of ${module.title}: ${topic.essence} A diagram, checklist, worked example, or short report is acceptable as long as it is specific and reviewable.`;

      const applyTask: SeedTask = {
        key: `${topicKey}-apply`,
        title: pick(applyTitles(title, applyType), topicIndex + moduleIndex + 2),
        description: applyDescription,
        type: applyType,
        difficulty,
        estimatedDuration: applyMinutes,
        learningObjectives: [
          `Demonstrate ${titleLower} in a working artifact.`,
          `Justify the decisions you made while applying ${titleLower}.`,
          `Evaluate the result against measurable acceptance criteria.`,
        ],
        instructions:
          applyType === 'code'
            ? [
                `Build an artifact for: ${title}`,
                applyDescription,
                'Choose one realistic input or scenario and implement the behaviour end to end. Include comments only where the reasoning is non-obvious.',
                'Test the happy path, one invalid input or edge case, and one variation of the scenario.',
                'Write a short README or comment block explaining what the artifact shows, how to run it, and one trade-off you noticed.',
              ].join('\n\n')
            : applyType === 'revision'
              ? [
                  `Revise: ${title}`,
                  applyDescription,
                  'List the three ideas you remember without looking, then reopen your notes and correct the gaps in a different colour or section.',
                  'Re-do one exercise from the practice task from memory and compare the two attempts.',
                  'Write one sentence about what you will do differently next time.',
                ].join('\n\n')
              : applyType === 'assessment'
                ? [
                    `Assessment: ${title}`,
                    applyDescription,
                    'Work alone and without reference material for the first attempt. Time-box the attempt to the estimate.',
                    'Review the relevant references afterwards and annotate every mistake or uncertainty.',
                    'Submit a concise summary of the result, the corrections, and one idea you would explore next.',
                  ].join('\n\n')
                : [
                    `Create an artifact for: ${title}`,
                    applyDescription,
                    'Make the artifact self-contained: include the scenario, your reasoning, and the result.',
                    'Check it against every acceptance criterion below before marking the task complete.',
                    'Add a short reflection: what was harder than expected, and what you would improve with more time.',
                  ].join('\n\n'),
        acceptanceCriteria:
          applyType === 'code'
            ? [
                'The artifact runs without errors and produces the expected behaviour.',
                `It clearly demonstrates ${titleLower}, not just a tangential feature.`,
                'You tested at least one edge case and documented how to run the artifact.',
                'You can explain the key implementation choices in three to five sentences.',
              ]
            : applyType === 'revision'
              ? [
                  `You reproduced the core idea of ${titleLower} from memory.`,
                  'You corrected at least one gap using the reference material.',
                  'You wrote a specific next-step reflection rather than a generic statement.',
                ]
              : applyType === 'assessment'
                ? [
                    `The assessment covers ${titleLower} and its connections to ${module.title}.`,
                    'You annotated every mistake after reviewing the references.',
                    'You completed the attempt within the estimated time or explained the overrun.',
                  ]
                : [
                    `The artifact makes ${titleLower} understandable to another learner.`,
                    'It includes a concrete scenario, your reasoning, and an observable result.',
                    'You checked the artifact against every criterion and added a short reflection.',
                  ],
        resources,
        prerequisiteKeys: [practiceTask.key],
        quizQuestions: [],
        codingExercise: null,
        order: 3,
        published: true,
      };

      const tasks: SeedTask[] = [learnTask, practiceTask, applyTask];
      if (extra?.quiz && extra.quiz.length > 0 && !extra.problem) {
        const quizTask: SeedTask = {
          key: `${topicKey}-quiz`,
          title: `Check your understanding: ${title}`,
          description: `A short quiz covering ${titleLower}. ${topic.essence}`,
          type: 'quiz',
          difficulty,
          estimatedDuration: 15,
          learningObjectives: [`Check recall and understanding of ${titleLower}.`],
          instructions: [
            `Answer the quiz questions for ${title} without looking at your notes.`,
            'Submit the attempt to see immediate feedback and explanations.',
            'Review any incorrect answer and correct your notes before marking the task complete.',
          ].join('\n\n'),
          acceptanceCriteria: [
            'You submitted an answer for every question.',
            'You reviewed the explanation for every incorrect answer.',
            'Your notes reflect the correction.',
          ],
          resources,
          prerequisiteKeys: [learnTask.key],
          quizQuestions: extra.quiz,
          codingExercise: null,
          order: extra.problem ? 3 : 4,
          published: true,
        };
        tasks.push(quizTask);
        if (extra.problem) applyTask.order = 4;
      }

      const estimatedDuration = tasks.reduce((sum, task) => sum + task.estimatedDuration, 0);
      totalMinutes += estimatedDuration;
      return {
        key: topicKey,
        title,
        description: topic.essence,
        order: topicIndex + 1,
        estimatedDuration,
        learningOutcomes: [
          `Explain ${titleLower}.`,
          `Use ${titleLower} in a practical exercise.`,
          `Review your work against measurable criteria.`,
        ],
        resources,
        prerequisiteKeys: topicIndex > 0 ? [`m${moduleIndex + 1}-t${topicIndex}`] : [],
        published: true,
        tasks,
      };
    });

    return {
      key: `m${moduleIndex + 1}`,
      title: module.title,
      description: module.description,
      order: moduleIndex + 1,
      learningOutcomes:
        module.outcomes ??
        [
          `Understand the core concepts of ${module.title.toLowerCase()}.`,
          `Complete at least one applied artifact using the topics in this module.`,
          `Explain how ${module.title.toLowerCase()} supports the wider ${seed.title} roadmap.`,
        ],
      resources: moduleResources,
      prerequisiteKeys: moduleIndex > 0 ? [`m${moduleIndex}`] : [],
      published: true,
      topics,
    };
  });

  return {
    title: seed.title,
    slug: seed.slug,
    tagline: seed.tagline,
    description: seed.description,
    category: seed.category,
    difficulty: seed.difficulty,
    difficultyLabel: seed.difficultyLabel,
    estimatedDuration: {
      ...seed.estimatedDuration,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    },
    prerequisites: seed.prerequisites,
    learningOutcomes: seed.learningOutcomes,
    skills: seed.skills,
    tags: seed.tags,
    icon: seed.icon,
    resources: seed.resources,
    modules,
  };
}
