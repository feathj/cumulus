import Box from '@mui/material/Box';

import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { DomainCloud } from './domain-cloud';
import { DomainToolbar } from './domain-toolbar';

export default async function DomainCloudPage({ params }: PageProps<'/cloud/[domain]'>) {
  const { domain } = await params;
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.cluster.list.queryOptions({ domainSlug: domain })),
    queryClient.prefetchQuery(trpc.cluster.cells.queryOptions({ domainSlug: domain })),
  ]);

  return (
    <HydrateClient>
      <DomainToolbar domainSlug={domain} />
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <DomainCloud domainSlug={domain} />
      </Box>
    </HydrateClient>
  );
}
