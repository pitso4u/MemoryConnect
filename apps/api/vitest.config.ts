import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      DATABASE_URL: 'file:./test-pay-per-funeral.db',
      JWT_SECRET: 'test-secret-at-least-sixteen-characters',
      PAYSTACK_SECRET_KEY: 'sk_test_memory_connect',
      ADMIN_URL: 'http://localhost:5173',
    },
  },
});
