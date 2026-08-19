import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler, requireAuth, AuthedRequest } from "../middleware/auth";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const tenantId = req.user!.tenantId;
    const [connections, lastPost, upcoming, published, scheduled, leadsToday, today] =
      await Promise.all([
        prisma.connectedAccount.findMany({ where: { tenantId, connected: true } }),
        prisma.post.findFirst({
          where: { tenantId, status: "PUBLISHED" },
          orderBy: { publishedAt: "desc" },
        }),
        prisma.scheduledPost.count({
          where: { tenantId, status: "SCHEDULED", publishAt: { gte: new Date() } },
        }),
        prisma.post.count({ where: { tenantId, status: "PUBLISHED" } }),
        prisma.post.count({ where: { tenantId, status: "SCHEDULED" } }),
        prisma.lead.count({
          where: {
            tenantId,
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        prisma.statSnapshot.findMany({
          where: {
            tenantId,
            date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
      ]);

    res.json({
      connectedCount: connections.length,
      connectedPlatforms: connections.map((c) => c.platform),
      lastPost: lastPost
        ? {
            platform: lastPost.platform,
            publishedAt: lastPost.publishedAt!.toISOString(),
          }
        : null,
      todayReach: today.reduce((n, s) => n + s.reach, 0),
      todayVisits: today.reduce((n, s) => n + s.visits, 0),
      todayLeads: leadsToday,
      upcomingCount: upcoming,
      publishedCount: published,
      scheduledCount: scheduled,
    });
  }),
);