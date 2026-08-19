import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler, requireAuth, AuthedRequest } from "../middleware/auth";

export const leadsRouter = Router();
leadsRouter.use(requireAuth);

leadsRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const leads = await prisma.lead.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(
      leads.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        source: l.source,
        status: l.status,
        notes: l.notes,
        createdAt: l.createdAt.toISOString(),
      })),
    );
  }),
);

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

leadsRouter.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = createSchema.parse(req.body);
    const lead = await prisma.lead.create({
      data: {
        tenantId: req.user!.tenantId,
        name: data.name,
        email: data.email,
        source: data.source ?? "FORM",
        notes: data.notes ?? null,
      },
    });
    res.status(201).json(lead);
  }),
);

const statusSchema = z.object({ status: z.string() });
leadsRouter.patch(
  "/:id/status",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = statusSchema.parse(req.body);
    const lead = await prisma.lead.findFirst({
      where: { id: String(req.params.id), tenantId: req.user!.tenantId },
    });
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { status: data.status },
    });
    res.json(updated);
  }),
);

leadsRouter.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.lead.deleteMany({
      where: { id: String(req.params.id), tenantId: req.user!.tenantId },
    });
    res.json({ ok: true });
  }),
);
