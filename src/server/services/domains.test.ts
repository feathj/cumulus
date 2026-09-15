import { MemoryEntryStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createMemoryEntry, createNode } from '@/test/factories';

import { getDomain, listDomainCloud, listDomains } from './domains';

describe('listDomains', () => {
  it('lists live domains in switcher order', async () => {
    await createDomain({ slug: 'church', position: 2 });
    await createDomain({ slug: 'work', position: 0 });
    await createDomain({ slug: 'retired', position: 1, archivedAt: new Date() });

    const domains = await listDomains(testDb);

    expect(domains.map((d) => d.slug)).toEqual(['work', 'church']);
  });

  it('counts only live clusters, open cards in them, and focus items', async () => {
    const domain = await createDomain({ slug: 'work' });
    const live = await createCluster(domain.id);
    const archived = await createCluster(domain.id, { archivedAt: new Date() });

    const open = await createNode(live.id);
    await createNode(live.id, { completedAt: new Date() });
    await createNode(archived.id);

    await testDb.focusItem.create({ data: { domainId: domain.id, nodeId: open.id, position: 0 } });

    const [summary] = await listDomains(testDb);

    expect(summary).toMatchObject({
      clusterCount: 1,
      openNodeCount: 1,
      focusCount: 1,
    });
  });

  it('counts pending memory at every level of the domain', async () => {
    const domain = await createDomain({ slug: 'work' });
    const other = await createDomain({ slug: 'church' });
    const cluster = await createCluster(domain.id);
    const node = await createNode(cluster.id);
    const pending = { status: MemoryEntryStatus.PENDING };

    await createMemoryEntry({ ...pending, domainId: domain.id });
    await createMemoryEntry({ ...pending, clusterId: cluster.id });
    await createMemoryEntry({ ...pending, nodeId: node.id });
    await createMemoryEntry({ clusterId: cluster.id });
    await createMemoryEntry({ ...pending, domainId: other.id });

    const domains = await listDomains(testDb);

    expect(domains.find((d) => d.slug === 'work')?.pendingMemoryCount).toBe(3);
  });
});

describe('listDomainCloud', () => {
  it('gives each live domain its live clusters in order, with open cards counted', async () => {
    const work = await createDomain({ slug: 'work', position: 0 });
    await createDomain({ slug: 'church', position: 1 });
    await createDomain({ slug: 'retired', position: 2, archivedAt: new Date() });
    const ship = await createCluster(work.id, { slug: 'ship', position: 1 });
    await createCluster(work.id, { slug: 'think', position: 0 });
    await createCluster(work.id, { slug: 'old', position: 2, archivedAt: new Date() });
    await createNode(ship.id);
    await createNode(ship.id, { completedAt: new Date() });
    await createNode(ship.id, { archivedAt: new Date() });

    const cloud = await listDomainCloud(testDb);

    expect(cloud.map((d) => [d.slug, d.clusters.map((c) => [c.slug, c.openNodeCount])])).toEqual([
      [
        'work',
        [
          ['think', 0],
          ['ship', 1],
        ],
      ],
      ['church', []],
    ]);
    expect(cloud[0]).toMatchObject({ clusterCount: 2, openNodeCount: 1 });
  });
});

describe('getDomain', () => {
  it('does not find an archived domain', async () => {
    await createDomain({ slug: 'retired', archivedAt: new Date() });

    await expect(getDomain(testDb, 'retired')).rejects.toBeInstanceOf(NotFoundError);
  });
});
