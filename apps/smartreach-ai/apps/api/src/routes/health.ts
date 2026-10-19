import { Router } from "express";
import { prisma } from "../lib/db";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "degraded", time: new Date().toISOString() });
  }
});