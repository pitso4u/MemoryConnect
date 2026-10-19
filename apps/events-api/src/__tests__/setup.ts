import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { afterAll, beforeEach } from 'vitest';

// Runs before test files are imported (so before src/lib/env.ts is parsed).
// Pushes the Events schema to an isolated TEST database file — never the
// dev events.db and never memoryconnect.db — then empties all tables.
const apiDir = path.resolve(__dirname, '../..');

execSync('npx prisma db push --schema=prisma/schema.prisma --skip-generate', {
  cwd: apiDir,
  stdio: 'pipe',
});

const uploads = path.join(apiDir, 'prisma/test-uploads');
fs.rmSync(uploads, { recursive: true, force: true });
fs.mkdirSync(uploads, { recursive: true });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('../../generated-client') as typeof import('../../generated-client');
const prisma = new PrismaClient();

beforeEach(async () => {
  // FK order: children first.
  await prisma.analyticsEvent.deleteMany();
  await prisma.eventView.deleteMany();
  await prisma.eventPayment.deleteMany();
  await prisma.eventMessage.deleteMany();
  await prisma.eventPhoto.deleteMany();
  await prisma.eventLocation.deleteMany();
  await prisma.eventAgendaItem.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organiser.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
