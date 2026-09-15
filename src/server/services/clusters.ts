import { MemoryEntryStatus, Priority } from '@prisma/client';
import type { NodeKind, Prisma } from '@prisma/client';

import { findUrls, hasProse, linkKind } from '@/lib/card-links';
import type { LinkKind } from '@/lib/card-links';
import { slugify, uniqueSlug } from '@/lib/slug';

import { DomainError, NotFoundError } from '../errors';
import { getDomain } from './domains';
import { withTransaction } from './types';
import type { Db } from './types';

/** How many checked-off cards the board shows beneath the open tiers. */
export const RECENTLY_COMPLETED_LIMIT = 10;

/** How many archived cards the board offers to restore. */
export const ARCHIVED_LIMIT = 20;

export interface ClusterRef {
  id: string;
  slug: string;
  title: string;
}

export interface MemoryStats {
  activeCount: number;
  pendingCount: number;
  /** Total times the active entries have been pulled into agent context. */
  recallCount: number;
}

export interface ClusterSummary extends ClusterRef {
  position: number;
  layoutX: number | null;
  layoutY: number | null;
  openNodeCount: number;
  /** Memory owned by the cluster or any of its nodes. */
  memory: MemoryStats;
}

/** A live cluster by its slugs. Slugs are only unique within a domain, so both are needed. */
export async function getCluster(
  db: Db,
  domainSlug: string,
  clusterSlug: string,
): Promise<ClusterRef> {
  const cluster = await db.cluster.findFirst({
    where: { slug: clusterSlug, archivedAt: null, domain: { slug: domainSlug, archivedAt: null } },
    select: { id: true, slug: true, title: true },
  });
  if (!cluster) throw new NotFoundError('Cluster', `${domainSlug}/${clusterSlug}`);
  return cluster;
}

/** A domain's live clusters in list order. */
export async function listClusters(db: Db, domainSlug: string): Promise<ClusterSummary[]> {
  const domain = await getDomain(db, domainSlug);
  const [clusters, entries] = await Promise.all([
    db.cluster.findMany({
      where: { domainId: domain.id, archivedAt: null },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        position: true,
        layoutX: true,
        layoutY: true,
        _count: { select: { nodes: { where: { completedAt: null, archivedAt: null } } } },
      },
    }),
    db.memoryEntry.findMany({
      where: {
        status: { in: [MemoryEntryStatus.ACTIVE, MemoryEntryStatus.PENDING] },
        OR: [{ cluster: { domainId: domain.id } }, { node: { cluster: { domainId: domain.id } } }],
      },
      select: {
        status: true,
        recallCount: true,
        clusterId: true,
        node: { select: { clusterId: true } },
      },
    }),
  ]);

  const stats = new Map<string, MemoryStats>();
  for (const entry of entries) {
    const clusterId = entry.clusterId ?? entry.node?.clusterId;
    if (!clusterId) continue;
    const cluster = stats.get(clusterId) ?? { activeCount: 0, pendingCount: 0, recallCount: 0 };
    if (entry.status === MemoryEntryStatus.PENDING) {
      cluster.pendingCount++;
    } else {
      cluster.activeCount++;
      cluster.recallCount += entry.recallCount;
    }
    stats.set(clusterId, cluster);
  }

  return clusters.map(({ _count, ...cluster }) => ({
    ...cluster,
    openNodeCount: _count.nodes,
    memory: stats.get(cluster.id) ?? { activeCount: 0, pendingCount: 0, recallCount: 0 },
  }));
}

const boardNodeSelect = {
  id: true,
  kind: true,
  title: true,
  description: true,
  priority: true,
  position: true,
  completedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  // Links only. Files uploaded to Trello arrive as URLs too, but with a MIME type.
  attachments: { where: { url: { not: null }, mimeType: null }, select: { url: true } },
  _count: {
    select: {
      notes: true,
      attachments: true,
      memoryEntries: { where: { status: MemoryEntryStatus.ACTIVE } },
    },
  },
} satisfies Prisma.NodeSelect;

export interface BoardNode {
  id: string;
  kind: NodeKind;
  title: string;
  description: string | null;
  priority: Priority;
  position: number;
  completedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  noteCount: number;
  attachmentCount: number;
  /** Active memory entries owned by this card. */
  memoryCount: number;
  /** Whether the description says something besides the links in it. */
  hasText: boolean;
  /** The kind of link in the description or link attachments; `youtube` if any is a video. */
  link: LinkKind | null;
}

export interface ClusterBoard {
  cluster: ClusterRef;
  /** Open cards by tier, each tier in board order. */
  tiers: Record<Priority, BoardNode[]>;
  /** Checked-off cards, most recently completed first. */
  recentlyCompleted: BoardNode[];
  /** Archived cards, most recently archived first. */
  archived: BoardNode[];
}

function toBoardNode({
  _count,
  attachments,
  ...node
}: Prisma.NodeGetPayload<{ select: typeof boardNodeSelect }>): BoardNode {
  return {
    ...node,
    hasText: hasProse(node.description),
    link: linkKind([
      ...findUrls(node.description ?? ''),
      ...attachments.flatMap((attachment) => (attachment.url ? [attachment.url] : [])),
    ]),
    noteCount: _count.notes,
    attachmentCount: _count.attachments,
    memoryCount: _count.memoryEntries,
  };
}

