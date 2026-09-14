import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // Every file shares one test database and truncates it between cases, so
    // files must not run concurrently.
    fileParallelism: false,
  },
});
