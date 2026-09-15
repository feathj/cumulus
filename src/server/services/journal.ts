import type { Prisma } from '@prisma/client';

import { dayToDate } from '@/lib/day';
import type { DayKey } from '@/lib/day';
import { wikiLinkTitles } from '@/lib/wiki-links';

import { withTransaction } from './types';
import type { Db } from './types';

export interface JournalDay {
  day: DayKey;
  body: string;
  /** Null until something has been written that day. */
  updatedAt: Date | null;
}

export async function getJournal(db: Db, day: DayKey): Promise<JournalDay> {
  const entry = await db.journalEntry.findUnique({
    where: { entryDate: dayToDate(day) },
    select: { body: true, updatedAt: true },
  });
  return { day, body: entry?.body ?? '', updatedAt: entry?.updatedAt ?? null };
}

/**
 * What the `[[wiki links]]` in a body point at. A title that matches cards
 * links those cards; otherwise one that matches clusters links those. Titles
 * aren't unique across clusters and domains, so every match is linked.
 */
async function resolveLinks(tx: Prisma.TransactionClient, body: string) {
  const titles = wikiLinkTitles(body);
  if (!titles.length) return { nodeLinks: [], clusterLinks: [] };

  const nodes = await tx.node.findMany({
    where: {
      title: { in: titles },
      archivedAt: null,
      cluster: { archivedAt: null, domain: { archivedAt: null } },
    },
    select: { id: true, title: true },
  });
  const cardTitles = new Set(nodes.map((node) => node.title));
  const clusters = await tx.cluster.findMany({
    where: {
      title: { in: titles.filter((title) => !cardTitles.has(title)) },
      archivedAt: null,
      domain: { archivedAt: null },
    },
    select: { id: true, title: true },
  });

  return {
    nodeLinks: nodes.map((node) => ({ nodeId: node.id, label: node.title })),
    clusterLinks: clusters.map((cluster) => ({ clusterId: cluster.id, label: cluster.title })),
  };
}

/**
 * Saves the day's journal as written and re-resolves its `[[wiki links]]`,
 * which are stored so a cluster's timeline can show the days that mention it
 * or its cards. Clearing the text removes the day's entry.
 */
export async function saveJournal(db: Db, { day, body }: { day: DayKey; body: string }): Promise<JournalDay> {
  const entryDate = dayToDate(day);
  return withTransaction(db, async (tx) => {
    if (!body.trim()) {
      await tx.journalEntry.deleteMany({ where: { entryDate } });
      return { day, body: '', updatedAt: null };
    }

    const entry = await tx.journalEntry.upsert({
      where: { entryDate },
      create: { entryDate, body },
      update: { body },
      select: { id: true, body: true, updatedAt: true },
    });

    const { nodeLinks, clusterLinks } = await resolveLinks(tx, body);
    await tx.journalNodeLink.deleteMany({ where: { journalEntryId: entry.id } });
    await tx.journalClusterLink.deleteMany({ where: { journalEntryId: entry.id } });
    if (nodeLinks.length) {
      await tx.journalNodeLink.createMany({ data: nodeLinks.map((link) => ({ journalEntryId: entry.id, ...link })) });
    }
    if (clusterLinks.length) {
      await tx.journalClusterLink.createMany({
        data: clusterLinks.map((link) => ({ journalEntryId: entry.id, ...link })),
      });
    }

    return { day, body: entry.body, updatedAt: entry.updatedAt };
  });
}
