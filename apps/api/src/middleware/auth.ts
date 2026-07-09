import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../lib/env';
import { prisma } from '../lib/prisma';

export interface AuthPayload {
  userId: string;
  funeralHomeId?: string | null;
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

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, funeralHomeId: true, funeralHome: { select: { status: true } } },
    });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    if (user.funeralHome?.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, error: 'This funeral home account has been suspended. Please contact Memory Connect support.' });
    }
    req.user = { userId: user.id, funeralHomeId: user.funeralHomeId, role: normalizeRole(user.role) };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  FUNERAL_HOME_ADMIN: 'FUNERAL_HOME_ADMIN',
  FUNERAL_HOME_STAFF: 'FUNERAL_HOME_STAFF',
  FAMILY_MANAGER: 'FAMILY_MANAGER',
  FAMILY_CONTRIBUTOR: 'FAMILY_CONTRIBUTOR',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export function normalizeRole(role?: string | null): UserRole | string {
  const value = (role || '').trim();
  if (value.toLowerCase() === 'admin') return ROLES.FUNERAL_HOME_ADMIN;
  if (value.toLowerCase() === 'staff') return ROLES.FUNERAL_HOME_STAFF;
  return value.toUpperCase();
}

export function isFuneralHomeRole(role?: string | null) {
  const normalized = normalizeRole(role);
  return new Set<string>([ROLES.SUPER_ADMIN, ROLES.FUNERAL_HOME_ADMIN, ROLES.FUNERAL_HOME_STAFF]).has(normalized);
}

export function isFamilyRole(role?: string | null) {
  const normalized = normalizeRole(role);
  return new Set<string>([ROLES.FAMILY_MANAGER, ROLES.FAMILY_CONTRIBUTOR]).has(normalized);
}

export function canManageFuneralHome(role?: string | null) {
  return new Set<string>([ROLES.SUPER_ADMIN, ROLES.FUNERAL_HOME_ADMIN]).has(normalizeRole(role));
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  return authenticate(req, res, next);
}

export function requireRole(roles: string[]) {
  const allowed = roles.map(normalizeRole);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ success: false, error: 'You do not have permission to perform this action' });
    }
    next();
  };
}

export function requireFuneralHomeAccess(funeralHomeIdFromRequest: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    const funeralHomeId = funeralHomeIdFromRequest(req);
    const role = normalizeRole(req.user?.role);
    if (role === ROLES.SUPER_ADMIN || (funeralHomeId && req.user?.funeralHomeId === funeralHomeId && isFuneralHomeRole(role))) {
      return next();
    }
    return res.status(403).json({ success: false, error: 'Funeral home access required' });
  };
}

export async function canAccessMemorial(user: AuthPayload, memorialId: string) {
  const memorial = await prisma.memorial.findUnique({
    where: { id: memorialId },
    select: { id: true, funeralHomeId: true, status: true, deletedAt: true },
  });
  if (!memorial) return null;

  const role = normalizeRole(user.role);
  if (role === ROLES.SUPER_ADMIN) return memorial;
  if (user.funeralHomeId === memorial.funeralHomeId && new Set<string>([ROLES.FUNERAL_HOME_ADMIN, ROLES.FUNERAL_HOME_STAFF]).has(role)) {
    return memorial;
  }

  const access = await prisma.memorialAccess.findUnique({
    where: { memorialId_userId: { memorialId, userId: user.userId } },
  });
  return access ? memorial : null;
}

export function requireMemorialAccess(memorialIdFromRequest: (req: Request) => string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    const memorial = await canAccessMemorial(req.user, memorialIdFromRequest(req));
    if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
    next();
  };
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign({ ...payload, role: normalizeRole(payload.role) }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as SignOptions);
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
