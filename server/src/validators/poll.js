import { z } from 'zod';
import {
  CONTENT_STATUS,
  POLL_REWARD_MODES,
  RESULTS_VISIBILITY,
  VOTING_TYPE,
} from '../constants/index.js';
import { imageInput, objectId, paginationQuery } from './common.js';

const pollOptionInput = z.object({
  id: z.string().min(1).max(40),
  text: z.string().trim().min(1).max(500),
});

const pollBase = z
  .object({
    title: z.string().trim().min(3).max(160),
    question: z.string().trim().min(3).max(1000),
    description: z.string().trim().max(4000).optional().default(''),
    category: objectId.nullable().optional(),
    subcategory: objectId.nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(15).optional().default([]),
    language: z.string().trim().min(2).max(20).optional().default('en'),
    cover: imageInput,
    votingType: z.enum(Object.values(VOTING_TYPE)).optional().default(VOTING_TYPE.SINGLE),
    options: z.array(pollOptionInput).min(2).max(10),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date(),
    anonymous: z.boolean().optional().default(true),
    resultsVisibility: z
      .enum(Object.values(RESULTS_VISIBILITY))
      .optional()
      .default(RESULTS_VISIBILITY.AFTER_VOTE),
    entryFee: z.number().int().min(0).max(1000).optional().default(0),
    reward: z.number().int().min(0).max(5000).optional().default(0),
    rewardMode: z
      .enum(Object.values(POLL_REWARD_MODES))
      .optional()
      .default(POLL_REWARD_MODES.ALL_PARTICIPANTS),
    maxRewardRecipients: z.number().int().min(0).max(100000).optional().default(0),
  });

export const pollInput = pollBase.superRefine((p, ctx) => {
  if (p.endsAt && p.startsAt && p.endsAt <= p.startsAt) {
    ctx.addIssue({ code: 'custom', message: 'endsAt must be after startsAt', path: ['endsAt'] });
  }
  const ids = new Set(p.options.map((o) => o.id));
  if (ids.size !== p.options.length) {
    ctx.addIssue({ code: 'custom', message: 'Option ids must be unique', path: ['options'] });
  }
});

export const pollUpdateSchema = pollBase
  .partial()
  .extend({
    status: z.enum(Object.values(CONTENT_STATUS)).optional(),
  })
  .superRefine((p, ctx) => {
    if (p.endsAt && p.startsAt && p.endsAt <= p.startsAt) {
      ctx.addIssue({ code: 'custom', message: 'endsAt must be after startsAt', path: ['endsAt'] });
    }
    if (p.options) {
      const ids = new Set(p.options.map((o) => o.id));
      if (ids.size !== p.options.length) {
        ctx.addIssue({ code: 'custom', message: 'Option ids must be unique', path: ['options'] });
      }
    }
  });

export const pollListQuery = paginationQuery.extend({
  search: z.string().trim().max(120).optional(),
  category: objectId.optional(),
  tag: z.string().trim().max(40).optional(),
  status: z.string().optional(),
  sort: z.enum(['newest', 'endingSoon', 'popular']).optional().default('newest'),
});

export const pollVoteSchema = z
  .object({
    optionIds: z.array(z.string().min(1).max(40)).min(1).max(10),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.optionIds).size !== v.optionIds.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate option selection', path: ['optionIds'] });
    }
  });
