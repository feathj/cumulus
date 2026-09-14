'use client';

import { ThemeProvider } from '@mui/material/styles';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { createAppTheme } from '@/app/theme';
import { domainPalette } from '@/lib/palette';
import type { DomainPalette } from '@/lib/palette';

const DomainPaletteContext = createContext<DomainPalette>(domainPalette(250));

/** The current domain's colours, for things MUI doesn't theme — canvas drawing, glows. */
export function useDomainPalette(): DomainPalette {
  return useContext(DomainPaletteContext);
}

/** Re-themes everything inside a domain around its hue. */
export function DomainTheme({ hue, children }: { hue: number; children: ReactNode }) {
  const palette = useMemo(() => domainPalette(hue), [hue]);
  const theme = useMemo(() => createAppTheme(hue), [hue]);

  return (
    <DomainPaletteContext value={palette}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </DomainPaletteContext>
  );
}
