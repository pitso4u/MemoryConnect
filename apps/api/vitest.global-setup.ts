import { execFileSync } from 'node:child_process';

// The API test suite runs against a throwaway SQLite database
// (test-pay-per-funeral.db). It is gitignored and never committed, so this
// setup runs `prisma db push` once before any test file to guarantee the
// schema exists from a fresh clone.
export default function setup() {
  execFileSync('npx', ['prisma', 'db', 'push', '--schema=prisma/schema.prisma', '--skip-generate', '--accept-data-loss'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: 'file:./test-pay-per-funeral.db' },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}