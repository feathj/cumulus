'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

import { neutral } from '@/lib/palette';

/** The day a Today section shows and the time zone it's read in: the `today.day` query's input. */
export interface DayInput {
  day: string;
  timeZone: string;
}

export const quietButtonSx = {
  border: `1px solid ${neutral.line}`,
  borderRadius: 0.75,
  px: 1.2,
  py: 0.45,
  fontSize: 11,
  letterSpacing: '0.03em',
  color: neutral.muted,
  '&:hover': { color: neutral.text, borderColor: neutral.lineStrong },
  '&.Mui-disabled': { opacity: 0.4 },
} as const;

/** A Today section's heading: its name, a quiet count beside it, and an action on the right. */
export function SectionTitle({
  id,
  title,
  meta,
  action,
}: {
  id: string;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25, minHeight: 30 }}>
      <Typography
        id={id}
        component="h3"
        sx={{ fontSize: 11.5, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: neutral.textSoft }}
      >
        {title}
      </Typography>
      {meta && (
        <Typography component="span" sx={{ fontSize: 10.5, letterSpacing: '0.04em', color: 'text.secondary' }}>
          {meta}
        </Typography>
      )}
      <Box sx={{ flex: 1 }} />
      {action}
    </Box>
  );
}
