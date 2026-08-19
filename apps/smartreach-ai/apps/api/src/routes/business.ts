import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler, requireAuth, AuthedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/error";

export const businessRouter = Router();
businessRouter.use(requireAuth);

businessRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const business = await prisma.business.findUnique({
      where: { tenantId: req.user!.tenantId },
      include: { sources: true },
    });
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }
    res.json(toBusiness(business));
  }),
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  industry: z.string().optional(),
  website: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fonts: z.string().optional(),
  tone: z.string().optional(),
  audience: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

businessRouter.put(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = updateSchema.parse(req.body);
    const existing = await prisma.business.findUnique({
      where: { tenantId: req.user!.tenantId },
    });
    if (!existing) throw new ApiError(404, "Business not found");
    const update: Record<string, unknown> = { ...data };
    if (data.keywords) update.keywords = JSON.stringify(data.keywords);
    const business = await prisma.business.update({
      where: { id: existing.id },
      data: update,
      include: { sources: true },
    });
    res.json(toBusiness(business));
  }),
);

function toBusiness(b: any) {
  return {
    ...b,
    keywords: parseKeywords(b.keywords),
  };
}

export function parseKeywords(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return raw ? [raw] : [];
  }
}