import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler, requireAuth, AuthedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/error";

export const calendarRouter = Router();
calendarRouter.use(requireAuth);

calendarRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const range = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    } as const;
    const schedules = await prisma.scheduledPost.findMany({
      where: { tenantId: req.user!.tenantId, publishAt: range },
      include: { post: true },
      orderBy: { publishAt: "asc" },
    });
    res.json(
      schedules.map((s) => ({
        id: s.id,
        postId: s.postId,
        platform: s.post.platform,
        status: s.status,
        publishAt: s.publishAt.toISOString(),
        body: s.post.body,
        title: s.post.title,
        externalUrl: s.externalUrl,
        error: s.error,
      })),
    );
  }),
);

calendarRouter.post(
  "/:id/cancel",
  asyncHandler(async (req: AuthedRequest, res) => {
    const schedule = await prisma.scheduledPost.findFirst({
      where: { id: String(req.params.id), tenantId: req.user!.tenantId },
    });
    if (!schedule) throw new ApiError(404, "Scheduled post not found");
    if (schedule.status !== "SCHEDULED") throw new ApiError(400, "Only scheduled posts can be cancelled");
    await prisma.$transaction([
      prisma.scheduledPost.update({ where: { id: schedule.id }, data: { status: "CANCELLED" } }),
      prisma.post.update({ where: { id: schedule.postId }, data: { status: "APPROVED" } }),
    ]);
    res.json({ ok: true });
  }),
);