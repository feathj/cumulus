'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useDomainPalette } from '@/components/domain-theme';
import { SegmentGroup, segmentSx } from '@/components/segmented';
import { plural } from '@/lib/format';
import { neutral } from '@/lib/palette';
import { useTRPC } from '@/trpc/client';

/** Back to the domain, the cluster's name, and its three views. */
export function ClusterToolbar({ domainSlug, clusterSlug }: { domainSlug: string; clusterSlug: string }) {
  const trpc = useTRPC();
  const pathname = usePathname();
  const palette = useDomainPalette();
  const { data: board } = useSuspenseQuery(
    trpc.cluster.board.queryOptions({ domainSlug, clusterSlug }),
  );

  const base = `/${domainSlug}/${clusterSlug}`;
  const views = [
    { label: 'Cloud', href: base },
    { label: 'Cards', href: `${base}/cards` },
    { label: 'Memory', href: `${base}/memory` },
  ];
  const openCards = board.tiers.NOW.length + board.tiers.NEXT.length + board.tiers.SOMEDAY.length;

  return (
    <Box
      sx={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        flexWrap: 'wrap',
        px: 2.75,
        py: 1.4,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <ButtonBase
        component={Link}
        href={`/${domainSlug}`}
        sx={{
          border: `1px solid ${neutral.lineStrong}`,
          bgcolor: neutral.raised,
          color: neutral.textSoft,
          borderRadius: 1,
          px: 1.5,
          py: 0.85,
          fontSize: 12,
          '&:hover': { borderColor: neutral.muted },
        }}
      >
        ← map
      </ButtonBase>
      <Typography
        component="h2"
        sx={{
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: palette.accent,
        }}
      >
        {board.cluster.title}
      </Typography>
      <SegmentGroup label="Cluster views">
        {views.map((view) => {
          const active = pathname === view.href;
          return (
            <ButtonBase
              key={view.href}
              component={Link}
              href={view.href}
              aria-current={active ? 'page' : undefined}
              sx={segmentSx(active, palette)}
            >
              {view.label}
            </ButtonBase>
          );
        })}
      </SegmentGroup>
      <Typography sx={{ fontSize: 10, letterSpacing: '0.06em', color: 'text.secondary' }}>
        {plural(openCards, 'open card')} · read-only prototype
      </Typography>
    </Box>
  );
}
