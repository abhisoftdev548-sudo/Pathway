import { aiMl } from './aiMl.js';
import { backend } from './backend.js';
import { computerFundamentals } from './computerFundamentals.js';
import { cpp } from './cpp.js';
import { problemSolving } from './dsa.js';
import { frontend } from './frontend.js';
import { buildRoadmap } from './generate.js';
import type { SeedRoadmap } from './generate.js';
import { java } from './java.js';
import { javascript } from './javascript.js';
import { networking } from './networking.js';
import { programmingFundamentals } from './programmingFundamentals.js';
import { softwareEngineering } from './softwareEngineering.js';

export type { SeedModule, SeedRoadmap, SeedTask, SeedTopic } from './generate.js';
export type { ModuleSeed, RoadmapSeed, TopicSeed } from './types.js';

/**
 * Ordered seed curriculum.
 *
 * Every roadmap is expanded by `buildRoadmap`, which generates learn, practice,
 * apply and quiz tasks for each topic, wires prerequisites and computes
 * durations. Importing this module is side-effect free.
 */
export const seedRoadmaps: SeedRoadmap[] = [
  programmingFundamentals,
  computerFundamentals,
  problemSolving,
  javascript,
  java,
  cpp,
  frontend,
  backend,
  networking,
  softwareEngineering,
  aiMl,
].map(buildRoadmap);

export const seedRoadmapSlugs = seedRoadmaps.map((roadmap) => roadmap.slug);
