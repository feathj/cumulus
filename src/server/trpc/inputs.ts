import { z } from 'zod';

const slug = z.string().trim().min(1).max(100);

export const domainInput = z.object({ domainSlug: slug });

export const clusterInput = z.object({ domainSlug: slug, clusterSlug: slug });

export const idInput = z.object({ id: z.string().trim().min(1).max(100) });
