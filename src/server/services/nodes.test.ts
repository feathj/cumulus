import { MemoryEntryStatus, NodeKind, Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { DomainError, NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createMemoryEntry, createNode } from '@/test/factories';

import { getNodeDetail, moveNode } from './nodes';

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
