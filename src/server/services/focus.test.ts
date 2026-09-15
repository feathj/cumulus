import { Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createNode } from '@/test/factories';

import { addToFocus, listCompletedOn, listFocus, removeFromFocus } from './focus';
import { completeNode, reopenNode } from './nodes';

const DAY = '2026-09-15';

describe('focus', () => {
  it("lists every domain's focus block, domain by domain, in queue order", async () => {
    const work = await createDomain({ slug: 'work', position: 1 });
    const church = await createDomain({ slug: 'church', position: 0 });
    const ship = await createCluster(work.id, { slug: 'ship', title: 'Ship' });
    const teach = await createCluster(church.id);
    const first = await createNode(ship.id, { title: 'First' });
    const second = await createNode(ship.id, { title: 'Second' });
    const lesson = await createNode(teach.id, { title: 'Lesson' });

    await addToFocus(testDb, first.id);
    await addToFocus(testDb, second.id);
    await addToFocus(testDb, lesson.id);
    await addToFocus(testDb, first.id);

    const cards = await listFocus(testDb);

    expect(cards.map((card) => `${card.domain.slug}:${card.title}`)).toEqual([
      'church:Lesson',
      'work:First',
      'work:Second',
    ]);
    expect(cards[1]).toMatchObject({ nodeId: first.id, cluster: { slug: 'ship', title: 'Ship' } });
  });

  it('holds a card until it is checked off, whatever day it was queued', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const waiting = await createNode(cluster.id, { title: 'Waiting' });
    const done = await createNode(cluster.id, { title: 'Done', completedAt: new Date('2026-09-10T15:00:00Z') });
    for (const [position, node] of [waiting, done].entries()) {
      await testDb.focusItem.create({
        data: { domainId: domain.id, nodeId: node.id, position, addedAt: new Date('2026-09-01T15:00:00Z') },
      });
    }

    const cards = await listFocus(testDb);

    expect(cards.map((card) => card.title)).toEqual(['Waiting']);
    expect(cards[0]?.addedAt).toEqual(new Date('2026-09-01T15:00:00Z'));
  });

  it('logs what was checked off on a day, in the time zone', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    // 21:00 on the 15th in Denver, the 16th in UTC.
    await createNode(cluster.id, { title: 'Late', completedAt: new Date('2026-09-16T03:00:00Z') });
    // 21:00 on the 14th in Denver, the 15th in UTC.
    await createNode(cluster.id, { title: 'The day before', completedAt: new Date('2026-09-15T03:00:00Z') });
    await createNode(cluster.id, { title: 'Open' });
    await createNode(cluster.id, {
      title: 'Put away',
      completedAt: new Date('2026-09-15T18:00:00Z'),
      archivedAt: new Date(),
    });

    const titles = async (timeZone: string) =>
      (await listCompletedOn(testDb, { day: DAY, timeZone })).map((card) => card.title);

    expect(await titles('America/Denver')).toEqual(['Late']);
    expect(await titles('UTC')).toEqual(['The day before']);
  });

  it('logs cards that were never in a focus block, in the order they were done', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id, { slug: 'house', title: 'House' });
    await createNode(cluster.id, { title: 'Second', completedAt: new Date('2026-09-15T18:00:00Z') });
    await createNode(cluster.id, { title: 'First', completedAt: new Date('2026-09-15T09:00:00Z') });

    const cards = await listCompletedOn(testDb, { day: DAY, timeZone: 'UTC' });

    expect(cards.map((card) => card.title)).toEqual(['First', 'Second']);
    expect(cards[0]).toMatchObject({ cluster: { slug: 'house', title: 'House' }, domain: { slug: domain.slug } });
    expect(await testDb.focusItem.count()).toBe(0);
  });

  it('leaves out archived cards and cards in archived clusters', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const shelved = await createCluster(domain.id, { archivedAt: new Date() });
    for (const node of [
      await createNode(cluster.id, { archivedAt: new Date() }),
      await createNode(shelved.id),
    ]) {
      await testDb.focusItem.create({ data: { domainId: domain.id, nodeId: node.id, position: 0 } });
    }

    expect(await listFocus(testDb)).toEqual([]);
  });

  it('refuses completed and archived cards, and removes idempotently', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const done = await createNode(cluster.id, { completedAt: new Date() });
    const archived = await createNode(cluster.id, { archivedAt: new Date() });
    const open = await createNode(cluster.id);

    await expect(addToFocus(testDb, done.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(addToFocus(testDb, archived.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(addToFocus(testDb, 'missing')).rejects.toBeInstanceOf(NotFoundError);

    await addToFocus(testDb, open.id);
    await removeFromFocus(testDb, open.id);
    await removeFromFocus(testDb, open.id);
    expect(await testDb.focusItem.count()).toBe(0);
  });
});

describe('completeNode and reopenNode', () => {
  const { NOW } = Priority;

  async function openTier(clusterId: string) {
    const nodes = await testDb.node.findMany({
      where: { clusterId, completedAt: null, archivedAt: null },
      orderBy: { position: 'asc' },
    });
    return nodes.map((node) => `${node.title}:${node.position}`);
  }

  it('checks a card off, closing its gap, and reopens it at the end of its tier', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const a = await createNode(cluster.id, { title: 'A', priority: NOW, position: 0 });
    await createNode(cluster.id, { title: 'B', priority: NOW, position: 1 });
    await createNode(cluster.id, { title: 'C', priority: NOW, position: 2 });

    await completeNode(testDb, a.id);
    await completeNode(testDb, a.id);
    expect(await openTier(cluster.id)).toEqual(['B:0', 'C:1']);
    expect((await testDb.node.findUniqueOrThrow({ where: { id: a.id } })).completedAt).toBeInstanceOf(Date);

    await reopenNode(testDb, a.id);
    await reopenNode(testDb, a.id);
    expect(await openTier(cluster.id)).toEqual(['B:0', 'C:1', 'A:2']);
  });

  it('keeps a checked-off card’s place in the queue, so reopening it brings it back', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const node = await createNode(cluster.id);
    await addToFocus(testDb, node.id);

    await completeNode(testDb, node.id);
    expect(await testDb.focusItem.count({ where: { nodeId: node.id } })).toBe(1);
    expect(await listFocus(testDb)).toEqual([]);

    await reopenNode(testDb, node.id);
    expect((await listFocus(testDb)).map((card) => card.nodeId)).toEqual([node.id]);
  });

  it('refuses to check off an archived card', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const archived = await createNode(cluster.id, { archivedAt: new Date() });

    await expect(completeNode(testDb, archived.id)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
