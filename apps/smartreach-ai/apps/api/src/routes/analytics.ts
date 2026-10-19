import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler, requireAuth, AuthedRequest } from "../middleware/auth";
import {
  aggregateDaily,
  engagementRate,
  perPlatform,
  sumWindow,
} from "@smartreach/analytics";
import { computeBestTimeSlots, formatDayLabel } from "@smartreach/scheduler";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get(
  "/overview",
  asyncHandler(async (req: AuthedRequest, res) => {
    const days = Number(req.query.days ?? 30);
    const rows = await prisma.statSnapshot.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { date: "asc" },
    });
    const daily = aggregateDaily(rows, Math.min(Math.max(days, 7), 90));
    const totals = sumWindow(rows, days);
    res.json({ daily, totals, engagementRate: engagementRate(rows) });
  }),
);

analyticsRouter.get(
  "/platforms",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = await prisma.statSnapshot.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { date: "desc" },
      take: 2000,
    });
    res.json({ platforms: perPlatform(rows) });
  }),
);

analyticsRouter.get(
  "/best-times",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = await prisma.statSnapshot.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { date: "desc" },
      take: 5000,
    });
    const mapped = rows.map((r) => ({ weekday: r.weekday, hour: r.hour, reach: r.reach }));
    const best = computeBestTimeSlots(mapped);
    res.json({
      learned: mapped.length > 30,
      best: best.map((b) => ({
        day: b.day,
        dayLabel: formatDayLabel(b.day),
        hour: b.hour,
        label: `${formatDayLabel(b.day)} ${b.hour}:00`,
      })),
    });
  }),
);