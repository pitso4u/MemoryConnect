import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // All test files share a single SQLite file (test-pay-per-funeral.db) and a
    // single global feature registry. Running files in parallel lets one file's
    // global feature toggles bleed into another file's assertions, so the suite
    // runs sequentially.
    fileParallelism: false,
    env: {
      DATABASE_URL: 'file:./test-pay-per-funeral.db',
      JWT_SECRET: 'test-secret-at-least-sixteen-characters',
      PAYSTACK_SECRET_KEY: 'sk_test_memory_connect',
      ADMIN_URL: 'http://localhost:5173',
      AUTH_RATE_LIMIT_MAX: '5',
    },
  },
});
