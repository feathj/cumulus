import { Priority } from '@prisma/client';
import { z } from 'zod';

const slug = z.string().trim().min(1).max(100);
const id = z.string().trim().min(1).max(100);

export const domainInput = z.object({ domainSlug: slug });

export const clusterInput = z.object({ domainSlug: slug, clusterSlug: slug });

export const idInput = z.object({ id });

/** Where a card goes on its board: a priority tier, and a slot in it. */
export const moveInput = z.object({
  id,
  priority: z.enum(Priority),
  index: z.number().int().min(0).max(10_000),
});
