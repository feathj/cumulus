'use client';

import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

/** The quiet instructions in the corner of a cloud. */
export function CloudHint({ children }: { children: ReactNode }) {
  return (
    <Typography
      aria-hidden
      sx={{
        position: 'absolute',
        right: 20,
        bottom: 16,
        fontSize: 10,
        letterSpacing: '0.07em',
        color: 'text.secondary',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {children}
    </Typography>
  );
}
