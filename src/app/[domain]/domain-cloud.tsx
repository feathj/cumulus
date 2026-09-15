'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Priority } from '@prisma/client';
import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { CloudCanvas } from '@/components/cloud/cloud-canvas';
import { hash01, singleRingRadius } from '@/components/cloud/geometry';
import type { CloudHub, CloudOrb } from '@/components/cloud/types';
import { useDomainPalette } from '@/components/domain-theme';
import { srOnlyUntilFocused } from '@/lib/a11y';
import { oklch, oklcha } from '@/lib/color';
import { plural } from '@/lib/format';
import { attention } from '@/lib/palette';
import type { MemoryStats } from '@/server/services/clusters';
import { useTRPC } from '@/trpc/client';

import { NewClusterButton } from './new-cluster-button';

const HUB_RADIUS = 54;
const ORB_GAP = 16;

/** Cells drifting inside a cluster: cards up now are the biggest, someday cards the smallest. */
const CELL_SCALE: Record<Priority, number> = { NOW: 1.6, NEXT: 1, SOMEDAY: 0.6 };

/** Bigger clusters make bigger orbs, on a gentle curve so one huge list doesn't dwarf the rest. */
function clusterRadius(openCards: number, fewest: number, most: number): number {
  if (most <= fewest) return 56;
  return 36 + 42 * ((openCards - fewest) / (most - fewest)) ** 0.8;
}

function memoryCaption(memory: MemoryStats): string | null {
  if (!memory.activeCount && !memory.pendingCount) return null;
  const kept = memory.activeCount ? plural(memory.activeCount, 'memory', 'memories') : 'memory';
  return memory.pendingCount ? `${kept} · +${memory.pendingCount}` : kept;
}

/** A domain's clusters orbiting the domain itself. */
export function DomainCloud({ domainSlug }: { domainSlug: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const palette = useDomainPalette();
  const { hue } = palette;
  const { data: clusters } = useSuspenseQuery(trpc.cluster.list.queryOptions({ domainSlug }));
  const { data: domains } = useSuspenseQuery(trpc.domain.list.queryOptions());
  const { data: cellPools } = useSuspenseQuery(trpc.cluster.cells.queryOptions({ domainSlug }));
  const title = domains.find((d) => d.slug === domainSlug)?.title ?? domainSlug;

  const orbs = useMemo<CloudOrb[]>(() => {
    if (!clusters.length) return [];
    const counts = clusters.map((cluster) => cluster.openNodeCount);
    const fewest = Math.min(...counts);
    const most = Math.max(...counts);
    const radii = clusters.map((cluster) => clusterRadius(cluster.openNodeCount, fewest, most));
    const ring = singleRingRadius(HUB_RADIUS, radii, ORB_GAP);
    const pools = new Map(cellPools.map((entry) => [entry.clusterId, entry.cards]));

    return clusters.map((cluster, index) => ({
      id: cluster.slug,
      label: cluster.title,
      caption: memoryCaption(cluster.memory),
      cells: (pools.get(cluster.id) ?? []).map((card) => ({
        id: card.id,
        label: card.title,
        scale: CELL_SCALE[card.priority],
      })),
      radius: radii[index] ?? 56,
      // A little spread in and out, so the ring reads as a cloud.
      ring: ring * (0.9 + 0.2 * hash01(cluster.slug)),
      direction: hash01(`${cluster.slug}~orbit`) > 0.5 ? -1 : 1,
      fill: oklcha(0.7, 0.13, hue, 0.2),
      border: oklcha(0.5, 0.08, hue, 0.75),
      labelColor: oklch(0.92, 0.05, hue),
      captionColor: cluster.memory.pendingCount ? attention : oklch(0.76, 0.06, hue),
      serif: true,
      bold: true,
    }));
  }, [clusters, cellPools, hue]);

  const hub = useMemo<CloudHub>(
    () => ({
      label: title,
      radius: HUB_RADIUS,
      fill: oklcha(0.62, 0.11, hue, 0.16),
      border: oklcha(0.46, 0.08, hue, 0.6),
      labelColor: palette.accent,
    }),
    [title, hue, palette.accent],
  );

  const openCluster = useCallback(
    (clusterSlug: string) => router.push(`/${domainSlug}/${clusterSlug}`),
    [router, domainSlug],
  );

  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {clusters.length > 0 ? (
        <CloudCanvas
          orbs={orbs}
          hub={hub}
          motion="float"
          tetherColor={oklcha(0.52, 0.09, hue, 0.3)}
          highlightColor={palette.accent}
          selectedId={null}
          onOrbClick={openCluster}
          ariaLabel={`${title}: ${plural(clusters.length, 'cluster')} orbiting the domain`}
        />
      ) : (
        <Typography sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
          No clusters in {title} yet. Add one with the + below.
        </Typography>
      )}

      <Box component="ul" aria-label="Clusters" sx={srOnlyUntilFocused}>
        {clusters.map((cluster) => (
          <li key={cluster.id}>
            <Link href={`/${domainSlug}/${cluster.slug}`}>{cluster.title}</Link>
          </li>
        ))}
      </Box>

      <NewClusterButton domainSlug={domainSlug} />
    </Box>
  );
}
