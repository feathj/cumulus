import { execFileSync } from 'node:child_process';

import { testDatabaseUrl } from './env';

/**
 * Runs once before the suite: brings the test database's schema up to date.
 * `migrate deploy` only applies pending migrations, so it's safe to run every
 * time; each test starts from empty tables via `setup.ts`.
 */
export default function globalSetup(): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}
