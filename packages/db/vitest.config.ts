import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Pure logic only — exclude engine-select's siblings that import the Prisma client.
    include: ['src/**/*.test.ts'],
  },
});
