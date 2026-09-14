import { afterAll, beforeEach } from 'vitest';

import { resetDatabase, testDb } from './db';

beforeEach(resetDatabase);

afterAll(async () => {
  await testDb.$disconnect();
});
