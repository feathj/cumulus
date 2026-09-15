import { Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createNode } from '@/test/factories';

import { addToFocus, listFocus, removeFromFocus } from './focus';
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

    const cards = await listFocus(testDb, { day: DAY, timeZone: 'UTC' });

    expect(cards.map((card) => `${card.domain.slug}:${card.title}`)).toEqual([
      'church:Lesson',
      'work:First',
      'work:Second',
    ]);
    expect(cards[1]).toMatchObject({ nodeId: first.id, cluster: { slug: 'ship', title: 'Ship' }, completedAt: null });
  });

  it('keeps cards checked off that day in the time zone, and drops earlier ones', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const nodes = [
      await createNode(cluster.id, { title: 'Open' }),
      // 21:00 on the 15th in Denver.
      await createNode(cluster.id, { title: 'Done late', completedAt: new Date('2026-09-16T03:00:00Z') }),
      // 21:00 on the 14th in Denver.
      await createNode(cluster.id, { title: 'Done the day before', completedAt: new Date('2026-09-15T03:00:00Z') }),
    ];
    for (const [position, node] of nodes.entries()) {
      await testDb.focusItem.create({ data: { domainId: domain.id, nodeId: node.id, position } });
    }

    const titles = async (timeZone: string) =>
      (await listFocus(testDb, { day: DAY, timeZone })).map((card) => card.title);

    expect(await titles('America/Denver')).toEqual(['Open', 'Done late']);
    expect(await titles('UTC')).toEqual(['Open', 'Done the day before']);
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

    expect(await listFocus(testDb, { day: DAY, timeZone: 'UTC' })).toEqual([]);
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

  it('leaves a checked-off card in the focus block', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const node = await createNode(cluster.id);
    await addToFocus(testDb, node.id);

    await completeNode(testDb, node.id);

    expect(await testDb.focusItem.count({ where: { nodeId: node.id } })).toBe(1);
  });

  it('refuses to check off an archived card', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const archived = await createNode(cluster.id, { archivedAt: new Date() });

    await expect(completeNode(testDb, archived.id)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
