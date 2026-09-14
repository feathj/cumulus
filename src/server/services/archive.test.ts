import { Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { DomainError, NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createNode } from '@/test/factories';

import { getClusterBoard, listClusters } from './clusters';
import { listDomains } from './domains';
import { archiveNode, moveNode, restoreNode } from './nodes';

const { NOW } = Priority;

async function house() {
  const domain = await createDomain({ slug: 'personal' });
  const cluster = await createCluster(domain.id, { slug: 'house' });
  const card = (title: string, position: number, data: object = {}) =>
    createNode(cluster.id, { title, priority: NOW, position, ...data });
  const board = () => getClusterBoard(testDb, 'personal', 'house');
  const now = async () => (await board()).tiers.NOW.map((n) => `${n.title}:${n.position}`);
  return { domain, card, board, now };
}

describe('archiveNode', () => {
  it('takes the card off the board, closes its gap and drops it from focus', async () => {
    const { domain, card, board, now } = await house();
    await card('A', 0);
    const b = await card('B', 1);
    await card('C', 2);
    await testDb.focusItem.create({ data: { domainId: domain.id, nodeId: b.id, position: 0 } });

    await archiveNode(testDb, b.id);

    expect(await now()).toEqual(['A:0', 'C:1']);
    expect((await board()).archived.map((n) => n.title)).toEqual(['B']);
    expect(await testDb.focusItem.count()).toBe(0);
    expect((await listClusters(testDb, 'personal'))[0]?.openNodeCount).toBe(2);
    expect((await listDomains(testDb))[0]?.openNodeCount).toBe(2);
  });

  it('keeps an archived completed card out of the completed list too', async () => {
    const { card, board } = await house();
    const done = await card('Done', 0, { completedAt: new Date() });

    await archiveNode(testDb, done.id);

    const after = await board();
    expect(after.recentlyCompleted).toEqual([]);
    expect(after.archived.map((n) => n.title)).toEqual(['Done']);
  });

  it('changes nothing for a card that is already archived', async () => {
    const { card } = await house();
    const archivedAt = new Date('2026-09-01T12:00:00Z');
    const old = await card('Old', 0, { archivedAt });

    await archiveNode(testDb, old.id);

    expect((await testDb.node.findUniqueOrThrow({ where: { id: old.id } })).archivedAt).toEqual(archivedAt);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(archiveNode(testDb, 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('restoreNode', () => {
  it('puts the card back at the end of its tier', async () => {
    const { card, now } = await house();
    const a = await card('A', 0);
    await card('B', 1);
    await card('C', 2);

    await archiveNode(testDb, a.id);
    await restoreNode(testDb, a.id);

    expect(await now()).toEqual(['B:0', 'C:1', 'A:2']);
  });

  it('returns a completed card to the completed list', async () => {
    const { card, board } = await house();
    const done = await card('Done', 0, { completedAt: new Date(), archivedAt: new Date() });

    await restoreNode(testDb, done.id);

    const after = await board();
    expect(after.recentlyCompleted.map((n) => n.title)).toEqual(['Done']);
    expect(after.archived).toEqual([]);
  });
});

describe('moveNode', () => {
  it('refuses to move an archived card', async () => {
    const { card } = await house();
    const archived = await card('Gone', 0, { archivedAt: new Date() });

    const error = await moveNode(testDb, { id: archived.id, priority: NOW, index: 0 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: 'CONFLICT' });
  });
});
