import { Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { testDb } from '@/test/db';
import { createCluster, createDomain } from '@/test/factories';

import { createCaller } from '../root';

const caller = createCaller({ db: testDb });

describe('inbox router', () => {
  it('captures an idea without a domain and files it into a card', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const cluster = await createCluster(domain.id, { slug: 'house' });

    const item = await caller.inbox.capture({ text: 'Seal the deck' });
    expect(await caller.inbox.count()).toBe(1);

    const filed = await caller.inbox.file({
      id: item.id,
      clusterId: cluster.id,
      title: 'Seal the deck',
      description: null,
      priority: Priority.NEXT,
    });

    expect(filed).toMatchObject({ domainSlug: 'personal', clusterSlug: 'house' });
    expect(await caller.inbox.list()).toEqual({ items: [], archived: [] });
    expect(await caller.inbox.count()).toBe(0);
  });

  it('rejects blank and oversized captures as BAD_REQUEST', async () => {
    await expect(caller.inbox.capture({ text: '   ' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller.inbox.capture({ text: 'x'.repeat(5001) })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
