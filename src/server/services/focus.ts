import type { NodeKind, Priority } from '@prisma/client';

import { dayIn, dayToDate, shiftDay } from '@/lib/day';
import type { DayKey } from '@/lib/day';

import { DomainError, NotFoundError } from '../errors';
import { withTransaction } from './types';
import type { Db } from './types';

interface DayCard {
  nodeId: string;
  title: string;
  kind: NodeKind;
  priority: Priority;
  domain: { slug: string; title: string; themeHue: number };
  cluster: { slug: string; title: string };
}

export interface FocusCard extends DayCard {
  /** When it joined the focus block. It waits there, day after day, until it's done. */
  addedAt: Date;
}

export interface DoneCard extends DayCard {
  completedAt: Date;
}

const cardSelect = {
  id: true,
  title: true,
  kind: true,
  priority: true,
  cluster: {
    select: { slug: true, title: true, domain: { select: { slug: true, title: true, themeHue: true } } },
  },
} as const;

/**
 * The open cards in every domain's focus block, domain by domain in switcher
 * order. Nothing here is dated: a card waits in the queue until it's checked
 * off, so it carries over from one day to the next by simply staying.
 */
export async function listFocus(db: Db): Promise<FocusCard[]> {
  const items = await db.focusItem.findMany({
    where: {
      domain: { archivedAt: null },
      node: { completedAt: null, archivedAt: null, cluster: { archivedAt: null } },
    },
    orderBy: [{ domain: { position: 'asc' } }, { position: 'asc' }, { addedAt: 'asc' }],
    select: { addedAt: true, node: { select: cardSelect } },
  });

  return items.map(({ addedAt, node: { id, cluster, ...node } }) => ({
    nodeId: id,
    ...node,
    addedAt,
    domain: cluster.domain,
    cluster: { slug: cluster.slug, title: cluster.title },
  }));
}

/**
 * Everything checked off on a day, in the order it was done: the day's log of
 * what got finished, whether or not it was ever in a focus block. Completion
 * times are instants, so the day they belong to depends on the time zone.
 */
export async function listCompletedOn(
  db: Db,
  { day, timeZone }: { day: DayKey; timeZone: string },
): Promise<DoneCard[]> {
  // A local day starts somewhere inside the UTC days either side of it.
  const nodes = await db.node.findMany({
    where: {
      archivedAt: null,
      completedAt: { gte: dayToDate(shiftDay(day, -1)), lt: dayToDate(shiftDay(day, 2)) },
      cluster: { archivedAt: null, domain: { archivedAt: null } },
    },
    orderBy: { completedAt: 'asc' },
    select: { ...cardSelect, completedAt: true },
  });

  const cards: DoneCard[] = [];
  for (const { id, cluster, completedAt, ...node } of nodes) {
    if (!completedAt || dayIn(completedAt, timeZone) !== day) continue;
    cards.push({
      nodeId: id,
      ...node,
      completedAt,
      domain: cluster.domain,
      cluster: { slug: cluster.slug, title: cluster.title },
    });
  }
  return cards;
}

/** Queues an open card at the end of its domain's focus block. Queuing a queued card changes nothing. */
export async function addToFocus(db: Db, nodeId: string): Promise<void> {
  await withTransaction(db, async (tx) => {
    const node = await tx.node.findUnique({
      where: { id: nodeId },
      select: { completedAt: true, archivedAt: true, cluster: { select: { domainId: true } } },
    });
    if (!node) throw new NotFoundError('Node', nodeId);
    if (node.completedAt || node.archivedAt) {
      throw new DomainError(
        'CONFLICT',
        `${node.archivedAt ? 'Archived' : 'Completed'} cards can’t join the focus block.`,
      );
    }

    const { domainId } = node.cluster;
    const queued = await tx.focusItem.findUnique({
      where: { domainId_nodeId: { domainId, nodeId } },
      select: { id: true },
    });
    if (queued) return;

    const last = await tx.focusItem.aggregate({ where: { domainId }, _max: { position: true } });
    await tx.focusItem.create({ data: { domainId, nodeId, position: (last._max.position ?? -1) + 1 } });
  });
}

/** Takes a card out of the focus block. Removing a card that isn't queued changes nothing. */
export async function removeFromFocus(db: Db, nodeId: string): Promise<void> {
  await db.focusItem.deleteMany({ where: { nodeId } });
}
