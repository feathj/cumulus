import 'server-only';

import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { cache } from 'react';
import type { ReactNode } from 'react';

import { createContext } from '@/server/trpc/context';
import { appRouter } from '@/server/trpc/root';

import { makeQueryClient } from './query-client';

/** One query client per request, shared by every Server Component in the render. */
export const getQueryClient = cache(makeQueryClient);

/**
 * Query options for Server Components. Prefetching through this calls the
 * router in-process — no HTTP round trip — and `HydrateClient` hands the
 * results to Client Components using the same query keys.
 */
export const trpc = createTRPCOptionsProxy({
  ctx: createContext,
  router: appRouter,
  queryClient: getQueryClient,
});

export function HydrateClient({ children }: { children: ReactNode }) {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{children}</HydrationBoundary>;
}
