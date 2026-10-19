// Import env first — it loads dotenv so process.env.EVENTS_DATABASE_URL is set
// before PrismaClient reads it (see lib/prisma.ts, which is imported transitively
// via app.ts → routes → ../lib/prisma).
import { env } from './lib/env';
import { app } from './app';
import { prisma } from './lib/prisma';

async function main() {
  await prisma.$connect().catch((error) => {
    console.error('Events DB connect failed (run db:push first):', error);
  });
  app.listen(env.PORT, env.HOST, () => {
    console.log(`Events API v1 on http://${env.HOST}:${env.PORT} (env: ${env.NODE_ENV})`);
  });
}

void main();
