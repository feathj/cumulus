/**
 * Minimal rows for tests. Each fills in required fields with unique values, so
 * a test only spells out what it's actually about.
 */
import {
  AuthorKind,
  MemoryEntryStatus,
  MemoryEntryType,
  MemoryEventKind,
  MemoryRevisionAction,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { testDb } from './db';

let sequence = 0;

export function createDomain(data: Partial<Prisma.DomainUncheckedCreateInput> = {}) {
  const n = ++sequence;
  return testDb.domain.create({
    data: { slug: `domain-${n}`, title: `Domain ${n}`, themeHue: 200, position: n, ...data },
  });
}

export function createCluster(
  domainId: string,
  data: Partial<Prisma.ClusterUncheckedCreateInput> = {},
) {
  const n = ++sequence;
  return testDb.cluster.create({
    data: { domainId, slug: `cluster-${n}`, title: `Cluster ${n}`, position: n, ...data },
  });
}

export function createNode(clusterId: string, data: Partial<Prisma.NodeUncheckedCreateInput> = {}) {
  const n = ++sequence;
  return testDb.node.create({ data: { clusterId, title: `Node ${n}`, ...data } });
}

/** An active fact with no owner; pass `clusterId`, `nodeId` or `domainId` to scope it. */
export function createMemoryEntry(data: Partial<Prisma.MemoryEntryUncheckedCreateInput> = {}) {
  const n = ++sequence;
  return testDb.memoryEntry.create({
    data: {
      type: MemoryEntryType.FACT,
      status: MemoryEntryStatus.ACTIVE,
      title: `Entry ${n}`,
      description: `Description ${n}`,
      body: `Body ${n}`,
      ...data,
    },
  });
}

export function createMemoryEvent(data: Partial<Prisma.MemoryEventUncheckedCreateInput> = {}) {
  const n = ++sequence;
  return testDb.memoryEvent.create({
    data: { kind: MemoryEventKind.LOG, title: `Event ${n}`, occurredAt: new Date(), ...data },
  });
}

export function createRevision(
  entryId: string,
  data: Partial<Prisma.MemoryRevisionUncheckedCreateInput> = {},
) {
  return testDb.memoryRevision.create({
    data: {
      entryId,
      action: MemoryRevisionAction.CREATED,
      author: AuthorKind.AGENT,
      snapshot: {},
      ...data,
    },
  });
}
