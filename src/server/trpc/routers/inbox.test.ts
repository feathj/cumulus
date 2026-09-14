import { Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { testDb } from '@/test/db';
import { createCluster, createDomain } from '@/test/factories';

import { createCaller } from '../root';

const caller = createCaller({ db: testDb });

describe('inbox router', () => {
  it('captures an idea and files it into a card', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const cluster = await createCluster(domain.id, { slug: 'house' });

    const item = await caller.inbox.capture({ domainSlug: 'personal', text: 'Seal the deck' });
    const filed = await caller.inbox.file({
      id: item.id,
      clusterId: cluster.id,
      title: 'Seal the deck',
      description: null,
      priority: Priority.NEXT,
    });

    expect(filed).toMatchObject({ domainSlug: 'personal', clusterSlug: 'house' });
    expect(await caller.inbox.list({ domainSlug: 'personal' })).toEqual({ items: [], archived: [] });
  });

  it('rejects blank and oversized captures as BAD_REQUEST', async () => {
    await createDomain({ slug: 'personal' });

    await expect(caller.inbox.capture({ domainSlug: 'personal', text: '   ' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(
      caller.inbox.capture({ domainSlug: 'personal', text: 'x'.repeat(5001) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
