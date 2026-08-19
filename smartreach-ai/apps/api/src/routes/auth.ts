import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccess,
  signRefresh,
  verifyRefresh,
} from "../lib/jwt";
import { generateSlug } from "../lib/ai";
import { asyncHandler, requireAuth, AuthedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/error";
import { config } from "../config";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  tenantName: z.string().min(2),
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) throw new ApiError(409, "An account with this email already exists");

    const passwordHash = await bcrypt.hash(data.password, 10);
    const slug = generateSlug(data.tenantName);

    const tenant = await prisma.$transaction(async (tx) => {
      let t = await tx.tenant.findUnique({ where: { slug } });
      if (t) {
        let i = 2;
        while (t) {
          t = await tx.tenant.findUnique({ where: { slug: `${slug}-${i}` } });
          if (!t) return tx.tenant.create({ data: { slug: `${slug}-${i}`, name: data.tenantName } });
          i++;
        }
      }
      return tx.tenant.create({ data: { slug, name: data.tenantName } });
    });

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          name: data.name,
          passwordHash,
        },
      });
      await tx.tenantUser.create({
        data: { tenantId: tenant.id, userId: u.id, role: "ORG_ADMIN" },
      });
      await tx.business.create({
        data: { tenantId: tenant.id, name: data.tenantName, industry: "" },
      });
      return u;
    });

    const tokens = await issueTokens(user.id, tenant.id);
    res.status(201).json({ user: toPublicUser(user), tenant, ...tokens });
  }),
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user) throw new ApiError(401, "Invalid credentials");
    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) throw new ApiError(401, "Invalid credentials");

    const tenantUser = await prisma.tenantUser.findFirst({
      where: { userId: user.id },
      include: { tenant: true },
    });
    if (!tenantUser) throw new ApiError(403, "No workspace found for this account");

    const tokens = await issueTokens(user.id, tenantUser.tenantId);
    res.json({
      user: toPublicUser(user),
      tenant: tenantUser.tenant,
      role: tenantUser.role,
      ...tokens,
    });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    let payload;
    try {
      payload = verifyRefresh(refreshToken);
    } catch {
      throw new ApiError(401, "Invalid refresh token");
    }
    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new ApiError(401, "Refresh token expired or revoked");
    }
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const tenantUser = await prisma.tenantUser.findFirst({
      where: { userId: stored.userId },
      include: { tenant: true },
    });
    if (!tenantUser) throw new ApiError(403, "No workspace found");

    const tokens = await issueTokens(stored.userId, tenantUser.tenantId);
    res.json(tokens);
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().optional() }).parse(req.body ?? {});
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
    }
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new ApiError(404, "User not found");
    const tenantUser = await prisma.tenantUser.findFirst({
      where: { userId: user.id },
      include: { tenant: true },
    });
    res.json({
      user: toPublicUser(user),
      tenant: tenantUser?.tenant ?? null,
      role: tenantUser?.role ?? null,
    });
  }),
);

async function issueTokens(userId: string, tenantId: string) {
  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId, tenantId },
    include: { tenant: true },
  });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !tenantUser) throw new ApiError(403, "No workspace found");

  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + config.jwt.refreshTtlDays * 86400000),
    },
  });

  const accessToken = signAccess({
    sub: user.id,
    email: user.email,
    name: user.name,
    tenantId,
    role: tenantUser.role,
    tenantName: tenantUser.tenant.name,
  });
  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.accessTtl,
  };
}

function toPublicUser(user: { id: string; email: string; name: string }) {
  return { id: user.id, email: user.email, name: user.name };
}

export { issueTokens };
