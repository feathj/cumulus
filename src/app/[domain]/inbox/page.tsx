import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { InboxView } from './inbox-view';

export default async function InboxPage({ params }: PageProps<'/[domain]/inbox'>) {
  const { domain } = await params;
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.inbox.list.queryOptions({ domainSlug: domain })),
    queryClient.prefetchQuery(trpc.cluster.list.queryOptions({ domainSlug: domain })),
  ]);

  return (
    <HydrateClient>
      <InboxView domainSlug={domain} />
    </HydrateClient>
  );
}
