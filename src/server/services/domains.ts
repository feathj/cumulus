import { NotFoundError } from '../errors';
import type { Db } from './types';

export interface DomainRef {
  id: string;
  slug: string;
  title: string;
  themeHue: number;
}

export interface DomainSummary extends DomainRef {
  /** Clusters that aren't archived. */
  clusterCount: number;
  /** Open cards across those clusters. */
  openNodeCount: number;
  focusCount: number;
  /** Captures still waiting to be filed or discarded. */
  inboxCount: number;
}

/** Every live domain in switcher order, with the counts a domain tab shows. */
export async function listDomains(db: Db): Promise<DomainSummary[]> {
  const domains = await db.domain.findMany({
    where: { archivedAt: null },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      slug: true,
      title: true,
      themeHue: true,
      _count: {
        select: {
          clusters: { where: { archivedAt: null } },
          focusItems: true,
          inboxItems: { where: { filedAt: null, discardedAt: null } },
        },
      },
    },
  });

  // `_count` can't reach through clusters to their nodes, so open cards are
  // counted per domain. There are only ever a handful of domains.
  return Promise.all(
    domains.map(async ({ _count, ...domain }) => ({
      ...domain,
      clusterCount: _count.clusters,
      focusCount: _count.focusItems,
      inboxCount: _count.inboxItems,
      openNodeCount: await db.node.count({
        where: { completedAt: null, cluster: { domainId: domain.id, archivedAt: null } },
      }),
    })),
  );
}

export async function getDomain(db: Db, slug: string): Promise<DomainRef> {
  const domain = await db.domain.findFirst({
    where: { slug, archivedAt: null },
    select: { id: true, slug: true, title: true, themeHue: true },
  });
  if (!domain) throw new NotFoundError('Domain', slug);
  return domain;
}
