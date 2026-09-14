import 'dotenv/config';

import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Config lives here rather than under `package.json#prisma`, which Prisma 7
// drops. Note that a config file also turns off Prisma's implicit .env
// loading, hence the dotenv import above.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
