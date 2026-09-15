import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { InboxView } from './inbox-view';

export default async function InboxPage() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.inbox.list.queryOptions()),
    queryClient.prefetchQuery(trpc.domain.cloud.queryOptions()),
  ]);

  return (
    <HydrateClient>
      <InboxView />
    </HydrateClient>
  );
}
