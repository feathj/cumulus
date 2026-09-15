import { Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { DomainError, NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createNode } from '@/test/factories';

import {
  archiveInboxItem,
  captureIdea,
  countInbox,
  fileInboxItem,
  listInbox,
  restoreInboxItem,
  updateInboxItem,
} from './inbox';

async function expectDomainError(promise: Promise<unknown>, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect(error).toMatchObject({ code });
}

const day = (n: number) => new Date(Date.UTC(2026, 8, n));

describe('captureIdea', () => {
  it('drops trimmed text into the inbox, with no domain yet', async () => {
    const item = await captureIdea(testDb, { text: '  Seal the deck  ' });

    expect(item).toMatchObject({ text: 'Seal the deck', archivedAt: null, domain: null });
  });

  it('refuses blank text', async () => {
    await expectDomainError(captureIdea(testDb, { text: '   ' }), 'BAD_REQUEST');
  });
});

describe('listInbox and countInbox', () => {
  it('lists waiting captures from everywhere newest first, keeps archived ones apart, and leaves filed ones out', async () => {
    const personal = await createDomain({ slug: 'personal' });
    const capture = (text: string, data: object = {}) => testDb.inboxItem.create({ data: { text, ...data } });

    await capture('older', { capturedAt: day(1) });
    await capture('newer', { capturedAt: day(3), domainId: personal.id });
    await capture('filed', { filedAt: day(4) });
    await capture('archived early', { archivedAt: day(2) });
    await capture('archived late', { archivedAt: day(5) });

    const inbox = await listInbox(testDb);

    expect(inbox.items.map((item) => [item.text, item.domain?.slug ?? null])).toEqual([
      ['newer', 'personal'],
      ['older', null],
    ]);
    expect(inbox.archived.map((item) => item.text)).toEqual(['archived late', 'archived early']);
    expect(await countInbox(testDb)).toBe(2);
  });
});

describe('updateInboxItem', () => {
  it('rewrites a waiting capture', async () => {
    const item = await testDb.inboxItem.create({ data: { text: 'deck' } });

    const updated = await updateInboxItem(testDb, { id: item.id, text: ' Seal the deck before winter ' });

    expect(updated.text).toBe('Seal the deck before winter');
  });

  it('refuses to edit a filed or archived capture', async () => {
    const filed = await testDb.inboxItem.create({ data: { text: 'filed', filedAt: new Date() } });
    const archived = await testDb.inboxItem.create({ data: { text: 'archived', archivedAt: new Date() } });

    await expectDomainError(updateInboxItem(testDb, { id: filed.id, text: 'x' }), 'CONFLICT');
    await expectDomainError(updateInboxItem(testDb, { id: archived.id, text: 'x' }), 'CONFLICT');
  });
});

describe('fileInboxItem', () => {
  async function setup() {
    const personal = await createDomain({ slug: 'personal' });
    const house = await createCluster(personal.id, { slug: 'house' });
    const item = await testDb.inboxItem.create({ data: { text: 'Seal the deck' } });
    return { personal, house, item };
  }

  const as = (clusterId: string, priority: Priority = Priority.NOW) => ({
    clusterId,
    title: 'Seal the deck',
    description: null,
    priority,
  });

  it('turns a capture into a card after the last open card in the chosen tier', async () => {
    const { personal, house, item } = await setup();
    await createNode(house.id, { priority: Priority.NEXT, position: 0 });
    await createNode(house.id, { priority: Priority.NEXT, position: 4 });
    await createNode(house.id, { priority: Priority.NEXT, position: 9, completedAt: new Date() });
    await createNode(house.id, { priority: Priority.NEXT, position: 7, archivedAt: new Date() });

    const result = await fileInboxItem(testDb, {
      id: item.id,
      clusterId: house.id,
      title: ' Seal the deck ',
      description: '   ',
      priority: Priority.NEXT,
    });

    const node = await testDb.node.findUniqueOrThrow({ where: { id: result.nodeId } });
    expect(node).toMatchObject({
      clusterId: house.id,
      title: 'Seal the deck',
      description: null,
      priority: Priority.NEXT,
      position: 5,
    });
    expect(result).toEqual({ nodeId: node.id, domainSlug: 'personal', clusterSlug: 'house' });

    const filed = await testDb.inboxItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(filed).toMatchObject({ filedAsNodeId: node.id, domainId: personal.id });
    expect(filed.filedAt).toBeInstanceOf(Date);
    expect((await listInbox(testDb)).items).toEqual([]);
  });

  it('starts an empty tier at position 0 and keeps a description', async () => {
    const { house, item } = await setup();

    const result = await fileInboxItem(testDb, {
      id: item.id,
      clusterId: house.id,
      title: 'Seal the deck',
      description: 'Ask the neighbour which sealer he used.',
      priority: Priority.NOW,
    });

    expect(await testDb.node.findUniqueOrThrow({ where: { id: result.nodeId } })).toMatchObject({
      position: 0,
      description: 'Ask the neighbour which sealer he used.',
    });
  });

  it('files under the chosen cluster’s domain, whichever domain the capture was headed for', async () => {
    const { personal, house } = await setup();
    const work = await createDomain({ slug: 'work' });
    const headed = await testDb.inboxItem.create({ data: { text: 'Deck', domainId: work.id } });

    const result = await fileInboxItem(testDb, { id: headed.id, ...as(house.id) });

    expect(result).toMatchObject({ domainSlug: 'personal', clusterSlug: 'house' });
    expect((await testDb.inboxItem.findUniqueOrThrow({ where: { id: headed.id } })).domainId).toBe(personal.id);
  });

  it("won't file into an archived cluster, or a cluster in an archived domain", async () => {
    const { personal, item } = await setup();
    const retired = await createCluster(personal.id, { archivedAt: new Date() });
    const oldDomain = await createDomain({ slug: 'old', archivedAt: new Date() });
    const inOldDomain = await createCluster(oldDomain.id);

    for (const cluster of [retired, inOldDomain]) {
      await expect(fileInboxItem(testDb, { id: item.id, ...as(cluster.id) })).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  it("won't file a capture twice, or file an archived one", async () => {
    const { house, item } = await setup();
    await fileInboxItem(testDb, { id: item.id, ...as(house.id) });
    const archived = await testDb.inboxItem.create({ data: { text: 'Later', archivedAt: new Date() } });

    await expectDomainError(fileInboxItem(testDb, { id: item.id, ...as(house.id) }), 'CONFLICT');
    await expectDomainError(fileInboxItem(testDb, { id: archived.id, ...as(house.id) }), 'CONFLICT');
  });
});

describe('archiveInboxItem and restoreInboxItem', () => {
  it('moves a capture out of the inbox and back', async () => {
    const item = await testDb.inboxItem.create({ data: { text: 'Maybe' } });

    await archiveInboxItem(testDb, item.id);
    await archiveInboxItem(testDb, item.id);
    const archived = await listInbox(testDb);
    expect(archived.items).toEqual([]);
    expect(archived.archived.map((i) => i.id)).toEqual([item.id]);

    await restoreInboxItem(testDb, item.id);
    const restored = await listInbox(testDb);
    expect(restored.items.map((i) => i.id)).toEqual([item.id]);
    expect(restored.archived).toEqual([]);
  });

  it('refuses to archive a capture that was already filed', async () => {
    const filed = await testDb.inboxItem.create({ data: { text: 'Done', filedAt: new Date() } });

    await expectDomainError(archiveInboxItem(testDb, filed.id), 'CONFLICT');
  });
});
