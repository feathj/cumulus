import { Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { testDb } from '@/test/db';
import { createCluster, createDomain, createNode } from '@/test/factories';

import { createCaller } from '../root';

const caller = createCaller({ db: testDb });

describe('node.move', () => {
  it('moves a card', async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const node = await createNode(cluster.id, { priority: Priority.NOW });

    await caller.node.move({ id: node.id, priority: Priority.SOMEDAY, index: 0 });

    const moved = await testDb.node.findUniqueOrThrow({ where: { id: node.id } });
    expect(moved).toMatchObject({ priority: Priority.SOMEDAY, position: 0 });
  });

  it('rejects a slot that is not a whole, non-negative number', async () => {
    await expect(caller.node.move({ id: 'any', priority: Priority.NOW, index: -1 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(caller.node.move({ id: 'any', priority: Priority.NOW, index: 1.5 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it("maps a completed card's refusal to CONFLICT", async () => {
    const domain = await createDomain();
    const cluster = await createCluster(domain.id);
    const done = await createNode(cluster.id, { completedAt: new Date() });

    await expect(caller.node.move({ id: done.id, priority: Priority.NOW, index: 0 })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});

describe('node.transfer', () => {
  it('moves a card into another domain', async () => {
    const from = await createCluster((await createDomain()).id);
    const church = await createDomain({ slug: 'church' });
    const to = await createCluster(church.id, { slug: 'music' });
    const node = await createNode(from.id);

    const moved = await caller.node.transfer({ id: node.id, clusterId: to.id });

    expect(moved).toMatchObject({ domainSlug: 'church', clusterSlug: 'music' });
    expect(await testDb.node.findUniqueOrThrow({ where: { id: node.id } })).toMatchObject({ clusterId: to.id });
  });

  it('maps a move into the same cluster to BAD_REQUEST', async () => {
    const cluster = await createCluster((await createDomain()).id);
    const node = await createNode(cluster.id);

    await expect(caller.node.transfer({ id: node.id, clusterId: cluster.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects a slot that is not a whole, non-negative number', async () => {
    await expect(caller.node.transfer({ id: 'any', clusterId: 'any', index: -1 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
