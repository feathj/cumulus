import type { Priority } from '@prisma/client';

import { DomainError, NotFoundError } from '../errors';
import { getDomain } from './domains';
import { withTransaction } from './types';
import type { Db } from './types';

/** How many archived captures the inbox offers to restore. */
export const ARCHIVED_INBOX_LIMIT = 20;

export interface InboxItemView {
  id: string;
  text: string;
  capturedAt: Date;
  archivedAt: Date | null;
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

const itemSelect = { id: true, text: true, capturedAt: true, archivedAt: true } as const;

function requireText(text: string, what: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new DomainError('BAD_REQUEST', `${what} needs some text.`);
  return trimmed;
}

/** A capture that hasn't been filed yet, archived or not. */
async function getUnfiledItem(db: Db, id: string) {
  const item = await db.inboxItem.findUnique({
    where: { id },
    select: { id: true, domainId: true, filedAt: true, archivedAt: true },
  });
  if (!item) throw new NotFoundError('Inbox item', id);
  if (item.filedAt) throw new DomainError('CONFLICT', 'That idea has already been filed.');
  return item;
}

export async function listInbox(db: Db, domainSlug: string): Promise<Inbox> {
  const domain = await getDomain(db, domainSlug);
  const [items, archived] = await Promise.all([
    db.inboxItem.findMany({
      where: { domainId: domain.id, filedAt: null, archivedAt: null },
      orderBy: { capturedAt: 'desc' },
      select: itemSelect,
    }),
    db.inboxItem.findMany({
      where: { domainId: domain.id, filedAt: null, archivedAt: { not: null } },
      orderBy: { archivedAt: 'desc' },
      take: ARCHIVED_INBOX_LIMIT,
      select: itemSelect,
    }),
  ]);
  return { items, archived };
}

/** Drops a thought into a domain's inbox, undecided. */
export async function captureIdea(
  db: Db,
  { domainSlug, text }: { domainSlug: string; text: string },
): Promise<InboxItemView> {
  const domain = await getDomain(db, domainSlug);
  return db.inboxItem.create({
    data: { domainId: domain.id, text: requireText(text, 'An idea') },
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
 * Turns a capture into a card in one of its domain's clusters, at the end of
 * the chosen priority, and marks the capture as filed. The capture row stays
 * behind as a record of where the card came from.
 */
export async function fileInboxItem(db: Db, input: FileInboxItemInput): Promise<FiledCard> {
  return withTransaction(db, async (tx) => {
    const item = await getUnfiledItem(tx, input.id);
    if (item.archivedAt) throw new DomainError('CONFLICT', 'Restore that idea before filing it.');

    const cluster = await tx.cluster.findFirst({
      where: { id: input.clusterId, domainId: item.domainId, archivedAt: null },
      select: { id: true, slug: true, domain: { select: { slug: true } } },
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
      data: { filedAt: new Date(), filedAsNodeId: node.id },
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
