import { rateLimit } from 'express-rate-limit';
import { env } from './env';

// Brute-force protection on credential endpoints.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.EVENTS_AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts. Please try again later.' },
});

// Spam protection on public guest-message submission (per IP).
export const messageLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: env.EVENTS_MESSAGE_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many messages. Please try again later.' },
});

// Abuse protection on anonymous engagement endpoints (generous).
export const engagementLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' },
});
