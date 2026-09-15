import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { AppShell } from './app-shell';

/** The frame around every section: the Today / Inbox / Cloud tabs and the capture box. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  // Every section reads live data.
  await connection();
  await getQueryClient().prefetchQuery(trpc.inbox.count.queryOptions());

  return (
    <HydrateClient>
      <AppShell>{children}</AppShell>
    </HydrateClient>
  );
}
