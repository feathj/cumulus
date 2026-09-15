import { MemoryEntryStatus, NodeKind, Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { DomainError, NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createMemoryEntry, createNode } from '@/test/factories';

import { getNodeDetail, moveNode, transferNode } from './nodes';
import { entriesInCluster } from './scope';

describe('getNodeDetail', () => {
  it('returns a card with its path, notes newest first, attachments and live memory', async () => {
    const domain = await createDomain({ slug: 'personal', title: 'Personal' });
    const cluster = await createCluster(domain.id, { slug: 'house', title: 'House' });
    const node = await createNode(cluster.id, {
      title: 'Kitchen redo',
      kind: NodeKind.TOPIC,
      description: '- Floor to ceiling cabinets',
    });

    await testDb.note.create({
      data: { nodeId: node.id, body: 'older', occurredAt: new Date('2026-09-01T12:00:00Z') },
    });
    await testDb.note.create({
      data: { nodeId: node.id, body: 'newer', occurredAt: new Date('2026-09-05T12:00:00Z') },
    });
    await testDb.attachment.create({
      data: { nodeId: node.id, name: 'Inspiration', url: 'https://example.com/kitchen' },
    });
    await createMemoryEntry({ nodeId: node.id, title: 'Keep' });
    await createMemoryEntry({ nodeId: node.id, title: 'Gone', status: MemoryEntryStatus.ARCHIVED });
    await testDb.focusItem.create({ data: { domainId: domain.id, nodeId: node.id, position: 0 } });

    const detail = await getNodeDetail(testDb, node.id);

    expect(detail).toMatchObject({
      title: 'Kitchen redo',
      kind: NodeKind.TOPIC,
      description: '- Floor to ceiling cabinets',
      cluster: { slug: 'house', title: 'House' },
      domain: { slug: 'personal', title: 'Personal' },
      inFocus: true,
    });
    expect(detail.notes.map((n) => n.body)).toEqual(['newer', 'older']);
    expect(detail.attachments).toEqual([
      expect.objectContaining({ name: 'Inspiration', url: 'https://example.com/kitchen' }),
    ]);
    expect(detail.memory.map((m) => m.title)).toEqual(['Keep']);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(getNodeDetail(testDb, 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('moveNode', () => {
  const { NOW, NEXT, SOMEDAY } = Priority;

  /** A cluster with open cards laid out tier by tier, positions 0..n-1. */
  async function board(layout: Partial<Record<Priority, string[]>>) {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const ids: Record<string, string> = {};
    for (const [priority, titles] of Object.entries(layout) as [Priority, string[]][]) {
      for (const [position, title] of titles.entries()) {
        ids[title] = (await createNode(cluster.id, { title, priority, position })).id;
      }
    }
    const read = async () => {
      const nodes = await testDb.node.findMany({
        where: { clusterId: cluster.id, completedAt: null },
        orderBy: { position: 'asc' },
      });
      const tier = (priority: Priority) =>
        nodes.filter((n) => n.priority === priority).map((n) => `${n.title}:${n.position}`);
      return { NOW: tier(NOW), NEXT: tier(NEXT), SOMEDAY: tier(SOMEDAY) };
    };
    const id = (title: string) => ids[title] ?? '';
    return { cluster, id, read };
  }

  it('reorders a card within its tier', async () => {
    const { id, read } = await board({ NOW: ['A', 'B', 'C'] });

    await moveNode(testDb, { id: id('C'), priority: NOW, index: 0 });

    expect((await read()).NOW).toEqual(['C:0', 'A:1', 'B:2']);
  });

  it('moves a card to another tier and closes the gap it left', async () => {
    const { id, read } = await board({ NOW: ['A', 'B', 'C'], NEXT: ['X', 'Y'] });

    await moveNode(testDb, { id: id('B'), priority: NEXT, index: 1 });

    expect(await read()).toEqual({
      NOW: ['A:0', 'C:1'],
      NEXT: ['X:0', 'B:1', 'Y:2'],
      SOMEDAY: [],
    });
  });

  it('clamps a slot past the end, and fills an empty tier', async () => {
    const { id, read } = await board({ NOW: ['A', 'B'], NEXT: ['X'] });

    await moveNode(testDb, { id: id('A'), priority: NEXT, index: 99 });
    await moveNode(testDb, { id: id('B'), priority: SOMEDAY, index: 3 });

    expect(await read()).toEqual({ NOW: [], NEXT: ['X:0', 'A:1'], SOMEDAY: ['B:0'] });
  });

  it("doesn't count completed cards when numbering a tier", async () => {
    const { cluster, id, read } = await board({ NOW: ['A', 'B'] });
    await createNode(cluster.id, {
      title: 'Done',
      priority: NOW,
      position: 0,
      completedAt: new Date(),
    });

    await moveNode(testDb, { id: id('B'), priority: NOW, index: 0 });

    expect((await read()).NOW).toEqual(['B:0', 'A:1']);
  });

  it('leaves rows alone when the card is already in that slot', async () => {
    const { id } = await board({ NOW: ['A', 'B'] });
    const before = await testDb.node.findMany({ orderBy: { title: 'asc' } });

    await moveNode(testDb, { id: id('B'), priority: NOW, index: 1 });

    expect(await testDb.node.findMany({ orderBy: { title: 'asc' } })).toEqual(before);
  });

  it('refuses to move a completed card', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const done = await createNode(cluster.id, { completedAt: new Date() });

    const error = await moveNode(testDb, { id: done.id, priority: NOW, index: 0 }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: 'CONFLICT' });
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(moveNode(testDb, { id: 'missing', priority: NOW, index: 0 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('transferNode', () => {
  const { NOW, NEXT } = Priority;

  /** A cluster's open cards as `title:priority:position`, in board order. */
  async function openCards(clusterId: string) {
    const nodes = await testDb.node.findMany({
      where: { clusterId, completedAt: null, archivedAt: null },
      orderBy: [{ priority: 'asc' }, { position: 'asc' }],
    });
    return nodes.map((n) => `${n.title}:${n.priority}:${n.position}`);
  }

  /** Two clusters in one domain: A, B, C up now in the first; X now and Y next in the second. */
  async function twoClusters() {
    const domain = await createDomain();
    const from = await createCluster(domain.id);
    const to = await createCluster(domain.id);
    await createNode(from.id, { title: 'A', priority: NOW, position: 0 });
    const b = await createNode(from.id, { title: 'B', priority: NOW, position: 1, layoutX: 10, layoutY: 20 });
    await createNode(from.id, { title: 'C', priority: NOW, position: 2 });
    await createNode(to.id, { title: 'X', priority: NOW, position: 0 });
    await createNode(to.id, { title: 'Y', priority: NEXT, position: 0 });
    return { domain, from, to, b };
  }

  it('moves an open card to the end of its tier in another cluster and closes the gap it left', async () => {
    const { domain, from, to, b } = await twoClusters();

    const moved = await transferNode(testDb, { id: b.id, clusterId: to.id });

    expect(await openCards(from.id)).toEqual(['A:NOW:0', 'C:NOW:1']);
    expect(await openCards(to.id)).toEqual(['X:NOW:0', 'B:NOW:1', 'Y:NEXT:0']);
    expect(await testDb.node.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({
      layoutX: null,
      layoutY: null,
    });
    expect(moved).toEqual({
      nodeId: b.id,
      domainSlug: domain.slug,
      clusterSlug: to.slug,
      from: { clusterId: from.id, priority: NOW, index: 1 },
      leftFocus: false,
    });
  });

  it('takes a priority and a slot in the target cluster', async () => {
    const { to, b } = await twoClusters();

    await transferNode(testDb, { id: b.id, clusterId: to.id, priority: NEXT, index: 0 });

    expect(await openCards(to.id)).toEqual(['X:NOW:0', 'B:NEXT:0', 'Y:NEXT:1']);
  });

  it("brings the card's memory into the new cluster", async () => {
    const { from, to, b } = await twoClusters();
    await createMemoryEntry({ nodeId: b.id });

    await transferNode(testDb, { id: b.id, clusterId: to.id });

    expect(await testDb.memoryEntry.count({ where: entriesInCluster(from.id) })).toBe(0);
    expect(await testDb.memoryEntry.count({ where: entriesInCluster(to.id) })).toBe(1);
  });

  it('puts a card back in its slot when transferred back to where it came from', async () => {
    const domain = await createDomain();
    const from = await createCluster(domain.id);
    const to = await createCluster(domain.id);
    // Gaps in the positions, as filing and imports leave them.
    await createNode(from.id, { title: 'A', priority: NOW, position: 0 });
    const b = await createNode(from.id, { title: 'B', priority: NOW, position: 5 });
    await createNode(from.id, { title: 'C', priority: NOW, position: 9 });

    const moved = await transferNode(testDb, { id: b.id, clusterId: to.id, priority: NEXT });
    await transferNode(testDb, { id: b.id, ...moved.from });

    expect(await openCards(from.id)).toEqual(['A:NOW:0', 'B:NOW:1', 'C:NOW:2']);
    expect(await openCards(to.id)).toEqual([]);
  });

  it('takes the card out of the focus block only when it leaves the domain', async () => {
    const work = await createDomain();
    const church = await createDomain();
    const [first, second] = [await createCluster(work.id), await createCluster(work.id)];
    const elsewhere = await createCluster(church.id);
    const node = await createNode(first.id);
    await testDb.focusItem.create({ data: { domainId: work.id, nodeId: node.id, position: 0 } });

    const sideways = await transferNode(testDb, { id: node.id, clusterId: second.id });
    expect(sideways.leftFocus).toBe(false);
    expect(await testDb.focusItem.count({ where: { nodeId: node.id } })).toBe(1);

    const across = await transferNode(testDb, { id: node.id, clusterId: elsewhere.id });
    expect(across.leftFocus).toBe(true);
    expect(await testDb.focusItem.count({ where: { nodeId: node.id } })).toBe(0);
  });

  it("moves a completed card without taking a slot on the new board", async () => {
    const { to } = await twoClusters();
    const domain = await createDomain();
    const other = await createCluster(domain.id);
    const done = await createNode(other.id, { priority: NOW, position: 0, completedAt: new Date() });

    await transferNode(testDb, { id: done.id, clusterId: to.id });

    expect(await openCards(to.id)).toEqual(['X:NOW:0', 'Y:NEXT:0']);
    expect(await testDb.node.findUniqueOrThrow({ where: { id: done.id } })).toMatchObject({ clusterId: to.id });
  });

  it('refuses the cluster the card is already in', async () => {
    const { from, b } = await twoClusters();

    await expect(transferNode(testDb, { id: b.id, clusterId: from.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('treats an archived cluster, or one in an archived domain, as not found', async () => {
    const { domain, b } = await twoClusters();
    const archived = await createCluster(domain.id, { archivedAt: new Date() });
    const gone = await createDomain({ archivedAt: new Date() });
    const inGone = await createCluster(gone.id);

    await expect(transferNode(testDb, { id: b.id, clusterId: archived.id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(transferNode(testDb, { id: b.id, clusterId: inGone.id })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError for an unknown card', async () => {
    const { to } = await twoClusters();

    await expect(transferNode(testDb, { id: 'missing', clusterId: to.id })).rejects.toBeInstanceOf(NotFoundError);
  });
});
