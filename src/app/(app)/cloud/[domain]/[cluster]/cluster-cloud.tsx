'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { CloudCanvas } from '@/components/cloud/cloud-canvas';
import { CloudHint } from '@/components/cloud/cloud-hint';
import { orbRadiusForTier, ringRadii } from '@/components/cloud/geometry';
import type { CloudHub, CloudOrb } from '@/components/cloud/types';
import { useDomainPalette } from '@/components/domain-theme';
import { srOnlyUntilFocused } from '@/lib/a11y';
import { oklch, oklcha } from '@/lib/color';
import { plural } from '@/lib/format';
import { cardIcons } from '@/lib/icons';
import { attention, neutral } from '@/lib/palette';
import { clusterPath } from '@/lib/routes';
import { useTRPC } from '@/trpc/client';

import { MemoryPeek } from './memory-peek';
import { useNodeSelection } from './use-node-selection';

const HUB_RADIUS = 44;
const ORB_GAP = 12;
const MEMORY_ORB_ID = '__memory';

/** Each priority is a ring — now innermost — and fades as it moves outward. */
const TIERS = [
  { priority: 'NOW', baseRadius: 46, lightness: 0.74, chroma: 0.13 },
  { priority: 'NEXT', baseRadius: 40, lightness: 0.6, chroma: 0.07 },
  { priority: 'SOMEDAY', baseRadius: 34, lightness: 0.46, chroma: 0.025 },
] as const;

/** One cluster's open cards orbiting it, with its memory as one more body on the outside. */
export function ClusterCloud({ domainSlug, clusterSlug }: { domainSlug: string; clusterSlug: string }) {
  const trpc = useTRPC();
  const palette = useDomainPalette();
  const { hue } = palette;
  const { selectedId, select } = useNodeSelection();
  const input = { domainSlug, clusterSlug };
  const { data: board } = useSuspenseQuery(trpc.cluster.board.queryOptions(input));
  const { data: memory } = useSuspenseQuery(trpc.memory.clusterSummary.queryOptions(input));
  const [peekOpen, setPeekOpen] = useState(false);

  const orbs = useMemo<CloudOrb[]>(() => {
    const tiers = TIERS.map((tier) => {
      const nodes = board.tiers[tier.priority];
      return { ...tier, nodes, radius: orbRadiusForTier(tier.baseRadius, nodes.length) };
    });
    const rings = ringRadii(
      HUB_RADIUS,
      tiers.map((tier) => ({ count: tier.nodes.length, orbRadius: tier.radius })),
      ORB_GAP,
    );

    const result: CloudOrb[] = [];
    let outerEdge = HUB_RADIUS;
    tiers.forEach((tier, index) => {
      const ring = rings[index] ?? HUB_RADIUS;
      if (tier.nodes.length) outerEdge = Math.max(outerEdge, ring + tier.radius);
      for (const node of tier.nodes) {
        result.push({
          id: node.id,
          label: node.title,
          caption:
            node.kind === 'TOPIC'
              ? 'topic'
              : node.memoryCount
                ? plural(node.memoryCount, 'memory', 'memories')
                : null,
          icons: cardIcons(node),
          radius: tier.radius,
          ring,
          // Neighbouring rings drift opposite ways.
          direction: index % 2 === 0 ? 1 : -1,
          fill: oklcha(tier.lightness, tier.chroma, hue, 0.26),
          border:
            node.kind === 'TOPIC'
              ? palette.accent
              : oklcha(tier.lightness - 0.18, tier.chroma * 0.7, hue, 0.8),
          labelColor:
            tier.priority === 'SOMEDAY' ? neutral.textSoft : oklch(0.95, tier.chroma * 0.4, hue),
          captionColor: palette.accent,
          serif: true,
          bold: tier.priority === 'NOW',
        });
      }
    });

    const memoryRadius = 30 + Math.min(11, memory.activeCount);
    result.push({
      id: MEMORY_ORB_ID,
      label: String(memory.activeCount),
      caption: memory.pendingCount ? `memory · +${memory.pendingCount}` : 'memory',
      radius: memoryRadius,
      ring: outerEdge + memoryRadius + ORB_GAP * 2,
      direction: 1,
      fill: oklcha(0.29, 0.032, hue, 0.92),
      border: memory.pendingCount ? attention : oklcha(0.62, 0.1, hue, 0.95),
      labelColor: oklch(0.95, 0.05, hue),
      captionColor: memory.pendingCount ? attention : oklch(0.72, 0.04, hue),
      serif: false,
      bold: true,
    });
    return result;
  }, [board, memory, hue, palette.accent]);

  const hub = useMemo<CloudHub>(
    () => ({
      label: board.cluster.title,
      radius: HUB_RADIUS,
      fill: oklcha(0.62, 0.11, hue, 0.16),
      border: oklcha(0.46, 0.08, hue, 0.6),
      labelColor: palette.accent,
    }),
    [board.cluster.title, hue, palette.accent],
  );

  const handleOrbClick = useCallback(
    (id: string) => {
      if (id === MEMORY_ORB_ID) setPeekOpen((open) => !open);
      else select(id);
    },
    [select],
  );

  const openCards = TIERS.flatMap((tier) => board.tiers[tier.priority]);

  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <CloudCanvas
        orbs={orbs}
        hub={hub}
        tetherColor={oklcha(0.52, 0.09, hue, 0.18)}
        highlightColor={palette.accent}
        selectedId={selectedId}
        onOrbClick={handleOrbClick}
        ariaLabel={`${board.cluster.title}: ${plural(openCards.length, 'open card')}, now innermost and someday outermost`}
      />

      <Box component="ul" aria-label="Open cards" sx={srOnlyUntilFocused}>
        {openCards.map((node) => (
          <li key={node.id}>
            <ButtonBase onClick={() => select(node.id)}>{node.title}</ButtonBase>
          </li>
        ))}
        <li>
          <ButtonBase onClick={() => setPeekOpen(true)}>Cluster memory</ButtonBase>
        </li>
      </Box>

      {openCards.length === 0 && (
        <Typography
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 48,
            textAlign: 'center',
            color: 'text.secondary',
            fontSize: 13,
          }}
        >
          No open cards in this cluster.
        </Typography>
      )}

      {peekOpen && (
        <MemoryPeek
          summary={memory}
          memoryHref={clusterPath(domainSlug, clusterSlug, 'memory')}
          onClose={() => setPeekOpen(false)}
        />
      )}

      <CloudHint>inner ring = now · outer = someday · drag to fling · scroll to zoom</CloudHint>
    </Box>
  );
}
