'use client';

import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { oklch } from '@/lib/color';
import type { DomainPalette } from '@/lib/palette';
import { neutral } from '@/lib/palette';

/** The pill that holds a row of segment buttons or links. */
export function SegmentGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{
        display: 'flex',
        gap: '3px',
        p: '3px',
        bgcolor: neutral.surface,
        border: `1px solid ${neutral.line}`,
        borderRadius: 1.25,
      }}
    >
      {children}
    </Box>
  );
}

/** Styles for one segment. Works on a ButtonBase rendered as a button or a link. */
export function segmentSx(active: boolean, palette: DomainPalette) {
  return {
    borderRadius: 0.75,
    px: 1.4,
    py: 0.65,
    fontSize: 11,
    letterSpacing: '0.06em',
    bgcolor: active ? palette.soft : 'transparent',
    color: active ? palette.accent : oklch(0.633, 0.012, 265),
    transition: 'background-color 140ms ease, color 140ms ease',
    '&:hover': { color: active ? palette.accent : neutral.text },
  } as const;
}
