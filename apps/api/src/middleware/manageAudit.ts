import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { ROLES } from './auth';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Map a request path to a readable audit action for SUPER_ADMIN-managed changes. */
function actionFor(req: Request): string {
  const path = `${req.baseUrl}${req.path}`;
  if (/\/funeral-home-profile/.test(path)) return 'SUPER_ADMIN_MANAGED_FUNERAL_HOME_PROFILE';
  if (/\/funeral-home-logo/.test(path)) return 'SUPER_ADMIN_MANAGED_FUNERAL_HOME_LOGO';
  if (/\/brochures/.test(path)) return 'SUPER_ADMIN_MANAGED_BROCHURE';
  if (/\/promotions/.test(path)) return 'SUPER_ADMIN_MANAGED_PROMOTION';
  if (/\/categories/.test(path)) return 'SUPER_ADMIN_MANAGED_BROCHURE_CATEGORY';
  if (/\/branches/.test(path)) return 'SUPER_ADMIN_MANAGED_BRANCH';
  if (/\/contact/.test(path)) return 'SUPER_ADMIN_MANAGED_MARKETING_CONTACT';
  if (/\/memorials/.test(path)) return 'SUPER_ADMIN_MANAGED_MEMORIAL';
  if (/\/vehicles/.test(path)) return 'SUPER_ADMIN_MANAGED_VEHICLE';
  if (/\/assets/.test(path)) return 'SUPER_ADMIN_MANAGED_ASSET';
  if (/\/funeral-resources/.test(path)) return 'SUPER_ADMIN_MANAGED_FUNERAL_RESOURCE';
  if (/\/family\//.test(path)) return 'SUPER_ADMIN_MANAGED_FAMILY';
  if (/\/entitlement/.test(path)) return 'SUPER_ADMIN_MANAGED_ENTITLEMENT';
  if (/\/payments/.test(path)) return 'SUPER_ADMIN_MANAGED_PAYMENT';
  return 'SUPER_ADMIN_MANAGED_SETTING';
}

/** Platform-scoped routes (super-admin only) never need the manage audit. */
function isPlatformScoped(req: Request): boolean {
  const path = `${req.baseUrl}${req.path}`;
  return /^\/api\/v1\/(platform|admin)/.test(path);
}

/**
 * Records every mutating request performed while a SUPER_ADMIN is managing
 * another funeral home (X-Managing-Funeral-Home active). The log entry keeps
 * the real actor (the SUPER_ADMIN) and pins the managed funeral home as both
 * the scoped home and the audit target, so owner-facing changes are always
 * attributable to the platform owner without ever altering the owner's account.
 */
export function manageAudit(req: Request, res: Response, next: NextFunction) {
  if (MUTATING_METHODS.has(req.method.toUpperCase())) {
    res.on('finish', () => {
      const actorId = req.user?.userId;
      const funeralHomeId = req.managingFuneralHomeId;
      if (!actorId || !funeralHomeId || req.user?.role !== ROLES.SUPER_ADMIN || res.statusCode >= 400 || isPlatformScoped(req)) return;
      prisma.platformAuditLog
        .create({
          data: {
            actorUserId: actorId,
            funeralHomeId,
            targetType: 'FUNERAL_HOME',
            targetId: funeralHomeId,
            action: actionFor(req),
            details: { method: req.method, path: `${req.baseUrl}${req.path}`, actorRole: ROLES.SUPER_ADMIN } as never,
          },
        })
        .catch((err) => console.error('manageAudit error:', err));
    });
  }
  next();
}
