import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler, requireAuth, AuthedRequest } from "../middleware/auth";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const users = await prisma.tenantUser.findMany({
      where: { tenantId: req.user!.tenantId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(
      users.map((tu) => ({
        id: tu.userId,
        name: tu.user.name,
        email: tu.user.email,
        role: tu.role,
      })),
    );
  }),
);

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["MEMBER", "ORG_ADMIN"]),
});

usersRouter.post(
  "/invite",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = inviteSchema.parse(req.body);
    const user = await prisma.user.upsert({
      where: { email: data.email.toLowerCase() },
      update: { name: data.name },
      create: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash:
          "$2a$10$pending.invite.placeholder.00000000000000000000000000000000000000000000",
      },
    });
    const existing = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: req.user!.tenantId, userId: user.id } },
    });
    if (!existing) {
      await prisma.tenantUser.create({
        data: { tenantId: req.user!.tenantId, userId: user.id, role: data.role },
      });
    }
    res.status(201).json({ ok: true });
  }),
);