/** The card view for one cluster. */
export async function getClusterBoard(
  db: Db,
  domainSlug: string,
  clusterSlug: string,
): Promise<ClusterBoard> {
  const cluster = await getCluster(db, domainSlug, clusterSlug);

  const [open, completed, archived] = await Promise.all([
    db.node.findMany({
      where: { clusterId: cluster.id, completedAt: null, archivedAt: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: boardNodeSelect,
    }),
    db.node.findMany({
      where: { clusterId: cluster.id, completedAt: { not: null }, archivedAt: null },
      orderBy: { completedAt: 'desc' },
      take: RECENTLY_COMPLETED_LIMIT,
      select: boardNodeSelect,
    }),
    db.node.findMany({
      where: { clusterId: cluster.id, archivedAt: { not: null } },
      orderBy: { archivedAt: 'desc' },
      take: ARCHIVED_LIMIT,
      select: boardNodeSelect,
    }),
  ]);

  const tiers: Record<Priority, BoardNode[]> = {
    [Priority.NOW]: [],
    [Priority.NEXT]: [],
    [Priority.SOMEDAY]: [],
  };
  for (const node of open) tiers[node.priority].push(toBoardNode(node));

  return {
    cluster,
    tiers,
    recentlyCompleted: completed.map((node) => toBoardNode(node)),
    archived: archived.map((node) => toBoardNode(node)),
  };
}

/**
 * Domain-level routes a cluster slug would be hidden behind: a cluster at
 * `/personal/inbox` would never be reachable, because the inbox is there.
 */
const RESERVED_SLUGS = ['inbox', 'focus', 'journal'];

/**
 * A new, empty cluster at the end of its domain, with a slug made from its
 * name. Names are unique within a domain regardless of case, and archived
 * clusters keep theirs, so reusing one is refused rather than silently renamed.
 */
export async function createCluster(
  db: Db,
  { domainSlug, title }: { domainSlug: string; title: string },
): Promise<ClusterRef> {
  const name = title.trim().replace(/\s+/g, ' ');
  if (!name) throw new DomainError('BAD_REQUEST', 'A cluster needs a name.');

  return withTransaction(db, async (tx) => {
    const domain = await getDomain(tx, domainSlug);
    const existing = await tx.cluster.findMany({
      where: { domainId: domain.id },
      select: { slug: true, title: true, position: true, archivedAt: true },
    });

    const clash = existing.find((cluster) => cluster.title.toLowerCase() === name.toLowerCase());
    if (clash) {
      throw new DomainError(
        'CONFLICT',
        clash.archivedAt
          ? `An archived cluster is already called "${clash.title}".`
          : `There's already a cluster called "${clash.title}".`,
      );
    }

    const taken = new Set([...RESERVED_SLUGS, ...existing.map((cluster) => cluster.slug)]);
    return tx.cluster.create({
      data: {
        domainId: domain.id,
        slug: uniqueSlug(slugify(name, 'cluster'), taken),
        title: name,
        position: Math.max(-1, ...existing.map((cluster) => cluster.position)) + 1,
      },
      select: { id: true, slug: true, title: true },
    });
  });
}

/**
 * Puts a whole cluster away: it leaves the domain cloud and every count, and
 * its cards leave the focus block. Cards, notes and memory are kept, so it can
 * be restored. Archiving an archived cluster changes nothing.
 */
export async function archiveCluster(db: Db, id: string): Promise<void> {
  await withTransaction(db, async (tx) => {
    const cluster = await tx.cluster.findUnique({ where: { id }, select: { archivedAt: true } });
    if (!cluster) throw new NotFoundError('Cluster', id);
    if (cluster.archivedAt) return;

    await tx.cluster.update({ where: { id }, data: { archivedAt: new Date() } });
    await tx.focusItem.deleteMany({ where: { node: { clusterId: id } } });
  });
}

/** Brings an archived cluster back where it was in the domain. Its cards don't rejoin the focus block. */
export async function restoreCluster(db: Db, id: string): Promise<void> {
  const cluster = await db.cluster.findUnique({ where: { id }, select: { archivedAt: true } });
  if (!cluster) throw new NotFoundError('Cluster', id);
  if (!cluster.archivedAt) return;
  await db.cluster.update({ where: { id }, data: { archivedAt: null } });
}

/** Most cards per cluster the domain cloud rotates through inside its orb. */
export const CELL_POOL_LIMIT = 60;

export interface ClusterCells {
  clusterId: string;
  cards: { id: string; title: string; priority: Priority }[];
}

/**
 * Open cards to drift inside each cluster's orb in the domain cloud. Now comes
 * first, so when a cluster has more cards than the limit the pool leans toward
 * what's current. Clusters without open cards are left out.
 */
export async function listClusterCells(db: Db, domainSlug: string): Promise<ClusterCells[]> {
  const domain = await getDomain(db, domainSlug);
  const nodes = await db.node.findMany({
    where: {
      completedAt: null,
      archivedAt: null,
      cluster: { domainId: domain.id, archivedAt: null },
    },
    // Priority sorts in its declared order: now, next, someday.
    orderBy: [{ priority: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, title: true, priority: true, clusterId: true },
  });

  const byCluster = new Map<string, ClusterCells>();
  for (const { clusterId, ...card } of nodes) {
    const entry = byCluster.get(clusterId) ?? { clusterId, cards: [] };
    if (entry.cards.length < CELL_POOL_LIMIT) entry.cards.push(card);
    byCluster.set(clusterId, entry);
  }
  return [...byCluster.values()];
}
