import 'dotenv/config';

/**
 * The test database URL. Tests truncate every table between cases, so this
 * refuses to hand back anything that could be the development database.
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set. Add it to .env; see .env.example.');
  if (url === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL points at the same database as DATABASE_URL.');
  }
  return url;
}
