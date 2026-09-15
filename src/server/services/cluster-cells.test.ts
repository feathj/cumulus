import { Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createNode } from '@/test/factories';

import { CELL_POOL_LIMIT, listClusterCells } from './clusters';

describe('listClusterCells', () => {
  it("pools each live cluster's open cards, now first, and leaves everything else out", async () => {
    const domain = await createDomain({ slug: 'personal' });
    const house = await createCluster(domain.id, { slug: 'house' });
    const books = await createCluster(domain.id, { slug: 'books' });
    const retired = await createCluster(domain.id, { slug: 'retired', archivedAt: new Date() });
    await createCluster(domain.id, { slug: 'empty' });
    await createNode(house.id, { title: 'Someday deck', priority: Priority.SOMEDAY, position: 0 });
    await createNode(house.id, { title: 'Seal the deck', priority: Priority.NOW, position: 0 });
    await createNode(house.id, { title: 'Done', completedAt: new Date() });
    await createNode(house.id, { title: 'Put away', archivedAt: new Date() });
    await createNode(books.id, { title: 'Dune', priority: Priority.NEXT });
    await createNode(retired.id, { title: 'Hidden' });
    const work = await createDomain({ slug: 'work' });
    await createNode((await createCluster(work.id)).id, { title: 'Elsewhere' });

    const cells = await listClusterCells(testDb, 'personal');

    expect(Object.fromEntries(cells.map((entry) => [entry.clusterId, entry.cards.map((card) => card.title)]))).toEqual({
      [house.id]: ['Seal the deck', 'Someday deck'],
      [books.id]: ['Dune'],
    });
  });

  it('caps the pool for a big cluster', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const house = await createCluster(domain.id, { slug: 'house' });
    await testDb.node.createMany({
      data: Array.from({ length: CELL_POOL_LIMIT + 3 }, (_, i) => ({
        clusterId: house.id,
        title: `Card ${i}`,
        position: i,
      })),
    });

    const [entry] = await listClusterCells(testDb, 'personal');

    expect(entry?.cards).toHaveLength(CELL_POOL_LIMIT);
    expect(entry?.cards[0]?.title).toBe('Card 0');
  });

  it('throws NotFoundError for an unknown domain', async () => {
    await expect(listClusterCells(testDb, 'nowhere')).rejects.toBeInstanceOf(NotFoundError);
  });
});
