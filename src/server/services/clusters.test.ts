import { MemoryEntryStatus, Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createMemoryEntry, createNode } from '@/test/factories';

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

  it('rolls up active and pending memory from the cluster and its cards', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const house = await createCluster(domain.id, { slug: 'house' });
    const books = await createCluster(domain.id, { slug: 'books' });
    const node = await createNode(house.id);

    await createMemoryEntry({ clusterId: house.id, recallCount: 4 });
    await createMemoryEntry({ nodeId: node.id, recallCount: 2 });
    await createMemoryEntry({ nodeId: node.id, status: MemoryEntryStatus.PENDING });
    await createMemoryEntry({
      clusterId: house.id,
      status: MemoryEntryStatus.ARCHIVED,
      recallCount: 10,
    });

    const clusters = await listClusters(testDb, 'personal');

    expect(clusters.find((c) => c.id === house.id)?.memory).toEqual({
      activeCount: 2,
      pendingCount: 1,
      recallCount: 6,
    });
    expect(clusters.find((c) => c.id === books.id)?.memory).toEqual({
      activeCount: 0,
      pendingCount: 0,
      recallCount: 0,
    });
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

  it("counts each card's active memory", async () => {
    const domain = await createDomain({ slug: 'personal' });
    const cluster = await createCluster(domain.id, { slug: 'house' });
    const node = await createNode(cluster.id, { priority: Priority.NOW });
    await createMemoryEntry({ nodeId: node.id });
    await createMemoryEntry({ nodeId: node.id, status: MemoryEntryStatus.PENDING });

    const board = await getClusterBoard(testDb, 'personal', 'house');

    expect(board.tiers.NOW[0]?.memoryCount).toBe(1);
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

  it('flags description text and the kind of link on each card', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const cluster = await createCluster(domain.id, { slug: 'house' });
    const card = (title: string, position: number, description: string | null = null) =>
      createNode(cluster.id, { title, priority: Priority.NOW, position, description });

    await card('Plain', 0);
    await card('Notes', 1, 'Ask the neighbour which sealer he used.');
    await card(
      'Video',
      2,
      '[https://www.youtube.com/watch?v=yEpcimfWKrw](https://www.youtube.com/watch?v=yEpcimfWKrw "smartCard-inline")',
    );
    const shop = await card('Shop', 3);
    await testDb.attachment.create({
      data: { nodeId: shop.id, name: 'Lantern', url: 'https://www.amazon.com/dp/B0BW8FXWFY' },
    });
    const photo = await card('Photo', 4);
    await testDb.attachment.create({
      data: {
        nodeId: photo.id,
        name: 'IMG_4902.jpg',
        url: 'https://trello.com/1/cards/abc/attachments/def/download/IMG_4902.jpg',
        mimeType: 'image/jpeg',
        byteSize: 2400500,
      },
    });

    const board = await getClusterBoard(testDb, 'personal', 'house');

    expect(board.tiers.NOW.map((node) => [node.title, node.hasText, node.link])).toEqual([
      ['Plain', false, null],
      ['Notes', true, null],
      ['Video', false, 'youtube'],
      ['Shop', false, 'link'],
      ['Photo', false, null],
    ]);
    expect(board.tiers.NOW[4]?.attachmentCount).toBe(1);
  });

  it('only finds a cluster inside the named domain', async () => {
    const personal = await createDomain({ slug: 'personal' });
    await createDomain({ slug: 'work' });
    await createCluster(personal.id, { slug: 'house' });

    await expect(getClusterBoard(testDb, 'work', 'house')).rejects.toBeInstanceOf(NotFoundError);
  });
});
