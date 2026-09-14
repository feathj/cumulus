'use client';

import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

import { domainPalette, neutral } from '@/lib/palette';

/** Font stacks. The variables come from `next/font` in the root layout. */
export const sans = 'var(--font-karla), "Helvetica Neue", Arial, sans-serif';
export const serif = 'var(--font-spectral), Georgia, serif';

/** The dark theme from the mockup, with the primary colour taken from a domain's hue. */
export function createAppTheme(hue = 250): Theme {
  const palette = domainPalette(hue);
  return createTheme({
    palette: {
      mode: 'dark',
      primary: { main: palette.accent, dark: palette.border, contrastText: neutral.canvas },
      background: { default: neutral.canvas, paper: neutral.surface },
      divider: neutral.line,
      text: { primary: neutral.text, secondary: neutral.muted },
    },
    typography: {
      fontFamily: sans,
      button: { textTransform: 'none' },
    },
    shape: { borderRadius: 6 },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    },
  });
}

export const theme = createAppTheme();
