import { describe, expect, it } from 'vitest';

import { testDb } from '@/test/db';
import { createDomain } from '@/test/factories';

import { createCaller } from '../root';

const caller = createCaller({ db: testDb });

describe('cluster router', () => {
  it('creates a cluster and maps a duplicate name to CONFLICT', async () => {
    await createDomain({ slug: 'personal' });

    const created = await caller.cluster.create({ domainSlug: 'personal', title: 'House' });

    expect(created.slug).toBe('house');
    await expect(caller.cluster.create({ domainSlug: 'personal', title: 'House' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('rejects a blank or overlong name as BAD_REQUEST', async () => {
    await createDomain({ slug: 'personal' });

    for (const title of ['   ', 'x'.repeat(81)]) {
      await expect(caller.cluster.create({ domainSlug: 'personal', title })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    }
  });

  it('archives and restores a cluster by id', async () => {
    await createDomain({ slug: 'personal' });
    const { id } = await caller.cluster.create({ domainSlug: 'personal', title: 'House' });

    await caller.cluster.archive({ id });
    expect(await caller.cluster.list({ domainSlug: 'personal' })).toEqual([]);

    await caller.cluster.restore({ id });
    expect((await caller.cluster.list({ domainSlug: 'personal' })).map((c) => c.id)).toEqual([id]);
  });
});
