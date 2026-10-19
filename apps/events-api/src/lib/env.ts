import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load order: host env wins; then apps/events-api/.env; then repo root .env.
// Never reads Memorial secrets — only EVENTS_* keys are parsed below.
for (const candidate of [
  path.join(process.cwd(), 'apps/events-api/.env'),
  path.join(process.cwd(), '.env'),
]) {
  if (fs.existsSync(candidate)) dotenv.config({ path: candidate, override: false });
}
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('4101'),
  HOST: z.string().default('0.0.0.0'),
  EVENTS_DATABASE_URL: z.string().min(1),
  EVENTS_JWT_SECRET: z.string().min(16, 'EVENTS_JWT_SECRET must be at least 16 characters'),
  EVENTS_JWT_EXPIRES_IN: z.string().default('7d'),
  EVENTS_CORS_ORIGIN: z.string().default('http://localhost:5177'),
  EVENTS_UPLOADS_DIR: z.string().default('./uploads'),
  EVENTS_PUBLIC_URL: z.string().default('http://localhost:5177'),
  EVENTS_PAYSTACK_SECRET_KEY: z.string().optional(),
  EVENTS_AUTH_RATE_LIMIT_MAX: z.string().transform(Number).pipe(z.number().int().positive()).default('10'),
  EVENTS_MESSAGE_RATE_LIMIT_MAX: z.string().transform(Number).pipe(z.number().int().positive()).default('5'),
});

export const env = envSchema.parse(process.env);
