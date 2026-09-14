import { Priority } from '@prisma/client';
import { z } from 'zod';

const slug = z.string().trim().min(1).max(100);
const id = z.string().trim().min(1).max(100);
const ideaText = z.string().trim().min(1).max(5000);

export const domainInput = z.object({ domainSlug: slug });

export const clusterInput = z.object({ domainSlug: slug, clusterSlug: slug });

export const idInput = z.object({ id });

/** Where a card goes on its board: a priority tier, and a slot in it. */
export const moveInput = z.object({
  id,
  priority: z.enum(Priority),
  index: z.number().int().min(0).max(10_000),
});

export const captureInput = z.object({ domainSlug: slug, text: ideaText });

export const updateInboxInput = z.object({ id, text: ideaText });

export const fileInboxInput = z.object({
  id,
  clusterId: id,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20_000).nullable(),
  priority: z.enum(Priority),
});

export const createClusterInput = z.object({
  domainSlug: slug,
  title: z.string().trim().min(1).max(80),
});
