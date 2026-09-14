'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import superjson from 'superjson';

import type { AppRouter } from '@/server/trpc/root';

import { makeQueryClient } from './query-client';

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  // On the server every request gets its own client, so nothing leaks between
  // requests.
  if (typeof window === 'undefined') return makeQueryClient();
  // In the browser keep one for the page's lifetime; React may suspend during
  // the first render and would otherwise throw a fresh client away.
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

function getUrl(): string {
  const base = typeof window === 'undefined' ? `http://localhost:${process.env.PORT ?? 3000}` : '';
  return `${base}/api/trpc`;
}

export function TRPCReactProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: getUrl(), transformer: superjson })],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
