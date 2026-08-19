import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler, requireAuth, AuthedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/error";
import { getGenerator } from "../lib/ai";
import { GENERATOR_PLATFORMS } from "@smartreach/common";
import { nextTimeFor } from "@smartreach/scheduler";
import { publishScheduledPost, simulateStats } from "@smartreach/publish";
import { parseKeywords } from "./business";

export const postsRouter = Router();
postsRouter.use(requireAuth);

postsRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const status = (req.query.status as string) || undefined;
    const platform = (req.query.platform as string) || undefined;
    const rows = await prisma.post.findMany({
      where: {
        tenantId: req.user!.tenantId,
        ...(status ? { status } : {}),
        ...(platform ? { platform } : {}),
      },
      include: { scheduled: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(rows.map(toPostRow));
  }),
);

const generateSchema = z.object({
  platforms: z.array(z.enum(GENERATOR_PLATFORMS)).min(1),
  topics: z.array(z.string()).optional(),
});

postsRouter.post(
  "/generate",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = generateSchema.parse(req.body);
    const business = await prisma.business.findUnique({
      where: { tenantId: req.user!.tenantId },
      include: { sources: { where: { enabled: true } } },
    });
    if (!business) throw new ApiError(400, "Complete your business profile first");

    const generator = getGenerator();
    const generated = await generator.generate({
      business: {
        name: business.name,
        industry: business.industry || "services",
        website: business.website ?? undefined,
        description: business.description ?? undefined,
        tone: business.tone,
        audience: business.audience,
        keywords: parseKeywords(business.keywords),
        primaryColor: business.primaryColor,
        secondaryColor: business.secondaryColor,
        fonts: business.fonts,
      },
      sources: business.sources.map((s) => ({
        type: s.type,
        label: s.label,
        url: s.url ?? undefined,
        content: s.content ?? undefined,
      })),
      platforms: data.platforms,
    });

    const sourceNote = business.sources.slice(0, 3).map((s) => s.label).join(", ") || undefined;

    const created = await prisma.$transaction(
      generated.map((g) =>
        prisma.post.create({
          data: {
            tenantId: req.user!.tenantId,
            businessId: business.id,
            platform: g.platform,
            title: g.title,
            body: g.body,
            tone: business.tone,
            variant: g.variant,
            status: "DRAFT",
            sourceNote,
          },
        }),
      ),
    );

    res.status(201).json(created.map(toPostRow));
  }),
);

postsRouter.post(
  "/:id/approve",
  asyncHandler(async (req: AuthedRequest, res) => {
    const post = await getPost(req);
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { status: "APPROVED" },
    });
    res.json(toPostRow(updated));
  }),
);

const scheduleSchema = z.object({
  publishAt: z.string().min(1),
});

postsRouter.post(
  "/:id/schedule",
  asyncHandler(async (req: AuthedRequest, res) => {
    const post = await getPost(req);
    const data = scheduleSchema.parse(req.body);
    const publishAt = new Date(data.publishAt);
    if (isNaN(publishAt.getTime())) throw new ApiError(400, "Invalid publish date");
    if (publishAt.getTime() <= Date.now() - 60000) {
      throw new ApiError(400, "Publish time must be in the future");
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.scheduledPost.deleteMany({ where: { postId: post.id } });
      await tx.post.update({ where: { id: post.id }, data: { status: "SCHEDULED" } });
      return tx.scheduledPost.create({
        data: {
          tenantId: req.user!.tenantId,
          postId: post.id,
          publishAt,
          status: "SCHEDULED",
          platform: post.platform,
        },
      });
    });
    res.status(201).json({ ...updated, body: post.body });
  }),
);

postsRouter.post(
  "/:id/publish",
  asyncHandler(async (req: AuthedRequest, res) => {
    const post = await getPost(req);
    const connection = await prisma.connectedAccount.findUnique({
      where: { tenantId_platform: { tenantId: req.user!.tenantId, platform: post.platform } },
    });
    const schedule = await prisma.scheduledPost.upsert({
      where: { postId: post.id },
      update: { status: "SCHEDULED", publishAt: new Date() },
      create: {
        tenantId: req.user!.tenantId,
        postId: post.id,
        publishAt: new Date(),
        status: "SCHEDULED",
        platform: post.platform,
      },
    });
    const ok = await publishScheduledPost(prisma, schedule.id);
    if (!ok) throw new ApiError(502, "Publish failed on the target platform");
    const now = new Date();
    const stats = simulateStats(post.platform);
    await prisma.statSnapshot.create({
      data: {
        tenantId: req.user!.tenantId,
        platform: post.platform,
        date: now,
        weekday: now.getDay(),
        hour: now.getHours(),
        ...stats,
      },
    });
    res.json({
      ok: true,
      externalId: connection?.externalId ?? null,
      publishedAt: now,
      platform: post.platform,
    });
  }),
);

postsRouter.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const post = await getPost(req);
    await prisma.post.delete({ where: { id: post.id } });
    res.json({ ok: true });
  }),
);

postsRouter.get(
  "/:id/suggest-time",
  asyncHandler(async (req: AuthedRequest, res) => {
    const post = await getPost(req);
    res.json({ suggestedAt: nextTimeFor(post.platform, new Date()).toISOString() });
  }),
);

async function getPost(req: AuthedRequest) {
  const post = await prisma.post.findFirst({
    where: { id: String(req.params.id), tenantId: req.user!.tenantId },
  });
  if (!post) throw new ApiError(404, "Post not found");
  return post;
}

function toPostRow(p: any) {
  return {
    id: p.id,
    title: p.title ?? undefined,
    body: p.body,
    platform: p.platform,
    status: p.status,
    tone: p.tone ?? undefined,
    variant: p.variant ?? undefined,
    sourceNote: p.sourceNote ?? undefined,
    publishedAt: p.publishedAt?.toISOString() ?? undefined,
    scheduledAt: p.scheduled?.publishAt?.toISOString() ?? undefined,
    createdAt: p.createdAt.toISOString(),
  };
}