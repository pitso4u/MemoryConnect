import { Router, Request } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { isZodError } from '../lib/validation';
import { authenticate, canManageFuneralHome, normalizeRole, ROLES, signToken } from '../middleware/auth';

const router = Router();

const FAMILY_ROLES = [ROLES.FAMILY_MANAGER, ROLES.FAMILY_CONTRIBUTOR] as const;

const inviteSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().min(5).max(40).optional().nullable(),
  role: z.enum(FAMILY_ROLES),
}).refine((value) => value.email || value.phone, {
  message: 'Provide an email address or phone number',
});

const acceptSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).optional(),
});

function param(req: Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function adminBaseUrl() {
  return (env.ADMIN_URL || 'https://admin.memoryconnect.co.za').replace(/\/$/, '');
}

function inviteUrl(token?: string | null) {
  return token ? `${adminBaseUrl()}/family/invite/${token}` : null;
}

function resetUrl(token: string) {
  return `${adminBaseUrl()}/reset-password/${token}`;
}

function invitationStatus(invitation: { acceptedAt?: Date | null; expiresAt: Date }) {
  if (invitation.acceptedAt) return 'Accepted';
  if (invitation.expiresAt <= new Date()) return 'Expired';
  return 'Pending';
}

async function createPasswordReset(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return token;
}

async function audit(memorialId: string, userId: string | null, action: string, details?: Record<string, unknown>) {
  await prisma.memorialAuditLog.create({
    data: { memorialId, userId, action, details: details as Prisma.InputJsonValue | undefined },
  });
}

router.post('/memorials/:id/invitations', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only funeral home admins can invite family members' });
  }

  try {
    const memorialId = param(req, 'id');
    const memorial = await prisma.memorial.findFirst({
      where: { id: memorialId, funeralHomeId: req.user!.funeralHomeId, deletedAt: null },
      select: { id: true, funeralHomeId: true, isDemo: true },
    });
    if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
    if (memorial.isDemo) return res.status(403).json({ success: false, error: 'Family invitations are disabled for the demo memorial' });

    const body = inviteSchema.parse(req.body);
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const invitation = await prisma.familyInvitation.create({
      data: {
        memorialId,
        funeralHomeId: memorial.funeralHomeId,
        invitedByUserId: req.user!.userId,
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        role: body.role,
        tokenHash: tokenHash(token),
        token,
        expiresAt,
      },
    });

    await audit(memorialId, req.user!.userId, 'family_invite_created', {
      invitationId: invitation.id,
      role: body.role,
      email: body.email || null,
      phone: body.phone || null,
    });

    res.status(201).json({
      success: true,
      data: {
        ...invitation,
        status: invitationStatus(invitation),
        inviteUrl: inviteUrl(token),
      },
    });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, error: error.errors[0].message });
    console.error('Create family invitation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create family invitation' });
  }
});

router.get('/invite/:token', async (req, res) => {
  const invitation = await prisma.familyInvitation.findUnique({
    where: { tokenHash: tokenHash(param(req, 'token')) },
    include: { memorial: { select: { id: true, deceasedName: true, serviceDate: true } }, funeralHome: { select: { name: true } } },
  });
  if (!invitation || invitation.expiresAt <= new Date() || invitation.acceptedAt) {
    return res.status(404).json({ success: false, error: 'Invitation is invalid or expired' });
  }
  res.json({
    success: true,
    data: {
      id: invitation.id,
      name: invitation.name,
      email: invitation.email,
      phone: invitation.phone,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      memorial: invitation.memorial,
      funeralHome: invitation.funeralHome,
    },
  });
});

router.post('/invite/:token/accept', async (req, res) => {
  try {
    const body = acceptSchema.parse(req.body);
    const invitation = await prisma.familyInvitation.findUnique({
      where: { tokenHash: tokenHash(param(req, 'token')) },
    });
    if (!invitation || invitation.expiresAt <= new Date() || invitation.acceptedAt) {
      return res.status(404).json({ success: false, error: 'Invitation is invalid or expired' });
    }

    const email = body.email || invitation.email;
    if (!email) return res.status(400).json({ success: false, error: 'An email address is required to accept this invitation' });

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (!body.password) return res.status(400).json({ success: false, error: 'Create a password to accept this invitation' });
      user = await prisma.user.create({
        data: {
          email,
          name: body.name || invitation.name,
          passwordHash: await bcrypt.hash(body.password, 12),
          passwordSetAt: new Date(),
          lastLoginAt: new Date(),
          role: invitation.role,
          funeralHomeId: null,
        },
      });
    } else if (!FAMILY_ROLES.includes(normalizeRole(user.role) as typeof FAMILY_ROLES[number])) {
      return res.status(403).json({ success: false, error: 'This invitation must be accepted with a family account' });
    }

    await prisma.$transaction([
      prisma.memorialAccess.upsert({
        where: { memorialId_userId: { memorialId: invitation.memorialId, userId: user.id } },
        create: {
          memorialId: invitation.memorialId,
          userId: user.id,
          role: invitation.role,
          grantedByUserId: invitation.invitedByUserId,
        },
        update: { role: invitation.role, grantedByUserId: invitation.invitedByUserId },
      }),
      prisma.familyInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
      prisma.memorialAuditLog.create({
        data: {
          memorialId: invitation.memorialId,
          userId: user.id,
          action: 'invite_accepted',
          details: { invitationId: invitation.id, role: invitation.role },
        },
      }),
    ]);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const accessToken = signToken({ userId: user.id, funeralHomeId: user.funeralHomeId, role: user.role });
    res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, email: user.email, name: user.name, role: normalizeRole(user.role), funeralHomeId: user.funeralHomeId },
      },
    });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, error: error.errors[0].message });
    console.error('Accept family invitation error:', error);
    res.status(500).json({ success: false, error: 'Failed to accept invitation' });
  }
});

