import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { seedShowcase } from '../scripts/seed-showcase';

const api = request(app);

const SLUGS = ['sarah-john-wedding-demo', 'thabo-50th-birthday-demo', 'naledi-graduation-demo'];
const PASSWORD = 'test-showcase-password-123';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('../../generated-client') as typeof import('../../generated-client');

describe('showcase seed', () => {
  it('running twice yields exactly 3 published, unexpiring demo events', async () => {
    await seedShowcase(PASSWORD);
    await seedShowcase(PASSWORD);
    const prisma = new PrismaClient();
    try {
      const demos = await prisma.event.findMany({ where: { isDemo: true } });
      expect(demos.map((e) => e.slug).sort()).toEqual([...SLUGS].sort());
      for (const e of demos) {
        expect(e.status).toBe('PUBLISHED');
        expect(e.visibility).toBe('UNLISTED');
        expect(e.expiresAt).toBeNull();
      }
      const total = await prisma.event.count({ where: { slug: { in: SLUGS } } });
      expect(total).toBe(3);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('rejects guest messages on demo events with 403', async () => {
    await seedShowcase(PASSWORD);
    const res = await api
      .post('/api/v1/public/events/sarah-john-wedding-demo/messages')
      .send({ authorName: 'Test Guest', message: 'Hello, what a lovely page!' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/example pages/i);
  });
});
