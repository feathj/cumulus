import { notFound } from 'next/navigation';

import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

import { DomainFrame } from './domain-frame';

export default async function DomainLayout({ children, params }: LayoutProps<'/cloud/[domain]'>) {
  const { domain } = await params;

  const domains = await getQueryClient().fetchQuery(trpc.domain.list.queryOptions());
  if (!domains.some((d) => d.slug === domain)) notFound();

  return (
    <HydrateClient>
      <DomainFrame domainSlug={domain}>{children}</DomainFrame>
    </HydrateClient>
  );
}
