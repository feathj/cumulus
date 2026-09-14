import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * A client or an open transaction. Services take either, so a caller can run
 * several of them inside one `db.$transaction` — the memory write path will
 * need that to keep an entry and its revision in step.
 */
export type Db = PrismaClient | Prisma.TransactionClient;
