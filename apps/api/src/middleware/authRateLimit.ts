import rateLimit, { MemoryStore } from 'express-rate-limit';
import { env } from '../lib/env';

/**
 * Brute-force protection for credential submission only. Applied per-route to
 * `POST /login` and `POST /register` instead of the whole auth router so that
 * authenticated checks (`/me`, `/my-features`, profile, …) never consume the
 * bucket — a stale SPA session polling those endpoints can no longer lock out
 * every client behind the same proxy IP.
 */
export const authLimiterStore = new MemoryStore();

export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX ?? (env.NODE_ENV === 'production' ? 10 : 100),
  message: { success: false, message: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: authLimiterStore,
});
