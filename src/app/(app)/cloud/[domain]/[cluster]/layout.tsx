import Box from '@mui/material/Box';
import { TRPCError } from '@trpc/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { ClusterToolbar } from './cluster-toolbar';
import { NodeDrawer } from './node-drawer';

export default async function ClusterLayout({
  children,
  params,
}: LayoutProps<'/cloud/[domain]/[cluster]'>) {
  const { domain, cluster } = await params;

  try {
    await getQueryClient().fetchQuery(
      trpc.cluster.board.queryOptions({ domainSlug: domain, clusterSlug: cluster }),
    );
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  return (
    <HydrateClient>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <ClusterToolbar domainSlug={domain} clusterSlug={cluster} />
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <Box sx={{ flex: 1, minWidth: 0, position: 'relative' }}>{children}</Box>
          {/* The drawer reads ?node= from the URL, which only exists in the browser. */}
          <Suspense fallback={null}>
            <NodeDrawer />
          </Suspense>
        </Box>
      </Box>
    </HydrateClient>
  );
}
