import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    sequence: { shuffle: false },
    // One test file at a time: both suites share the same isolated SQLite
    // file and uploads dir, so parallel workers would flake each other.
    poolOptions: { forks: { singleFork: true } },
    // Isolated test runtime: separate DB file, secret, uploads, generous auth
    // limit (rate limiting itself is asserted on the message route below).
    env: {
      NODE_ENV: 'test',
      EVENTS_DATABASE_URL: 'file:./prisma/test-events.db',
      EVENTS_JWT_SECRET: 'test-only-events-secret-min-16-chars',
      EVENTS_JWT_EXPIRES_IN: '7d',
      EVENTS_CORS_ORIGIN: '*',
      EVENTS_UPLOADS_DIR: './prisma/test-uploads',
      EVENTS_PUBLIC_URL: 'http://localhost:5177',
      EVENTS_PAYSTACK_SECRET_KEY: 'test-paystack-key-not-real',
      EVENTS_AUTH_RATE_LIMIT_MAX: '100',
      EVENTS_MESSAGE_RATE_LIMIT_MAX: '5',
    },
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
