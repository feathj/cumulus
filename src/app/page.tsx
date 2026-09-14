import { connection } from 'next/server';

import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { DomainOverview } from './domain-overview';

export default async function HomePage() {
  // Live data from Postgres: render on each request, never at build time.
  await connection();
  await getQueryClient().prefetchQuery(trpc.domain.list.queryOptions());

  return (
    <HydrateClient>
      <DomainOverview />
    </HydrateClient>
  );
}
