'use client';

import Box from '@mui/material/Box';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { DomainTheme } from '@/components/domain-theme';
import { useTRPC } from '@/trpc/client';

/** Everything inside one domain, in that domain's colours. */
export function DomainFrame({ domainSlug, children }: { domainSlug: string; children: ReactNode }) {
  const trpc = useTRPC();
  const { data: domains } = useSuspenseQuery(trpc.domain.list.queryOptions());
  const domain = domains.find((d) => d.slug === domainSlug);
  // The layout has already 404'd an unknown slug.
  if (!domain) return null;

  return (
    <DomainTheme hue={domain.themeHue}>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>{children}</Box>
    </DomainTheme>
  );
}
