import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { MemoryView } from './memory-view';

export default async function ClusterMemoryPage({ params }: PageProps<'/cloud/[domain]/[cluster]/memory'>) {
  const { domain, cluster } = await params;
  await getQueryClient().prefetchQuery(
    trpc.memory.cluster.queryOptions({ domainSlug: domain, clusterSlug: cluster }),
  );

  return (
    <HydrateClient>
      <MemoryView domainSlug={domain} clusterSlug={cluster} />
    </HydrateClient>
  );
}
