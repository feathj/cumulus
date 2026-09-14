import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { ClusterCloud } from './cluster-cloud';

export default async function ClusterCloudPage({ params }: PageProps<'/[domain]/[cluster]'>) {
  const { domain, cluster } = await params;
  const input = { domainSlug: domain, clusterSlug: cluster };
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.cluster.board.queryOptions(input)),
    queryClient.prefetchQuery(trpc.memory.clusterSummary.queryOptions(input)),
  ]);

  return (
    <HydrateClient>
      <ClusterCloud domainSlug={domain} clusterSlug={cluster} />
    </HydrateClient>
  );
}
