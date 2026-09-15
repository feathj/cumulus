import type { NodeKind, Priority } from '@prisma/client';

import { dayIn } from '@/lib/day';
import type { DayKey } from '@/lib/day';

import { DomainError, NotFoundError } from '../errors';
import { withTransaction } from './types';
import type { Db } from './types';

export interface FocusCard {
  nodeId: string;
  title: string;
  kind: NodeKind;
  priority: Priority;
  completedAt: Date | null;
  /** When it joined the focus block. It carries over day to day until it's done. */
  addedAt: Date;
  domain: { slug: string; title: string; themeHue: number };
  cluster: { slug: string; title: string };
}

/**
 * Every domain's focus block, domain by domain in switcher order, as it stands
 * on `day`: open cards, carried over from whenever they were queued, and cards
 * checked off that day in `timeZone`. Cards checked off on an earlier day have
 * done their time and drop out.
 */
export async function listFocus(
  db: Db,
  { day, timeZone }: { day: DayKey; timeZone: string },
): Promise<FocusCard[]> {
  const items = await db.focusItem.findMany({
    where: {
      domain: { archivedAt: null },
      node: { archivedAt: null, cluster: { archivedAt: null } },
    },
    orderBy: [{ domain: { position: 'asc' } }, { position: 'asc' }, { addedAt: 'asc' }],
    select: {
      addedAt: true,
      domain: { select: { slug: true, title: true, themeHue: true } },
      node: {
        select: {
          id: true,
          title: true,
          kind: true,
          priority: true,
          completedAt: true,
          cluster: { select: { slug: true, title: true } },
        },
      },
    },
  });

  return items
    .filter(({ node }) => !node.completedAt || dayIn(node.completedAt, timeZone) === day)
    .map(({ addedAt, domain, node: { id, cluster, ...node } }) => ({ nodeId: id, ...node, addedAt, domain, cluster }));
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
