import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler, requireAuth, AuthedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/error";
import { CONTENT_SOURCE_TYPES } from "@smartreach/common";

export const contentSourcesRouter = Router();
contentSourcesRouter.use(requireAuth);

contentSourcesRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const sources = await prisma.contentSource.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { createdAt: "asc" },
    });
    res.json(sources);
  }),
);

const schema = z.object({
  businessId: z.string(),
  type: z.enum(CONTENT_SOURCE_TYPES),
  label: z.string().min(1),
  url: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});

contentSourcesRouter.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = schema.parse(req.body);
    const business = await prisma.business.findFirst({
      where: { id: data.businessId, tenantId: req.user!.tenantId },
    });
    if (!business) throw new ApiError(404, "Business not found");
    const source = await prisma.contentSource.create({
      data: {
        businessId: business.id,
        tenantId: req.user!.tenantId,
        type: data.type,
        label: data.label,
        url: data.url ?? null,
        content: data.content ?? null,
        enabled: data.enabled ?? true,
      },
    });
    res.status(201).json(source);
  }),
);

const updateSchema = schema.partial();
contentSourcesRouter.put(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = updateSchema.parse(req.body);
    const source = await prisma.contentSource.findFirst({
      where: { id: String(req.params.id), tenantId: req.user!.tenantId },
    });
    if (!source) throw new ApiError(404, "Content source not found");
    const updated = await prisma.contentSource.update({
      where: { id: source.id },
      data,
    });
    res.json(updated);
  }),
);

contentSourcesRouter.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const source = await prisma.contentSource.findFirst({
      where: { id: String(req.params.id), tenantId: req.user!.tenantId },
    });
    if (!source) throw new ApiError(404, "Content source not found");
    await prisma.contentSource.delete({ where: { id: source.id } });
    res.json({ ok: true });
  }),
);