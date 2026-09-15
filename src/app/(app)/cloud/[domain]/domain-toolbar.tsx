'use client';

import Typography from '@mui/material/Typography';
import { useSuspenseQuery } from '@tanstack/react-query';

import { plural } from '@/lib/format';
import { cloudPath } from '@/lib/routes';
import { useTRPC } from '@/trpc/client';

import { CloudToolbar, CloudTrail } from '../cloud-trail';

/** The way back up to the whole cloud, the domain's name, and what's in it. */
export function DomainToolbar({ domainSlug }: { domainSlug: string }) {
  const trpc = useTRPC();
  const { data: domains } = useSuspenseQuery(trpc.domain.list.queryOptions());
  const domain = domains.find((d) => d.slug === domainSlug);
  if (!domain) return null;

  const meta = [
    plural(domain.openNodeCount, 'open card'),
    plural(domain.clusterCount, 'cluster'),
    ...(domain.pendingMemoryCount
      ? [`${plural(domain.pendingMemoryCount, 'memory', 'memories')} to review`]
      : []),
  ].join(' · ');

  return (
    <CloudToolbar>
      <CloudTrail steps={[{ label: 'Cloud', href: cloudPath }]} current={domain.title} />
      <Typography sx={{ fontSize: 10, letterSpacing: '0.06em', color: 'text.secondary' }}>{meta}</Typography>
    </CloudToolbar>
  );
}
