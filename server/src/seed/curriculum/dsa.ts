import { dsaModulesA } from './dsaModulesA.js';
import { dsaModulesB } from './dsaModulesB.js';
import { r } from './types.js';
import type { RoadmapSeed } from './types.js';

export const problemSolving: RoadmapSeed = {
  title: 'Problem Solving and Algorithms',
  slug: 'problem-solving-and-algorithms',
  tagline: 'Master data structures, algorithmic patterns and interview-grade problem solving.',
  description:
    'A structured data structures and algorithms curriculum: complexity analysis, arrays and strings, searching and sorting, two pointers and sliding windows, hashing, linked lists, stacks and queues, recursion and backtracking, trees, heaps, graphs, greedy algorithms, dynamic programming and advanced patterns. Every topic includes a concrete coding problem and the capstone is a timed mixed assessment.',
  category: 'Computer Science',
  difficulty: 'advanced',
  difficultyLabel: 'Intermediate to Advanced',
  estimatedDuration: { minWeeks: 16, maxWeeks: 24 },
  prerequisites: ['Programming fundamentals in any language', 'Familiarity with functions, arrays and basic recursion', 'Willingness to practise problems regularly'],
  learningOutcomes: [
    'Analyse time and space complexity confidently.',
    'Apply core data structures to the right problems.',
    'Recognise and implement recurring algorithmic patterns.',
    'Solve graph and tree problems with traversal, shortest-path and connectivity techniques.',
    'Design dynamic-programming states and transitions.',
    'Communicate approaches and complexity in interview settings.',
  ],
  skills: ['Algorithms', 'Data structures', 'Dynamic programming', 'Graphs', 'Complexity analysis', 'Problem solving'],
  tags: ['dsa', 'algorithms', 'interviews', 'computer-science'],
  icon: 'git-branch',
  resources: [
    r('Big-O Cheat Sheet', 'https://www.bigocheatsheet.com/', 'article'),
    r('CP-Algorithms', 'https://cp-algorithms.com/', 'article'),
    r('NeetCode — Roadmap', 'https://neetcode.io/roadmap', 'course'),
  ],
  modules: [...dsaModulesA, ...dsaModulesB],
};
