import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { DomainCloud } from './domain-cloud';

export default async function DomainCloudPage({ params }: PageProps<'/[domain]'>) {
  const { domain } = await params;
  await getQueryClient().prefetchQuery(trpc.cluster.list.queryOptions({ domainSlug: domain }));

  return (
    <HydrateClient>
      <DomainCloud domainSlug={domain} />
    </HydrateClient>
  );
}
