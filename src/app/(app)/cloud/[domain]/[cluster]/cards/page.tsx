import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { CardBoard } from './card-board';

export default async function ClusterCardsPage({ params }: PageProps<'/cloud/[domain]/[cluster]/cards'>) {
  const { domain, cluster } = await params;
  await getQueryClient().prefetchQuery(
    trpc.cluster.board.queryOptions({ domainSlug: domain, clusterSlug: cluster }),
  );

  return (
    <HydrateClient>
      <CardBoard domainSlug={domain} clusterSlug={cluster} />
    </HydrateClient>
  );
}
