import {
  AuthorKind,
  MemoryEntryStatus,
  MemoryEntryType,
  MemoryEventKind,
  MemoryLinkKind,
  MemoryRevisionAction,
} from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import {
  createCluster,
  createDomain,
  createMemoryEntry,
  createMemoryEvent,
  createNode,
  createRevision,
} from '@/test/factories';

import { getClusterMemory, getClusterMemorySummary } from './memory';

async function continuity() {
  const domain = await createDomain({ slug: 'work' });
  const cluster = await createCluster(domain.id, { slug: 'continuity' });
  return { domain, cluster };
}

describe('getClusterMemory', () => {
  it('collects memory owned by the cluster and its cards, and nothing else', async () => {
    const { domain, cluster } = await continuity();
    const other = await createCluster(domain.id, { slug: 'other' });
    const node = await createNode(cluster.id, { title: 'Auth migration' });

    await createMemoryEntry({ clusterId: cluster.id, title: 'Cluster fact' });
    await createMemoryEntry({ nodeId: node.id, title: 'Card fact' });
    await createMemoryEntry({ clusterId: other.id, title: 'Elsewhere' });
    await createMemoryEntry({ domainId: domain.id, title: 'Domain-wide' });
    await createMemoryEvent({ nodeId: node.id, title: 'Card event' });
    await createMemoryEvent({ clusterId: other.id, title: 'Other event' });

    const memory = await getClusterMemory(testDb, 'work', 'continuity');

    expect(memory.entries.map((e) => e.title).sort()).toEqual(['Card fact', 'Cluster fact']);
    expect(memory.entries.find((e) => e.title === 'Card fact')?.node).toEqual({
      id: node.id,
      title: 'Auth migration',
    });
    expect(memory.events.map((e) => e.title)).toEqual(['Card event']);
  });

  it('resolves links in both directions and the events an entry cites', async () => {
    const { cluster } = await continuity();
    const newer = await createMemoryEntry({ clusterId: cluster.id, title: 'Newer' });
    const older = await createMemoryEntry({
      clusterId: cluster.id,
      title: 'Older',
      status: MemoryEntryStatus.SUPERSEDED,
    });
    const source = await createMemoryEvent({
      clusterId: cluster.id,
      title: 'Design doc',
      occurredAt: new Date('2026-09-01T12:00:00Z'),
    });
    await testDb.memoryLink.create({
      data: { fromEntryId: newer.id, toEntryId: older.id, kind: MemoryLinkKind.SUPERSEDES },
    });
    await testDb.memoryReference.create({ data: { entryId: newer.id, eventId: source.id } });

    const memory = await getClusterMemory(testDb, 'work', 'continuity');
    const byTitle = new Map(memory.entries.map((e) => [e.title, e]));

    expect(byTitle.get('Newer')?.linksOut).toEqual([
      { entryId: older.id, title: 'Older', kind: MemoryLinkKind.SUPERSEDES, label: null },
    ]);
    expect(byTitle.get('Older')?.linksIn).toEqual([
      { entryId: newer.id, title: 'Newer', kind: MemoryLinkKind.SUPERSEDES, label: null },
    ]);
    expect(byTitle.get('Newer')?.references).toEqual([
      { eventId: source.id, title: 'Design doc', occurredAt: new Date('2026-09-01T12:00:00Z') },
    ]);
  });

  it('puts revisions under their event, newest event first, and keeps the rest loose', async () => {
    const { cluster } = await continuity();
    const entry = await createMemoryEntry({
      clusterId: cluster.id,
      title: 'Runbooks are the bottleneck',
      type: MemoryEntryType.FACT,
    });
    const earlier = await createMemoryEvent({
      clusterId: cluster.id,
      kind: MemoryEventKind.LOG,
      title: 'Game day',
      occurredAt: new Date('2026-08-20T12:00:00Z'),
    });
    await createMemoryEvent({
      clusterId: cluster.id,
      kind: MemoryEventKind.SESSION,
      title: 'Later session',
      occurredAt: new Date('2026-09-04T18:00:00Z'),
    });
    await createRevision(entry.id, { eventId: earlier.id, action: MemoryRevisionAction.CREATED });
    await createRevision(entry.id, {
      action: MemoryRevisionAction.ACCEPTED,
      author: AuthorKind.USER,
    });

    const memory = await getClusterMemory(testDb, 'work', 'continuity');

    expect(memory.events.map((e) => e.title)).toEqual(['Later session', 'Game day']);
    expect(memory.events[1]?.changes).toEqual([
      expect.objectContaining({
        action: MemoryRevisionAction.CREATED,
        entryId: entry.id,
        entryTitle: 'Runbooks are the bottleneck',
        entryType: MemoryEntryType.FACT,
      }),
    ]);
    expect(memory.looseChanges).toEqual([
      expect.objectContaining({ action: MemoryRevisionAction.ACCEPTED, author: AuthorKind.USER }),
    ]);
  });

  it('throws NotFoundError for an unknown cluster', async () => {
    await continuity();

    await expect(getClusterMemory(testDb, 'work', 'missing')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('getClusterMemorySummary', () => {
  it('counts active and pending memory and ranks what gets recalled', async () => {
    const { cluster } = await continuity();
    const node = await createNode(cluster.id);
    const { DECISION, FACT, QUESTION } = MemoryEntryType;

    await createMemoryEntry({ clusterId: cluster.id, type: DECISION, title: 'r5', recallCount: 5 });
    await createMemoryEntry({ nodeId: node.id, type: FACT, title: 'r9', recallCount: 9 });
    await createMemoryEntry({ clusterId: cluster.id, type: FACT, title: 'r1', recallCount: 1 });
    await createMemoryEntry({
      clusterId: cluster.id,
      type: QUESTION,
      status: MemoryEntryStatus.PENDING,
    });
    await createMemoryEntry({
      clusterId: cluster.id,
      type: DECISION,
      status: MemoryEntryStatus.ARCHIVED,
      recallCount: 50,
    });

    const summary = await getClusterMemorySummary(testDb, 'work', 'continuity');

    expect(summary).toMatchObject({ activeCount: 3, pendingCount: 1, recallCount: 15 });
    expect(summary.byType).toEqual([
      { type: FACT, count: 2 },
      { type: DECISION, count: 1 },
    ]);
    expect(summary.mostRecalled.map((e) => e.title)).toEqual(['r9', 'r5', 'r1']);
    expect(summary.latestAt).toBeInstanceOf(Date);
  });

  it('reports an empty cluster without inventing a date', async () => {
    await continuity();

    const summary = await getClusterMemorySummary(testDb, 'work', 'continuity');

    expect(summary).toEqual({
      activeCount: 0,
      pendingCount: 0,
      recallCount: 0,
      byType: [],
      mostRecalled: [],
      latestAt: null,
    });
  });
});
