/**
 * Minimal rows for tests. Each fills in required fields with unique values, so
 * a test only spells out what it's actually about.
 */
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
