import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { TopCloud } from './top-cloud';

export default async function CloudPage() {
  await getQueryClient().prefetchQuery(trpc.domain.cloud.queryOptions());

  return (
    <HydrateClient>
      <TopCloud />
    </HydrateClient>
  );
}
