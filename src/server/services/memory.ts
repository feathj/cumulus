import { MemoryEntryStatus, MemoryEntryType } from '@prisma/client';
import type {
  AuthorKind,
  MemoryEventKind,
  MemoryLinkKind,
  MemoryRevisionAction,
  Prisma,
} from '@prisma/client';

import { dateToDay } from '@/lib/day';

import { getCluster } from './clusters';
import type { ClusterRef } from './clusters';
import { entriesInCluster, eventsInCluster } from './scope';
import type { Db } from './types';

/** How many of the most-recalled entries the cluster summary names. */
export const MOST_RECALLED_LIMIT = 3;

export interface NodeRef {
  id: string;
  title: string;
}

export interface EntryLink {
  entryId: string;
  title: string;
  kind: MemoryLinkKind;
  label: string | null;
}

export interface EventRef {
  eventId: string;
  title: string;
  occurredAt: Date;
}

export interface MemoryEntryView {
  id: string;
  type: MemoryEntryType;
  status: MemoryEntryStatus;
  author: AuthorKind;
  title: string;
  description: string;
  body: string;
  rationale: string | null;
  alternatives: string | null;
  howToApply: string | null;
  tags: string[];
  recallCount: number;
  lastRecalledAt: Date | null;
  verifiedAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Set when the entry belongs to one card rather than the whole cluster. */
  node: NodeRef | null;
  /** Entries this one links to or replaces. */
  linksOut: EntryLink[];
  /** Entries that link to or replace this one. */
  linksIn: EntryLink[];
  /** Events this entry cites or is cited by, newest first. */
  references: EventRef[];
}

/** One revision, as the timeline shows it. */
export interface MemoryChange {
  revisionId: string;
  action: MemoryRevisionAction;
  author: AuthorKind;
  createdAt: Date;
  entryId: string;
  entryTitle: string;
  entryType: MemoryEntryType;
}

export interface MemoryEventView {
  id: string;
  kind: MemoryEventKind;
  author: AuthorKind;
  title: string;
  body: string;
  tags: string[];
  occurredAt: Date;
  agent: string | null;
  sessionRef: string | null;
  sourceRef: string | null;
  node: NodeRef | null;
  /** Entry changes made during the event, in order. */
  changes: MemoryChange[];
  referenceCount: number;
}

/** A day's journal that links the cluster or one of its cards. */
export interface JournalMention {
  /** `YYYY-MM-DD`. */
  day: string;
  body: string;
  /** The cluster's cards it links; empty when it links only the cluster. */
  nodes: NodeRef[];
}

export interface ClusterMemory {
  cluster: ClusterRef;
  /** Every entry in the cluster or on its cards, whatever its status; most recently changed first. */
  entries: MemoryEntryView[];
  /** Newest first. */
  events: MemoryEventView[];
  /** Revisions made outside any event — reviews and hand edits. Newest first. */
  looseChanges: MemoryChange[];
  /** Journal days that mention the cluster or its cards, newest first. */
  journal: JournalMention[];
}

export interface MemorySummary {
  activeCount: number;
  pendingCount: number;
  recallCount: number;
  /** Active entries per type, most common first. */
  byType: { type: MemoryEntryType; count: number }[];
  mostRecalled: { id: string; title: string; type: MemoryEntryType; recallCount: number }[];
  /** When the most recently changed active entry changed. */
  latestAt: Date | null;
}

const nodeRefSelect = { select: { id: true, title: true } } as const;

const revisionSelect = {
  id: true,
  action: true,
  author: true,
  createdAt: true,
  entry: { select: { id: true, title: true, type: true } },
} satisfies Prisma.MemoryRevisionSelect;

const entrySelect = {
  id: true,
  type: true,
  status: true,
  author: true,
  title: true,
  description: true,
  body: true,
  rationale: true,
  alternatives: true,
  howToApply: true,
  tags: true,
  recallCount: true,
  lastRecalledAt: true,
  verifiedAt: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  node: nodeRefSelect,
  linksOut: { select: { kind: true, label: true, toEntry: { select: { id: true, title: true } } } },
  linksIn: { select: { kind: true, label: true, fromEntry: { select: { id: true, title: true } } } },
  references: {
    orderBy: { event: { occurredAt: 'desc' } },
    select: { event: { select: { id: true, title: true, occurredAt: true } } },
  },
} satisfies Prisma.MemoryEntrySelect;

const eventSelect = {
  id: true,
  kind: true,
  author: true,
  title: true,
  body: true,
  tags: true,
  occurredAt: true,
  agent: true,
  sessionRef: true,
  sourceRef: true,
  node: nodeRefSelect,
  revisions: { orderBy: { createdAt: 'asc' }, select: revisionSelect },
  _count: { select: { references: true } },
} satisfies Prisma.MemoryEventSelect;

