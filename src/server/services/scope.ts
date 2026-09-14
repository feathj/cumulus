import type { Prisma } from '@prisma/client';

/*
 * Memory stores only its narrowest owner (see prisma/schema.prisma), so "the
 * memory in a cluster" means rows owned by the cluster or by one of its nodes,
 * and "in a domain" adds rows owned by the domain itself.
 */

export function entriesInCluster(clusterId: string): Prisma.MemoryEntryWhereInput {
  return { OR: [{ clusterId }, { node: { clusterId } }] };
}

export function eventsInCluster(clusterId: string): Prisma.MemoryEventWhereInput {
  return { OR: [{ clusterId }, { node: { clusterId } }] };
}

export function entriesInDomain(domainId: string): Prisma.MemoryEntryWhereInput {
  return { OR: [{ domainId }, { cluster: { domainId } }, { node: { cluster: { domainId } } }] };
}
