import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import type { Metadata } from 'next';
import { Karla, Spectral } from 'next/font/google';
import type { ReactNode } from 'react';

import { TRPCReactProvider } from '@/trpc/client';

import { theme } from './theme';

const karla = Karla({ subsets: ['latin'], variable: '--font-karla', display: 'swap' });

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-spectral',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cumulus',
  description: 'Work, journaling and LLM memory in one place.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${karla.variable} ${spectral.variable}`}>
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <GlobalStyles styles={{ 'html, body': { height: '100%' }, body: { overflow: 'hidden' } }} />
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