function toChange(revision: Prisma.MemoryRevisionGetPayload<{ select: typeof revisionSelect }>) {
  return {
    revisionId: revision.id,
    action: revision.action,
    author: revision.author,
    createdAt: revision.createdAt,
    entryId: revision.entry.id,
    entryTitle: revision.entry.title,
    entryType: revision.entry.type,
  } satisfies MemoryChange;
}

function toEntryView({
  linksOut,
  linksIn,
  references,
  ...entry
}: Prisma.MemoryEntryGetPayload<{ select: typeof entrySelect }>): MemoryEntryView {
  return {
    ...entry,
    linksOut: linksOut.map((link) => ({
      entryId: link.toEntry.id,
      title: link.toEntry.title,
      kind: link.kind,
      label: link.label,
    })),
    linksIn: linksIn.map((link) => ({
      entryId: link.fromEntry.id,
      title: link.fromEntry.title,
      kind: link.kind,
      label: link.label,
    })),
    references: references.map(({ event }) => ({
      eventId: event.id,
      title: event.title,
      occurredAt: event.occurredAt,
    })),
  };
}

/** Everything the memory view shows for one cluster: knowledge and the timeline of how it changed. */
export async function getClusterMemory(
  db: Db,
  domainSlug: string,
  clusterSlug: string,
): Promise<ClusterMemory> {
  const cluster = await getCluster(db, domainSlug, clusterSlug);

  const [entries, events, looseRevisions, journal] = await Promise.all([
    db.memoryEntry.findMany({
      where: entriesInCluster(cluster.id),
      orderBy: { updatedAt: 'desc' },
      select: entrySelect,
    }),
    db.memoryEvent.findMany({
      where: eventsInCluster(cluster.id),
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      select: eventSelect,
    }),
    db.memoryRevision.findMany({
      where: { eventId: null, entry: entriesInCluster(cluster.id) },
      orderBy: { createdAt: 'desc' },
      select: revisionSelect,
    }),
    db.journalEntry.findMany({
      where: {
        OR: [
          { clusterLinks: { some: { clusterId: cluster.id } } },
          { nodeLinks: { some: { node: { clusterId: cluster.id } } } },
        ],
      },
      orderBy: { entryDate: 'desc' },
      select: {
        entryDate: true,
        body: true,
        nodeLinks: { where: { node: { clusterId: cluster.id } }, select: { node: nodeRefSelect } },
      },
    }),
  ]);

  return {
    cluster,
    entries: entries.map((entry) => toEntryView(entry)),
    events: events.map(({ revisions, _count, ...event }) => ({
      ...event,
      changes: revisions.map((revision) => toChange(revision)),
      referenceCount: _count.references,
    })),
    looseChanges: looseRevisions.map((revision) => toChange(revision)),
    journal: journal.map((entry) => ({
      day: dateToDay(entry.entryDate),
      body: entry.body,
      nodes: entry.nodeLinks.map((link) => link.node),
    })),
  };
}

/** The small roll-up the cloud's memory orb shows. */
export async function getClusterMemorySummary(
  db: Db,
  domainSlug: string,
  clusterSlug: string,
): Promise<MemorySummary> {
  const cluster = await getCluster(db, domainSlug, clusterSlug);
  const entries = await db.memoryEntry.findMany({
    where: {
      ...entriesInCluster(cluster.id),
      status: { in: [MemoryEntryStatus.ACTIVE, MemoryEntryStatus.PENDING] },
    },
    select: { id: true, title: true, type: true, status: true, recallCount: true, updatedAt: true },
  });

  const active = entries.filter((entry) => entry.status === MemoryEntryStatus.ACTIVE);
  const typeOrder = Object.values(MemoryEntryType);
  const counts = new Map<MemoryEntryType, number>();
  for (const entry of active) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);

  return {
    activeCount: active.length,
    pendingCount: entries.length - active.length,
    recallCount: active.reduce((total, entry) => total + entry.recallCount, 0),
    byType: [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)),
    mostRecalled: [...active]
      .sort(
        (a, b) => b.recallCount - a.recallCount || b.updatedAt.getTime() - a.updatedAt.getTime(),
      )
      .slice(0, MOST_RECALLED_LIMIT)
      .map(({ id, title, type, recallCount }) => ({ id, title, type, recallCount })),
    latestAt: active.reduce<Date | null>(
      (latest, entry) => (!latest || entry.updatedAt > latest ? entry.updatedAt : latest),
      null,
    ),
  };
}
