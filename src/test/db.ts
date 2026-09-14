import { PrismaClient } from '@prisma/client';

import { testDatabaseUrl } from './env';

export const testDb = new PrismaClient({ datasourceUrl: testDatabaseUrl() });

/** Empty every table, keeping the schema and migration history. */
export async function resetDatabase(): Promise<void> {
  const tables = await testDb.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (!tables.length) return;
  const names = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await testDb.$executeRawUnsafe(`TRUNCATE TABLE ${names} CASCADE`);
}
