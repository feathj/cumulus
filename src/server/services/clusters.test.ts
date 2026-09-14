import { Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createNode } from '@/test/factories';

import { getClusterBoard, listClusters, RECENTLY_COMPLETED_LIMIT } from './clusters';

const titles = (nodes: { title: string }[]) => nodes.map((node) => node.title);

describe('listClusters', () => {
  it("lists a domain's live clusters in order, with open card counts", async () => {
    const domain = await createDomain({ slug: 'personal' });
    const books = await createCluster(domain.id, { slug: 'books', position: 1 });
    await createCluster(domain.id, { slug: 'house', position: 0 });
    await createCluster(domain.id, { slug: 'retired', position: 2, archivedAt: new Date() });
    await createNode(books.id);
    await createNode(books.id, { completedAt: new Date() });

    const clusters = await listClusters(testDb, 'personal');

    expect(clusters.map((c) => [c.slug, c.openNodeCount])).toEqual([
      ['house', 0],
      ['books', 1],
    ]);
  });

  it('throws NotFoundError for an unknown domain', async () => {
    await expect(listClusters(testDb, 'nowhere')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('getClusterBoard', () => {
  it('groups open cards by tier in board order', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const cluster = await createCluster(domain.id, { slug: 'house' });
    await createNode(cluster.id, { title: 'Second', priority: Priority.NOW, position: 1 });
    await createNode(cluster.id, { title: 'First', priority: Priority.NOW, position: 0 });
    await createNode(cluster.id, { title: 'Eventually', priority: Priority.SOMEDAY, position: 0 });

    const board = await getClusterBoard(testDb, 'personal', 'house');

    expect(titles(board.tiers.NOW)).toEqual(['First', 'Second']);
    expect(board.tiers.NEXT).toEqual([]);
    expect(titles(board.tiers.SOMEDAY)).toEqual(['Eventually']);
  });

  it('keeps completed cards out of the tiers, newest first and capped', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const cluster = await createCluster(domain.id, { slug: 'house' });
    for (let day = 1; day <= RECENTLY_COMPLETED_LIMIT + 2; day++) {
      await createNode(cluster.id, {
        title: `Done on ${day}`,
        priority: Priority.NOW,
        completedAt: new Date(Date.UTC(2026, 8, day)),
      });
    }

    const board = await getClusterBoard(testDb, 'personal', 'house');

    expect(board.tiers.NOW).toEqual([]);
    expect(board.recentlyCompleted).toHaveLength(RECENTLY_COMPLETED_LIMIT);
    expect(board.recentlyCompleted[0]?.title).toBe(`Done on ${RECENTLY_COMPLETED_LIMIT + 2}`);
    expect(board.recentlyCompleted[0]?.completedAt).toBeInstanceOf(Date);
  });

  it('only finds a cluster inside the named domain', async () => {
    const personal = await createDomain({ slug: 'personal' });
    await createDomain({ slug: 'work' });
    await createCluster(personal.id, { slug: 'house' });

    await expect(getClusterBoard(testDb, 'work', 'house')).rejects.toBeInstanceOf(NotFoundError);
  });
});
