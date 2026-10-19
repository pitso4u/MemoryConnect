import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { prisma } from './prisma';

export interface EventsAuthPayload {
  userId: string;
  organiserId: string;
  role?: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      eventsUser?: EventsAuthPayload;
    }
  }
}

export function signEventsToken(payload: EventsAuthPayload): string {
  return jwt.sign(payload, env.EVENTS_JWT_SECRET, { expiresIn: env.EVENTS_JWT_EXPIRES_IN } as jwt.SignOptions);
}

export async function authenticateEvents(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(header.slice(7), env.EVENTS_JWT_SECRET) as EventsAuthPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, include: { organiser: true } });
    if (!user || user.organiserId !== payload.organiserId || user.organiser.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
    req.eventsUser = { userId: user.id, organiserId: user.organiserId, email: user.email, role: user.role };
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requireEventsSuperuser(req: Request, res: Response, next: NextFunction) {
  if (req.eventsUser?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'Events platform owner access required' });
  }
  next();
}
