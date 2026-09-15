import type { Prisma, Priority } from '@prisma/client';

import { DomainError, NotFoundError } from '../errors';
import { withTransaction } from './types';
import type { Db } from './types';

/** How many archived captures the inbox offers to restore. */
export const ARCHIVED_INBOX_LIMIT = 20;

export interface InboxItemView {
  id: string;
  text: string;
  capturedAt: Date;
  archivedAt: Date | null;
  /**
   * The domain it was headed for, when it arrived with one (imported ideas,
   * or captures from before the inbox was app-wide). A hint for filing, not a rule.
   */
  domain: { slug: string; title: string; themeHue: number } | null;
}

export interface Inbox {
  /** Captures waiting on a decision, newest first. */
  items: InboxItemView[];
  /** Recently archived captures, most recently archived first. */
  archived: InboxItemView[];
}

export interface FileInboxItemInput {
  id: string;
  clusterId: string;
  title: string;
  description: string | null;
  priority: Priority;
}

export interface FiledCard {
  nodeId: string;
  domainSlug: string;
  clusterSlug: string;
}

const itemSelect = {
  id: true,
  text: true,
  capturedAt: true,
  archivedAt: true,
  domain: { select: { slug: true, title: true, themeHue: true } },
} satisfies Prisma.InboxItemSelect;

const waiting = { filedAt: null, archivedAt: null } satisfies Prisma.InboxItemWhereInput;

function requireText(text: string, what: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new DomainError('BAD_REQUEST', `${what} needs some text.`);
  return trimmed;
}

/** A capture that hasn't been filed yet, archived or not. */
async function getUnfiledItem(db: Db, id: string) {
  const item = await db.inboxItem.findUnique({
    where: { id },
    select: { id: true, filedAt: true, archivedAt: true },
  });
  if (!item) throw new NotFoundError('Inbox item', id);
  if (item.filedAt) throw new DomainError('CONFLICT', 'That idea has already been filed.');
  return item;
}

/** The one inbox: everything waiting, from every domain or none. */
export async function listInbox(db: Db): Promise<Inbox> {
  const [items, archived] = await Promise.all([
    db.inboxItem.findMany({ where: waiting, orderBy: { capturedAt: 'desc' }, select: itemSelect }),
    db.inboxItem.findMany({
      where: { filedAt: null, archivedAt: { not: null } },
      orderBy: { archivedAt: 'desc' },
      take: ARCHIVED_INBOX_LIMIT,
      select: itemSelect,
    }),
  ]);
  return { items, archived };
}

/** How many ideas are waiting on a decision, for the Inbox tab's badge. */
export function countInbox(db: Db): Promise<number> {
  return db.inboxItem.count({ where: waiting });
}

/** Drops a thought into the inbox, undecided, not even about its domain. */
export async function captureIdea(db: Db, { text }: { text: string }): Promise<InboxItemView> {
  return db.inboxItem.create({
    data: { text: requireText(text, 'An idea') },
    select: itemSelect,
  });
}

/** Rewrites a waiting capture as the idea gets clearer. */
export async function updateInboxItem(
  db: Db,
  { id, text }: { id: string; text: string },
): Promise<InboxItemView> {
  const item = await getUnfiledItem(db, id);
  if (item.archivedAt) throw new DomainError('CONFLICT', 'Restore that idea before editing it.');
  return db.inboxItem.update({
    where: { id },
    data: { text: requireText(text, 'An idea') },
    select: itemSelect,
  });
}

/**
 * Turns a capture into a card in any live cluster, at the end of the chosen
 * priority, and marks the capture as filed under that cluster's domain. The
 * capture row stays behind as a record of where the card came from.
 */
export async function fileInboxItem(db: Db, input: FileInboxItemInput): Promise<FiledCard> {
  return withTransaction(db, async (tx) => {
    const item = await getUnfiledItem(tx, input.id);
    if (item.archivedAt) throw new DomainError('CONFLICT', 'Restore that idea before filing it.');

    const cluster = await tx.cluster.findFirst({
      where: { id: input.clusterId, archivedAt: null, domain: { archivedAt: null } },
      select: { id: true, slug: true, domainId: true, domain: { select: { slug: true } } },
    });
    if (!cluster) throw new NotFoundError('Cluster', input.clusterId);

    // After the last open card, not at a count: positions can have gaps.
    const last = await tx.node.aggregate({
      where: { clusterId: cluster.id, priority: input.priority, completedAt: null, archivedAt: null },
      _max: { position: true },
    });

    const node = await tx.node.create({
      data: {
        clusterId: cluster.id,
        title: requireText(input.title, 'A card title'),
        description: input.description?.trim() || null,
        priority: input.priority,
        position: (last._max.position ?? -1) + 1,
      },
      select: { id: true },
    });
    await tx.inboxItem.update({
      where: { id: item.id },
      data: { filedAt: new Date(), filedAsNodeId: node.id, domainId: cluster.domainId },
    });

    return { nodeId: node.id, domainSlug: cluster.domain.slug, clusterSlug: cluster.slug };
  });
}

/** Sets a capture aside without filing it. Archiving twice changes nothing. */
export async function archiveInboxItem(db: Db, id: string): Promise<void> {
  const item = await getUnfiledItem(db, id);
  if (item.archivedAt) return;
  await db.inboxItem.update({ where: { id }, data: { archivedAt: new Date() } });
}

export async function restoreInboxItem(db: Db, id: string): Promise<void> {
  const item = await getUnfiledItem(db, id);
  if (!item.archivedAt) return;
  await db.inboxItem.update({ where: { id }, data: { archivedAt: null } });
}
