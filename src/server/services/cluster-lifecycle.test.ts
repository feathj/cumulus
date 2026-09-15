import { MemoryEntryStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { DomainError, NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster as makeCluster, createDomain, createMemoryEntry, createNode } from '@/test/factories';

import { archiveCluster, createCluster, getClusterBoard, listClusters, restoreCluster } from './clusters';
import { listDomains } from './domains';

async function expectDomainError(promise: Promise<unknown>, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect(error).toMatchObject({ code });
}

describe('createCluster', () => {
  it('adds an empty cluster at the end, with a slug from its name', async () => {
    const domain = await createDomain({ slug: 'personal' });
    await makeCluster(domain.id, { slug: 'house', title: 'House', position: 3 });

    const garden = await createCluster(testDb, { domainSlug: 'personal', title: '  Home   & Garden ' });

    expect(garden).toMatchObject({ slug: 'home-and-garden', title: 'Home & Garden' });
    const clusters = await listClusters(testDb, 'personal');
    expect(clusters.map((c) => [c.slug, c.position, c.openNodeCount])).toEqual([
      ['house', 3, 0],
      ['home-and-garden', 4, 0],
    ]);
  });

  it("doesn't reuse an archived cluster's slug", async () => {
    const domain = await createDomain({ slug: 'personal' });
    await makeCluster(domain.id, { slug: 'house', title: 'Old house', archivedAt: new Date() });

    expect((await createCluster(testDb, { domainSlug: 'personal', title: 'House' })).slug).toBe('house-2');
  });

  it('refuses a name already in use, ignoring case, including by an archived cluster', async () => {
    const domain = await createDomain({ slug: 'personal' });
    await makeCluster(domain.id, { title: 'House' });
    await makeCluster(domain.id, { title: 'Guitar', archivedAt: new Date() });

    await expectDomainError(createCluster(testDb, { domainSlug: 'personal', title: 'house' }), 'CONFLICT');
    await expectDomainError(createCluster(testDb, { domainSlug: 'personal', title: 'Guitar' }), 'CONFLICT');
  });

  it('refuses a blank name and an unknown domain', async () => {
    await createDomain({ slug: 'personal' });

    await expectDomainError(createCluster(testDb, { domainSlug: 'personal', title: '   ' }), 'BAD_REQUEST');
    await expect(createCluster(testDb, { domainSlug: 'nowhere', title: 'House' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('archiveCluster and restoreCluster', () => {
  it('takes a cluster and its cards out of the domain, and brings them back', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const house = await makeCluster(domain.id, { slug: 'house' });
    await makeCluster(domain.id, { slug: 'books' });
    const card = await createNode(house.id);
    await testDb.focusItem.create({ data: { domainId: domain.id, nodeId: card.id, position: 0 } });
    await createMemoryEntry({ nodeId: card.id, status: MemoryEntryStatus.PENDING });

    await archiveCluster(testDb, house.id);
    await archiveCluster(testDb, house.id);

    expect((await listClusters(testDb, 'personal')).map((c) => c.slug)).toEqual(['books']);
    await expect(getClusterBoard(testDb, 'personal', 'house')).rejects.toBeInstanceOf(NotFoundError);
    expect((await listDomains(testDb))[0]).toMatchObject({
      clusterCount: 1,
      openNodeCount: 0,
      focusCount: 0,
      pendingMemoryCount: 0,
    });

    await restoreCluster(testDb, house.id);

    expect((await listClusters(testDb, 'personal')).map((c) => c.slug)).toEqual(['house', 'books']);
    expect((await listDomains(testDb))[0]).toMatchObject({
      clusterCount: 2,
      openNodeCount: 1,
      pendingMemoryCount: 1,
    });
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(archiveCluster(testDb, 'missing')).rejects.toBeInstanceOf(NotFoundError);
    await expect(restoreCluster(testDb, 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
