'use client';

import { createTheme } from '@mui/material/styles';

/**
 * Light and dark schemes as CSS variables, following the OS setting. Each
 * domain's palette will be derived from its `themeHue` on top of this.
 */
export const theme = createTheme({
  cssVariables: true,
  colorSchemes: { light: true, dark: true },
});
