import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../lib/env';
import { prisma } from '../lib/prisma';

export interface AuthPayload {
  userId: string;
  funeralHomeId?: string | null;
  role: string;
  /** Matches the user's tokenVersion; a mismatch means the session was revoked. */
  tokenVersion?: number;
  /** Restricted-scope token issued after a successful login with a temporary password. */
  scope?: 'password_change';
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
      /** Set when a SUPER_ADMIN is managing another funeral home via the X-Managing-Funeral-Home header. */
      managingFuneralHomeId?: string;
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
      select: { id: true, role: true, funeralHomeId: true, tokenVersion: true, funeralHome: { select: { status: true } } },
    });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    if (user.funeralHome?.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, error: 'This funeral home account has been suspended. Please contact Memory Connect support.' });
    }
    // A token signed against an older tokenVersion was issued before the session
    // was revoked (temp password issued or password changed) and is now stale.
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    // Temporary-password tokens are scoped: they may only reach the
    // change-password endpoint until the user sets a permanent password.
    const targetPath = `${req.baseUrl}${req.path}`;
    if (payload.scope === 'password_change' && !/\/change-password$/.test(targetPath)) {
      return res.status(403).json({ success: false, error: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    const role = normalizeRole(user.role);
    // SUPER_ADMIN management context. The header identifies which funeral home the
    // platform owner is currently managing; identity stays SUPER_ADMIN and only
    // the scoping funeralHomeId is overridden so the owner's own account is never
    // used. Non-SUPER_ADMIN callers may never set the header, and the target home
    // must exist.
    const managingId = req.headers['x-managing-funeral-home'];
    if (managingId) {
      if (role !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({ success: false, error: 'You do not have permission to manage a funeral home' });
      }
      const managedHome = await prisma.funeralHome.findUnique({ where: { id: String(managingId) }, select: { id: true } });
      if (!managedHome) {
        return res.status(404).json({ success: false, error: 'Funeral home not found' });
      }
      req.managingFuneralHomeId = managedHome.id;
      req.user = { userId: user.id, funeralHomeId: managedHome.id, role, tokenVersion: user.tokenVersion };
      return next();
    }
    req.user = { userId: user.id, funeralHomeId: user.funeralHomeId, role, tokenVersion: user.tokenVersion };
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

export function signToken(payload: AuthPayload, options?: SignOptions): string {
  return jwt.sign(
    { ...payload, role: normalizeRole(payload.role) },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN, ...options } as SignOptions,
  );
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

export interface QAPayload {
  kind: 'qa_access';
  userId: string;
  role: 'SUPER_ADMIN';
  memorialId: string;
}

export function signQAToken(userId: string, memorialId: string): string {
  return jwt.sign(
    { kind: 'qa_access', userId, role: 'SUPER_ADMIN', memorialId } satisfies QAPayload,
    env.JWT_SECRET,
    { expiresIn: '1h' },
  );
}

export function verifyQAToken(token?: string): QAPayload | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as QAPayload;
    return payload.kind === 'qa_access' && payload.role === 'SUPER_ADMIN' ? payload : null;
  } catch {
    return null;
  }
}
