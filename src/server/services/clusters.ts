import { Priority } from '@prisma/client';
import type { NodeKind, Prisma } from '@prisma/client';

import { NotFoundError } from '../errors';
import { getDomain } from './domains';
import type { Db } from './types';

/** How many checked-off cards the board shows beneath the open tiers. */
export const RECENTLY_COMPLETED_LIMIT = 10;

export interface ClusterSummary {
  id: string;
  slug: string;
  title: string;
  position: number;
  layoutX: number | null;
  layoutY: number | null;
  openNodeCount: number;
}

/** A domain's live clusters in list order. */
export async function listClusters(db: Db, domainSlug: string): Promise<ClusterSummary[]> {
  const domain = await getDomain(db, domainSlug);
  const clusters = await db.cluster.findMany({
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
  });
  return clusters.map(({ _count, ...cluster }) => ({ ...cluster, openNodeCount: _count.nodes }));
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
  _count: { select: { notes: true, attachments: true } },
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
}

export interface ClusterBoard {
  cluster: { id: string; slug: string; title: string };
  /** Open cards by tier, each tier in board order. */
  tiers: Record<Priority, BoardNode[]>;
  /** Checked-off cards, most recently completed first. */
  recentlyCompleted: BoardNode[];
}

function toBoardNode({
  _count,
  ...node
}: Prisma.NodeGetPayload<{ select: typeof boardNodeSelect }>): BoardNode {
  return { ...node, noteCount: _count.notes, attachmentCount: _count.attachments };
}

/** The card view for one cluster. Slugs are only unique within a domain, so both are needed. */
export async function getClusterBoard(
  db: Db,
  domainSlug: string,
  clusterSlug: string,
): Promise<ClusterBoard> {
  const cluster = await db.cluster.findFirst({
    where: { slug: clusterSlug, archivedAt: null, domain: { slug: domainSlug, archivedAt: null } },
    select: { id: true, slug: true, title: true },
  });
  if (!cluster) throw new NotFoundError('Cluster', `${domainSlug}/${clusterSlug}`);

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
