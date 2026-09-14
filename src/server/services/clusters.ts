import { MemoryEntryStatus, Priority } from '@prisma/client';
import type { NodeKind, Prisma } from '@prisma/client';

import { NotFoundError } from '../errors';
import { getDomain } from './domains';
import type { Db } from './types';

/** How many checked-off cards the board shows beneath the open tiers. */
export const RECENTLY_COMPLETED_LIMIT = 10;

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
        _count: { select: { nodes: { where: { completedAt: null } } } },
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
  createdAt: true,
  updatedAt: true,
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
  createdAt: Date;
  updatedAt: Date;
  noteCount: number;
  attachmentCount: number;
  /** Active memory entries owned by this card. */
  memoryCount: number;
}

export interface ClusterBoard {
  cluster: ClusterRef;
  /** Open cards by tier, each tier in board order. */
  tiers: Record<Priority, BoardNode[]>;
  /** Checked-off cards, most recently completed first. */
  recentlyCompleted: BoardNode[];
}

function toBoardNode({
  _count,
  ...node
}: Prisma.NodeGetPayload<{ select: typeof boardNodeSelect }>): BoardNode {
  return {
    ...node,
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

  const [open, completed] = await Promise.all([
    db.node.findMany({
      where: { clusterId: cluster.id, completedAt: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: boardNodeSelect,
    }),
    db.node.findMany({
      where: { clusterId: cluster.id, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: RECENTLY_COMPLETED_LIMIT,
      select: boardNodeSelect,
    }),
  ]);

  const tiers: Record<Priority, BoardNode[]> = {
    [Priority.NOW]: [],
    [Priority.NEXT]: [],
    [Priority.SOMEDAY]: [],
  };
  for (const node of open) tiers[node.priority].push(toBoardNode(node));

  return { cluster, tiers, recentlyCompleted: completed.map((node) => toBoardNode(node)) };
}
