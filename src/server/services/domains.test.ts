import { MemoryEntryStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createMemoryEntry, createNode } from '@/test/factories';

import { getDomain, listDomains } from './domains';

describe('listDomains', () => {
  it('lists live domains in switcher order', async () => {
    await createDomain({ slug: 'church', position: 2 });
    await createDomain({ slug: 'work', position: 0 });
    await createDomain({ slug: 'retired', position: 1, archivedAt: new Date() });

    const domains = await listDomains(testDb);

    expect(domains.map((d) => d.slug)).toEqual(['work', 'church']);
  });

  it('counts only live clusters, open cards in them, focus items and unfiled captures', async () => {
    const domain = await createDomain({ slug: 'work' });
    const live = await createCluster(domain.id);
    const archived = await createCluster(domain.id, { archivedAt: new Date() });

    const open = await createNode(live.id);
    await createNode(live.id, { completedAt: new Date() });
    await createNode(archived.id);

    await testDb.focusItem.create({ data: { domainId: domain.id, nodeId: open.id, position: 0 } });
    await testDb.inboxItem.create({ data: { domainId: domain.id, text: 'Waiting' } });
    await testDb.inboxItem.create({
      data: { domainId: domain.id, text: 'Tossed', archivedAt: new Date() },
    });
    await testDb.inboxItem.create({
      data: { domainId: domain.id, text: 'Filed', filedAt: new Date() },
    });

    const [summary] = await listDomains(testDb);

    expect(summary).toMatchObject({
      clusterCount: 1,
      openNodeCount: 1,
      focusCount: 1,
      inboxCount: 1,
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

describe('getDomain', () => {
  it('does not find an archived domain', async () => {
    await createDomain({ slug: 'retired', archivedAt: new Date() });

    await expect(getDomain(testDb, 'retired')).rejects.toBeInstanceOf(NotFoundError);
  });
});
