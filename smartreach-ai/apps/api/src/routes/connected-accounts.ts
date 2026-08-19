import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler, requireAuth, AuthedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/error";
import { SOCIAL_PLATFORMS } from "@smartreach/common";

export const connectionsRouter = Router();
connectionsRouter.use(requireAuth);

connectionsRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const connections = await prisma.connectedAccount.findMany({
      where: { tenantId: req.user!.tenantId },
    });
    const connected = new Set(connections.filter((c) => c.connected).map((c) => c.platform));
    res.json({
      available: SOCIAL_PLATFORMS,
      connected: [...connected],
      connections,
    });
  }),
);

const connectSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  handle: z.string().min(1),
});

connectionsRouter.post(
  "/connect",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = connectSchema.parse(req.body);
    const connection = await prisma.connectedAccount.upsert({
      where: { tenantId_platform: { tenantId: req.user!.tenantId, platform: data.platform } },
      update: { handle: data.handle, connected: true, externalId: `ext_${Date.now()}` },
      create: {
        tenantId: req.user!.tenantId,
        platform: data.platform,
        handle: data.handle,
        connected: true,
        externalId: `ext_${Date.now()}`,
      },
    });
    res.json(connection);
  }),
);

connectionsRouter.post(
  "/disconnect",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { platform } = z.object({ platform: z.enum(SOCIAL_PLATFORMS) }).parse(req.body);
    const updated = await prisma.connectedAccount.updateMany({
      where: { tenantId: req.user!.tenantId, platform },
      data: { connected: false },
    });
    if (updated.count === 0) throw new ApiError(404, "Account not connected");
    res.json({ ok: true });
  }),
);