import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../lib/env';

export interface AuthPayload {
  userId: string;
  funeralHomeId: string;
  role: string;
}

export interface PreviewPayload {
  kind: 'memorial_preview';
  memorialId: string;
  funeralHomeId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as SignOptions);
}

export function signPreviewToken(memorialId: string, funeralHomeId: string): string {
  return jwt.sign(
    { kind: 'memorial_preview', memorialId, funeralHomeId } satisfies PreviewPayload,
    env.JWT_SECRET,
    { expiresIn: '15m' },
  );
}

export function verifyPreviewToken(token?: string): PreviewPayload | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as PreviewPayload;
    return payload.kind === 'memorial_preview' ? payload : null;
  } catch {
    return null;
  }
}
