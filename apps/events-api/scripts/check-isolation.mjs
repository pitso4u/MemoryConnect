// Isolation guard: Events must never import Memorial's Prisma client, JWT
// secret, or database — and Memorial must never import Events internals.
// Run: npm run check:isolation -w @memorialconnect/events-api
import fs from 'fs';
import path from 'path';

const root = path.resolve(new URL('.', import.meta.url).pathname, '../..');
const failures = [];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function assertNo(dir, patterns, label) {
  if (!fs.existsSync(dir)) return;
  for (const file of walk(dir)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const { re, message } of patterns) {
      if (re.test(content)) failures.push(`${label}: ${path.relative(root, file)} — ${message}`);
    }
  }
}

// Events API may only use its isolated generated client + EVENTS_* secrets.
assertNo(path.join(root, 'apps/events-api/src'), [
  { re: /from\s+['"]@prisma\/client['"]/, message: 'must import Prisma from ../../generated-client, not @prisma/client' },
  { re: /process\.env\.JWT_SECRET\b/, message: 'must use EVENTS_JWT_SECRET, never Memorial JWT_SECRET' },
  { re: /process\.env\.DATABASE_URL\b/, message: 'must use EVENTS_DATABASE_URL, never Memorial DATABASE_URL' },
  { re: /memoryconnect\.db/, message: 'must never reference the Memorial database file' },
  { re: /@memorialconnect\/shared/, message: 'must use @memorialconnect/event-shared, not Memorial shared' },
], 'events-api');

// Memorial code must never reach into Events internals.
for (const dir of ['apps/api/src', 'apps/memorial/src', 'apps/admin/src', 'apps/sales-crm/src']) {
  assertNo(path.join(root, dir), [
    { re: /generated-client/, message: 'Memorial code must not import the Events Prisma client' },
    { re: /event-shared/, message: 'Memorial code must not import Events shared models' },
    { re: /EVENTS_JWT_SECRET|EVENTS_DATABASE_URL/, message: 'Memorial code must not use Events secrets' },
  ], dir);
}

if (failures.length > 0) {
  console.error('Isolation check FAILED:');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('Isolation check passed: Events and Memorial runtimes are decoupled.');
