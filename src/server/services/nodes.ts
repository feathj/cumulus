import { MemoryEntryStatus } from '@prisma/client';
import type { AuthorKind, MemoryEntryType, NodeKind, Priority } from '@prisma/client';

import { NotFoundError } from '../errors';
import type { Db } from './types';

export interface NodeDetail {
  id: string;
  kind: NodeKind;
  title: string;
  description: string | null;
  priority: Priority;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cluster: { slug: string; title: string };
  domain: { slug: string; title: string };
  /** Newest first. */
  notes: { id: string; body: string; author: AuthorKind; occurredAt: Date }[];
  attachments: {
    id: string;
    name: string;
    url: string | null;
    mimeType: string | null;
    byteSize: number | null;
    description: string | null;
  }[];
  /** Active and pending memory owned by this card, most recently changed first. */
  memory: {
    id: string;
    type: MemoryEntryType;
    status: MemoryEntryStatus;
    title: string;
    description: string;
    recallCount: number;
  }[];
  /** Whether the card sits in its domain's focus block. */
  inFocus: boolean;
}

/** Everything the card detail panel shows. */
export async function getNodeDetail(db: Db, id: string): Promise<NodeDetail> {
  const node = await db.node.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      title: true,
      description: true,
      priority: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      cluster: {
        select: { slug: true, title: true, domain: { select: { slug: true, title: true } } },
      },
      notes: {
        orderBy: { occurredAt: 'desc' },
        select: { id: true, body: true, author: true, occurredAt: true },
      },
      attachments: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          url: true,
          mimeType: true,
          byteSize: true,
          description: true,
        },
      },
      memoryEntries: {
        where: { status: { in: [MemoryEntryStatus.ACTIVE, MemoryEntryStatus.PENDING] } },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          type: true,
          status: true,
          title: true,
          description: true,
          recallCount: true,
        },
      },
      _count: { select: { focusItems: true } },
    },
  });
  if (!node) throw new NotFoundError('Node', id);

  const { cluster, memoryEntries, _count, ...rest } = node;
  return {
    ...rest,
    cluster: { slug: cluster.slug, title: cluster.title },
    domain: cluster.domain,
    memory: memoryEntries,
    inFocus: _count.focusItems > 0,
  };
}
