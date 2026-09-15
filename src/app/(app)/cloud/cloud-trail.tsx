'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { useDomainPalette } from '@/components/domain-theme';
import { neutral } from '@/lib/palette';

export interface TrailStep {
  label: string;
  href: string;
}

/** The bar across the top of a cloud level: the trail back up, then whatever that level adds. */
export function CloudToolbar({ children }: { children: ReactNode }) {
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
      {children}
    </Box>
  );
}

/** Where you are in the cloud: links back up through each level, then this level as the heading. */
export function CloudTrail({ steps, current }: { steps: TrailStep[]; current: string }) {
  const palette = useDomainPalette();

  return (
    <Box component="nav" aria-label="Breadcrumb" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      {steps.map((step) => (
        <Box key={step.href} component="span" sx={{ display: 'contents' }}>
          <ButtonBase
            component={Link}
            href={step.href}
            sx={{
              fontSize: 12,
              color: neutral.muted,
              borderRadius: 0.5,
              px: 0.5,
              py: 0.25,
              '&:hover': { color: neutral.text },
            }}
          >
            {step.label}
          </ButtonBase>
          <Typography component="span" aria-hidden sx={{ fontSize: 12, color: neutral.lineStrong }}>
            /
          </Typography>
        </Box>
      ))}
      <Typography
        component="h2"
        aria-current="page"
        sx={{
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: palette.accent,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {current}
      </Typography>
    </Box>
  );
}