router.get('/memorials/:id/invitations', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only funeral home admins can manage family invitations' });
  }
  const memorialId = param(req, 'id');
  const memorial = await prisma.memorial.findFirst({ where: { id: memorialId, funeralHomeId: req.user!.funeralHomeId } });
  if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
  if (memorial.isDemo) return res.status(403).json({ success: false, error: 'Family invitations are disabled for the demo memorial' });

  const invitations = await prisma.familyInvitation.findMany({
    where: { memorialId },
    orderBy: { createdAt: 'desc' },
  });

  const emails = invitations.map((item) => item.email).filter((email): email is string => Boolean(email));
  const users = emails.length
    ? await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true, passwordSetAt: true, lastLoginAt: true, createdAt: true },
      })
    : [];
  const usersByEmail = new Map(users.map((user) => [user.email, user]));

  res.json({
    success: true,
    data: invitations.map((invitation) => {
      const account = invitation.email ? usersByEmail.get(invitation.email) : null;
      return {
        id: invitation.id,
        memorialId: invitation.memorialId,
        name: invitation.name,
        email: invitation.email,
        phone: invitation.phone,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        createdAt: invitation.createdAt,
        status: invitationStatus(invitation),
        inviteUrl: inviteUrl(invitation.token),
        accountStatus: invitation.acceptedAt ? (account ? 'Account created' : 'Invitation accepted') : 'Invitation pending',
        passwordSet: Boolean(account?.passwordSetAt),
        lastLoginAt: account?.lastLoginAt || null,
        userId: account?.id || null,
      };
    }),
  });
});

router.post('/memorials/:id/invitations/:invitationId/resend', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only funeral home admins can resend invitations' });
  }
  const memorialId = param(req, 'id');
  const invitationId = param(req, 'invitationId');
  const invitation = await prisma.familyInvitation.findFirst({
    where: { id: invitationId, memorialId, funeralHomeId: req.user!.funeralHomeId, memorial: { isDemo: false } },
  });
  if (!invitation) return res.status(404).json({ success: false, error: 'Invitation not found' });
  const token = invitation.token || crypto.randomBytes(32).toString('base64url');
  const updated = await prisma.familyInvitation.update({
    where: { id: invitation.id },
    data: {
      token,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      acceptedAt: null,
    },
  });
  await audit(memorialId, req.user!.userId, 'family_invite_resent', { invitationId });
  res.json({ success: true, data: { ...updated, status: invitationStatus(updated), inviteUrl: inviteUrl(token) } });
});

router.delete('/memorials/:id/invitations/:invitationId', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only funeral home admins can revoke invitations' });
  }
  const memorialId = param(req, 'id');
  const invitationId = param(req, 'invitationId');
  const invitation = await prisma.familyInvitation.findFirst({
    where: { id: invitationId, memorialId, funeralHomeId: req.user!.funeralHomeId, memorial: { isDemo: false } },
  });
  if (!invitation) return res.status(404).json({ success: false, error: 'Invitation not found' });
  await prisma.$transaction([
    prisma.familyInvitation.delete({ where: { id: invitation.id } }),
    prisma.memorialAuditLog.create({
      data: { memorialId, userId: req.user!.userId, action: 'family_invite_revoked', details: { invitationId, role: invitation.role } },
    }),
  ]);
  res.json({ success: true, data: null });
});

router.post('/memorials/:id/access/:accessId/password-reset', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only funeral home admins can send password reset links' });
  }
  const memorialId = param(req, 'id');
  const accessId = param(req, 'accessId');
  const access = await prisma.memorialAccess.findFirst({
    where: { id: accessId, memorialId, memorial: { funeralHomeId: req.user!.funeralHomeId } },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!access) return res.status(404).json({ success: false, error: 'Family access not found' });
  const token = await createPasswordReset(access.userId);
  await audit(memorialId, req.user!.userId, 'password_reset_created', { targetUserId: access.userId, email: access.user.email });
  res.json({
    success: true,
    data: {
      resetUrl: resetUrl(token),
      sentByEmail: Boolean(access.user.email),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
});

router.get('/memorials/:id/access', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only funeral home admins can manage family access' });
  }
  const memorialId = param(req, 'id');
  const memorial = await prisma.memorial.findFirst({ where: { id: memorialId, funeralHomeId: req.user!.funeralHomeId } });
  if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });

  const access = await prisma.memorialAccess.findMany({
    where: { memorialId },
    include: { user: { select: { id: true, name: true, email: true, passwordSetAt: true, lastLoginAt: true, createdAt: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: access });
});

router.delete('/memorials/:id/access/:accessId', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only funeral home admins can revoke family access' });
  }
  const memorialId = param(req, 'id');
  const accessId = param(req, 'accessId');
  const access = await prisma.memorialAccess.findFirst({
    where: { id: accessId, memorialId, memorial: { funeralHomeId: req.user!.funeralHomeId } },
  });
  if (!access) return res.status(404).json({ success: false, error: 'Family access not found' });
  await prisma.$transaction([
    prisma.memorialAccess.delete({ where: { id: access.id } }),
    prisma.memorialAuditLog.create({
      data: { memorialId, userId: req.user!.userId, action: 'family_access_revoked', details: { revokedUserId: access.userId, role: access.role } },
    }),
  ]);
  res.json({ success: true, data: null });
});

export default router;
