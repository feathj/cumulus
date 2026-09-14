import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';

import { testDb } from '@/test/db';
import { createDomain } from '@/test/factories';

import { createCaller } from './root';

const caller = createCaller({ db: testDb });

describe('appRouter', () => {
  it('serves services through procedures', async () => {
    await createDomain({ slug: 'work', title: 'Work' });

    await expect(caller.domain.list()).resolves.toMatchObject([{ slug: 'work', title: 'Work' }]);
  });

  it("turns a service's NotFoundError into NOT_FOUND", async () => {
    const error = await caller.cluster
      .board({ domainSlug: 'work', clusterSlug: 'missing' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: 'NOT_FOUND', message: 'Cluster not found: work/missing' });
  });

  it('rejects invalid input as BAD_REQUEST', async () => {
    await expect(caller.cluster.list({ domainSlug: '   ' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
