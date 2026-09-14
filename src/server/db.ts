import { PrismaClient } from '@prisma/client';

// Next.js dev-server hot reloads re-evaluate modules, so cache the client on
// globalThis to avoid opening a new connection pool on every reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
