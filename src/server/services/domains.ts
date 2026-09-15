import { MemoryEntryStatus } from '@prisma/client';

import { NotFoundError } from '../errors';
import { entriesInDomain } from './scope';
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
  /** Open, unarchived cards across those clusters. */
  openNodeCount: number;
  focusCount: number;
  /** Agent-written memory anywhere in the domain, waiting for review. */
  pendingMemoryCount: number;
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
          // Checked-off cards linger in the queue for the day they were done.
          focusItems: { where: { node: { completedAt: null, archivedAt: null } } },
        },
      },
    },
  });

  // `_count` can't reach through clusters to their nodes or memory, so those
  // are counted per domain. There are only ever a handful of domains.
  return Promise.all(
    domains.map(async ({ _count, ...domain }) => ({
      ...domain,
      clusterCount: _count.clusters,
      focusCount: _count.focusItems,
      openNodeCount: await db.node.count({
        where: {
          completedAt: null,
          archivedAt: null,
          cluster: { domainId: domain.id, archivedAt: null },
        },
      }),
      pendingMemoryCount: await db.memoryEntry.count({
        where: { ...entriesInDomain(domain.id), status: MemoryEntryStatus.PENDING },
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

export interface CloudCluster {
  id: string;
  slug: string;
  title: string;
  openNodeCount: number;
}

export interface DomainCloudEntry extends DomainSummary {
  /** Live clusters in list order: the cells drifting inside the domain's orb, and the targets for filing. */
  clusters: CloudCluster[];
}

/** Every live domain with its live clusters, for the top-level cloud and for filing from the inbox. */
export async function listDomainCloud(db: Db): Promise<DomainCloudEntry[]> {
  const [domains, clusters] = await Promise.all([
    listDomains(db),
    db.cluster.findMany({
      where: { archivedAt: null, domain: { archivedAt: null } },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        domainId: true,
        _count: { select: { nodes: { where: { completedAt: null, archivedAt: null } } } },
      },
    }),
  ]);

  const byDomain = new Map<string, CloudCluster[]>();
  for (const cluster of clusters) {
    const list = byDomain.get(cluster.domainId) ?? [];
    list.push({
      id: cluster.id,
      slug: cluster.slug,
      title: cluster.title,
      openNodeCount: cluster._count.nodes,
    });
    byDomain.set(cluster.domainId, list);
  }
  return domains.map((domain) => ({ ...domain, clusters: byDomain.get(domain.id) ?? [] }));
}
