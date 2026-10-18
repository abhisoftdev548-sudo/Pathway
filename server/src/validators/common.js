import { z } from 'zod';

export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')
  .transform((v) => v.toLowerCase());

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const idParam = z.object({ id: objectId });
export const slugParam = z.object({ slug: z.string().min(1).max(120) });

export const MAX_COVER_URL = 500;

export const imageInput = z
  .object({
    url: z.string().url().max(MAX_COVER_URL).or(z.literal('')).optional(),
    publicId: z.string().max(200).or(z.literal('')).optional(),
  })
  .optional();
