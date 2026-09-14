import { Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { DomainError, NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createNode } from '@/test/factories';

import {
  archiveInboxItem,
  captureIdea,
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
  it('drops trimmed text into the domain inbox', async () => {
    const domain = await createDomain({ slug: 'personal' });

    const item = await captureIdea(testDb, { domainSlug: 'personal', text: '  Seal the deck  ' });

    expect(item).toMatchObject({ text: 'Seal the deck', archivedAt: null });
    const row = await testDb.inboxItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.domainId).toBe(domain.id);
  });

  it('refuses blank text', async () => {
    await createDomain({ slug: 'personal' });

    await expectDomainError(captureIdea(testDb, { domainSlug: 'personal', text: '   ' }), 'BAD_REQUEST');
  });

  it('throws NotFoundError for an unknown domain', async () => {
    await expect(captureIdea(testDb, { domainSlug: 'nowhere', text: 'Idea' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('listInbox', () => {
  it('lists waiting captures newest first, keeps archived ones apart, and leaves filed ones out', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const other = await createDomain({ slug: 'work' });
    const capture = (text: string, data: object = {}) =>
      testDb.inboxItem.create({ data: { domainId: domain.id, text, ...data } });

    await capture('older', { capturedAt: day(1) });
    await capture('newer', { capturedAt: day(3) });
    await capture('filed', { filedAt: day(4) });
    await capture('archived early', { archivedAt: day(2) });
    await capture('archived late', { archivedAt: day(5) });
    await testDb.inboxItem.create({ data: { domainId: other.id, text: 'elsewhere' } });

    const inbox = await listInbox(testDb, 'personal');

    expect(inbox.items.map((item) => item.text)).toEqual(['newer', 'older']);
    expect(inbox.archived.map((item) => item.text)).toEqual(['archived late', 'archived early']);
  });
});

describe('updateInboxItem', () => {
  it('rewrites a waiting capture', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const item = await testDb.inboxItem.create({ data: { domainId: domain.id, text: 'deck' } });

    const updated = await updateInboxItem(testDb, { id: item.id, text: ' Seal the deck before winter ' });

    expect(updated.text).toBe('Seal the deck before winter');
  });

  it('refuses to edit a filed or archived capture', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const filed = await testDb.inboxItem.create({
      data: { domainId: domain.id, text: 'filed', filedAt: new Date() },
    });
    const archived = await testDb.inboxItem.create({
      data: { domainId: domain.id, text: 'archived', archivedAt: new Date() },
    });

    await expectDomainError(updateInboxItem(testDb, { id: filed.id, text: 'x' }), 'CONFLICT');
    await expectDomainError(updateInboxItem(testDb, { id: archived.id, text: 'x' }), 'CONFLICT');
  });
});

describe('fileInboxItem', () => {
  async function setup() {
    const domain = await createDomain({ slug: 'personal' });
    const house = await createCluster(domain.id, { slug: 'house' });
    const item = await testDb.inboxItem.create({ data: { domainId: domain.id, text: 'Seal the deck' } });
    return { house, item };
  }

  it('turns a capture into a card after the last open card in the chosen tier', async () => {
    const { house, item } = await setup();
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
    expect(filed.filedAsNodeId).toBe(node.id);
    expect(filed.filedAt).toBeInstanceOf(Date);
    expect((await listInbox(testDb, 'personal')).items).toEqual([]);
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

  it("won't file into a cluster from another domain", async () => {
    const { item } = await setup();
    const work = await createDomain({ slug: 'work' });
    const elsewhere = await createCluster(work.id);

    await expect(
      fileInboxItem(testDb, {
        id: item.id,
        clusterId: elsewhere.id,
        title: 'Seal the deck',
        description: null,
        priority: Priority.NOW,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("won't file a capture twice, or file an archived one", async () => {
    const { house, item } = await setup();
    const input = { clusterId: house.id, title: 'Seal the deck', description: null, priority: Priority.NOW };
    await fileInboxItem(testDb, { id: item.id, ...input });
    const archived = await testDb.inboxItem.create({
      data: { domainId: house.domainId, text: 'Later', archivedAt: new Date() },
    });

    await expectDomainError(fileInboxItem(testDb, { id: item.id, ...input }), 'CONFLICT');
    await expectDomainError(fileInboxItem(testDb, { id: archived.id, ...input }), 'CONFLICT');
  });
});

describe('archiveInboxItem and restoreInboxItem', () => {
  it('moves a capture out of the inbox and back', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const item = await testDb.inboxItem.create({ data: { domainId: domain.id, text: 'Maybe' } });

    await archiveInboxItem(testDb, item.id);
    await archiveInboxItem(testDb, item.id);
    const archived = await listInbox(testDb, 'personal');
    expect(archived.items).toEqual([]);
    expect(archived.archived.map((i) => i.id)).toEqual([item.id]);

    await restoreInboxItem(testDb, item.id);
    const restored = await listInbox(testDb, 'personal');
    expect(restored.items.map((i) => i.id)).toEqual([item.id]);
    expect(restored.archived).toEqual([]);
  });

  it('refuses to archive a capture that was already filed', async () => {
    const domain = await createDomain({ slug: 'personal' });
    const filed = await testDb.inboxItem.create({
      data: { domainId: domain.id, text: 'Done', filedAt: new Date() },
    });

    await expectDomainError(archiveInboxItem(testDb, filed.id), 'CONFLICT');
  });
});
