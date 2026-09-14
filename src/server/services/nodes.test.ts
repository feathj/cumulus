import { MemoryEntryStatus, NodeKind } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';
import { createCluster, createDomain, createMemoryEntry, createNode } from '@/test/factories';

import { getNodeDetail } from './nodes';

describe('getNodeDetail', () => {
  it('returns a card with its path, notes newest first, attachments and live memory', async () => {
    const domain = await createDomain({ slug: 'personal', title: 'Personal' });
    const cluster = await createCluster(domain.id, { slug: 'house', title: 'House' });
    const node = await createNode(cluster.id, {
      title: 'Kitchen redo',
      kind: NodeKind.TOPIC,
      description: '- Floor to ceiling cabinets',
    });

    await testDb.note.create({
      data: { nodeId: node.id, body: 'older', occurredAt: new Date('2026-09-01T12:00:00Z') },
    });
    await testDb.note.create({
      data: { nodeId: node.id, body: 'newer', occurredAt: new Date('2026-09-05T12:00:00Z') },
    });
    await testDb.attachment.create({
      data: { nodeId: node.id, name: 'Inspiration', url: 'https://example.com/kitchen' },
    });
    await createMemoryEntry({ nodeId: node.id, title: 'Keep' });
    await createMemoryEntry({ nodeId: node.id, title: 'Gone', status: MemoryEntryStatus.ARCHIVED });
    await testDb.focusItem.create({ data: { domainId: domain.id, nodeId: node.id, position: 0 } });

    const detail = await getNodeDetail(testDb, node.id);

    expect(detail).toMatchObject({
      title: 'Kitchen redo',
      kind: NodeKind.TOPIC,
      description: '- Floor to ceiling cabinets',
      cluster: { slug: 'house', title: 'House' },
      domain: { slug: 'personal', title: 'Personal' },
      inFocus: true,
    });
    expect(detail.notes.map((n) => n.body)).toEqual(['newer', 'older']);
    expect(detail.attachments).toEqual([
      expect.objectContaining({ name: 'Inspiration', url: 'https://example.com/kitchen' }),
    ]);
    expect(detail.memory.map((m) => m.title)).toEqual(['Keep']);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(getNodeDetail(testDb, 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
