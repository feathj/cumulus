import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * A client or an open transaction. Services take either, so a caller can run
 * several of them inside one `db.$transaction` — the memory write path will
 * need that to keep an entry and its revision in step.
 */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Runs `work` in a transaction, or inside the caller's if `db` already is one. */
export function withTransaction<T>(
  db: Db,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return '$transaction' in db ? db.$transaction(work) : work(db);
}
