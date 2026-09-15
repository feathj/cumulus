'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { CloudCanvas } from '@/components/cloud/cloud-canvas';
import { hash01, singleRingRadius } from '@/components/cloud/geometry';
import type { CloudCell, CloudHub, CloudOrb } from '@/components/cloud/types';
import { useDomainPalette } from '@/components/domain-theme';
import { srOnlyUntilFocused } from '@/lib/a11y';
import { oklch, oklcha } from '@/lib/color';
import { plural } from '@/lib/format';
import { attention } from '@/lib/palette';
import { domainPath } from '@/lib/routes';
import type { DomainCloudEntry } from '@/server/services/domains';
import { useTRPC } from '@/trpc/client';

const HUB_RADIUS = 50;
const ORB_GAP = 22;

/** Busier domains make bigger orbs, on a gentle curve. Domains are the biggest bodies in the app. */
function domainRadius(openCards: number, fewest: number, most: number): number {
  if (most <= fewest) return 84;
  return 64 + 44 * ((openCards - fewest) / (most - fewest)) ** 0.8;
}

/** A domain's clusters as cells inside its orb, bigger for clusters with more open cards. */
function clusterCells(domain: DomainCloudEntry): CloudCell[] {
  const most = Math.max(1, ...domain.clusters.map((cluster) => cluster.openNodeCount));
  return domain.clusters.map((cluster) => ({
    id: cluster.id,
    label: cluster.title,
    scale: 0.6 + Math.sqrt(cluster.openNodeCount / most),
  }));
}

/** The whole app at a glance: each domain in its own colour, with its clusters drifting inside. */
export function TopCloud() {
  const trpc = useTRPC();
  const router = useRouter();
  const palette = useDomainPalette();
  const { data: domains } = useSuspenseQuery(trpc.domain.cloud.queryOptions());

  const orbs = useMemo<CloudOrb[]>(() => {
    if (!domains.length) return [];
    const counts = domains.map((domain) => domain.openNodeCount);
    const fewest = Math.min(...counts);
    const most = Math.max(...counts);
    const radii = domains.map((domain) => domainRadius(domain.openNodeCount, fewest, most));
    const ring = singleRingRadius(HUB_RADIUS, radii, ORB_GAP);

    return domains.map((domain, index) => {
      const hue = domain.themeHue;
      return {
        id: domain.slug,
        label: domain.title,
        caption: domain.pendingMemoryCount ? `${domain.pendingMemoryCount} to review` : null,
        cells: clusterCells(domain),
        radius: radii[index] ?? 84,
        ring: ring * (0.92 + 0.16 * hash01(domain.slug)),
        direction: 1,
        fill: oklcha(0.7, 0.13, hue, 0.2),
        border: oklcha(0.55, 0.1, hue, 0.8),
        labelColor: oklch(0.93, 0.06, hue),
        captionColor: domain.pendingMemoryCount ? attention : oklch(0.78, 0.07, hue),
        serif: true,
        bold: true,
      };
    });
  }, [domains]);

  const hub = useMemo<CloudHub>(
    () => ({
      label: 'Cumulus',
      radius: HUB_RADIUS,
      fill: oklcha(0.62, 0.05, palette.hue, 0.14),
      border: oklcha(0.46, 0.04, palette.hue, 0.6),
      labelColor: palette.accent,
    }),
    [palette.hue, palette.accent],
  );

  const openDomain = useCallback((domainSlug: string) => router.push(domainPath(domainSlug)), [router]);

  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {domains.length > 0 ? (
        <CloudCanvas
          orbs={orbs}
          hub={hub}
          motion="float"
          tetherColor={oklcha(0.52, 0.04, palette.hue, 0.28)}
          highlightColor={palette.accent}
          selectedId={null}
          onOrbClick={openDomain}
          ariaLabel={`${plural(domains.length, 'domain')}, each with its clusters inside`}
        />
      ) : (
        <Typography
          sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'text.secondary' }}
        >
          <span>
            No domains yet. Run <code>npm run db:import</code> or <code>npm run db:seed</code>.
          </span>
        </Typography>
      )}

      <Box component="ul" aria-label="Domains" sx={srOnlyUntilFocused}>
        {domains.map((domain) => (
          <li key={domain.id}>
            <Link href={domainPath(domain.slug)}>{domain.title}</Link>
          </li>
        ))}
      </Box>
    </Box>
  );
}
