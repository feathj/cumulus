import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { DomainShell } from './domain-shell';

export default async function DomainLayout({ children, params }: LayoutProps<'/[domain]'>) {
  // Everything under a domain reads live data.
  await connection();
  const { domain } = await params;

  const domains = await getQueryClient().fetchQuery(trpc.domain.list.queryOptions());
  if (!domains.some((d) => d.slug === domain)) notFound();

  return (
    <HydrateClient>
      <DomainShell domainSlug={domain}>{children}</DomainShell>
    </HydrateClient>
  );
}
