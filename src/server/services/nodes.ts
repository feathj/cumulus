import { MemoryEntryStatus } from '@prisma/client';
import type { AuthorKind, MemoryEntryType, NodeKind, Prisma, Priority } from '@prisma/client';

import { DomainError, NotFoundError } from '../errors';
import { withTransaction } from './types';
import type { Db } from './types';

export interface NodeDetail {
  id: string;
  kind: NodeKind;
  title: string;
  description: string | null;
  priority: Priority;
  completedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cluster: { slug: string; title: string };
  domain: { slug: string; title: string };
  /** Newest first. */
  notes: { id: string; body: string; author: AuthorKind; occurredAt: Date }[];
  attachments: {
    id: string;
    name: string;
    url: string | null;
    mimeType: string | null;
    byteSize: number | null;
    description: string | null;
  }[];
  /** Active and pending memory owned by this card, most recently changed first. */
  memory: {
    id: string;
    type: MemoryEntryType;
    status: MemoryEntryStatus;
    title: string;
    description: string;
    recallCount: number;
  }[];
  /** Whether the card sits in its domain's focus block. */
  inFocus: boolean;
}

/** Everything the card detail panel shows. Archived cards can still be opened. */
export async function getNodeDetail(db: Db, id: string): Promise<NodeDetail> {
  const node = await db.node.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      title: true,
      description: true,
      priority: true,
      completedAt: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      cluster: {
        select: { slug: true, title: true, domain: { select: { slug: true, title: true } } },
      },
      notes: {
        orderBy: { occurredAt: 'desc' },
        select: { id: true, body: true, author: true, occurredAt: true },
      },
      attachments: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          url: true,
          mimeType: true,
          byteSize: true,
          description: true,
        },
      },
      memoryEntries: {
        where: { status: { in: [MemoryEntryStatus.ACTIVE, MemoryEntryStatus.PENDING] } },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          type: true,
          status: true,
          title: true,
          description: true,
          recallCount: true,
        },
      },
      _count: { select: { focusItems: true } },
    },
  });
  if (!node) throw new NotFoundError('Node', id);

  const { cluster, memoryEntries, _count, ...rest } = node;
  return {
    ...rest,
    cluster: { slug: cluster.slug, title: cluster.title },
    domain: cluster.domain,
    memory: memoryEntries,
    inFocus: _count.focusItems > 0,
  };
}

export interface MoveNodeInput {
  id: string;
  priority: Priority;
  /** The slot in the target tier, counted without the card itself. Clamped to the end. */
  index: number;
}

interface Placement {
  id: string;
  priority: Priority;
  position: number;
}

/** The open cards in one tier of a cluster, in board order, optionally leaving one out. */
function boardTier(
  tx: Prisma.TransactionClient,
  clusterId: string,
  priority: Priority,
  excludeId?: string,
) {
  return tx.node.findMany({
    where: {
      clusterId,
      priority,
      completedAt: null,
      archivedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, priority: true, position: true },
  });
}

/** Writes positions 0..n-1 in list order, touching only rows that change. */
async function renumber(tx: Prisma.TransactionClient, cards: Placement[], priority: Priority) {
  for (const [position, card] of cards.entries()) {
    if (card.priority === priority && card.position === position) continue;
    await tx.node.update({ where: { id: card.id }, data: { priority, position } });
  }
}

/**
 * Moves an open card to a slot in a priority tier of its cluster — reordering
 * within a tier and changing priority are the same operation. Both the tier it
 * joins and the tier it leaves are renumbered, so positions stay 0..n-1 in
 * board order. Completed and archived cards aren't on the board: they can't be
 * moved and don't take up a slot.
 */
export async function moveNode(db: Db, { id, priority, index }: MoveNodeInput): Promise<void> {
  await withTransaction(db, async (tx) => {
    const node = await tx.node.findUnique({
      where: { id },
      select: {
        id: true,
        clusterId: true,
        priority: true,
        position: true,
        completedAt: true,
        archivedAt: true,
      },
    });
    if (!node) throw new NotFoundError('Node', id);
    if (node.completedAt || node.archivedAt) {
      throw new DomainError(
        'CONFLICT',
        `${node.archivedAt ? 'Archived' : 'Completed'} cards are not on the board, so they cannot be moved.`,
      );
    }

    const target = await boardTier(tx, node.clusterId, priority, id);
    const slot = Math.min(Math.max(0, index), target.length);
    await renumber(tx, [...target.slice(0, slot), node, ...target.slice(slot)], priority);

    if (node.priority !== priority) {
      await renumber(tx, await boardTier(tx, node.clusterId, node.priority, id), node.priority);
    }
  });
}

/**
 * Puts a card away: off the board, out of the cloud and out of the focus
 * block, with its notes, attachments and memory kept. The gap it leaves in its
 * tier is closed. Archiving an archived card changes nothing.
 */
export async function archiveNode(db: Db, id: string): Promise<void> {
  await withTransaction(db, async (tx) => {
    const node = await tx.node.findUnique({
      where: { id },
      select: { clusterId: true, priority: true, completedAt: true, archivedAt: true },
    });
    if (!node) throw new NotFoundError('Node', id);
    if (node.archivedAt) return;

    await tx.node.update({ where: { id }, data: { archivedAt: new Date() } });
    await tx.focusItem.deleteMany({ where: { nodeId: id } });
    if (!node.completedAt) {
      await renumber(tx, await boardTier(tx, node.clusterId, node.priority, id), node.priority);
    }
  });
}

/**
 * Brings an archived card back. An open card returns at the end of its tier;
 * a completed one goes back among the completed cards. It doesn't rejoin the
 * focus block.
 */
export async function restoreNode(db: Db, id: string): Promise<void> {
  await withTransaction(db, async (tx) => {
    const node = await tx.node.findUnique({
      where: { id },
      select: { clusterId: true, priority: true, completedAt: true, archivedAt: true },
    });
    if (!node) throw new NotFoundError('Node', id);
    if (!node.archivedAt) return;

    const tier = node.completedAt ? [] : await boardTier(tx, node.clusterId, node.priority, id);
    await tx.node.update({
      where: { id },
      data: {
        archivedAt: null,
        ...(node.completedAt ? {} : { position: tier.length }),
      },
    });
  });
}
