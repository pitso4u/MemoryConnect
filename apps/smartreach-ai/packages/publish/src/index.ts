import { SocialPublisher } from "@smartreach/social";

type PrismaLike = {
  scheduledPost: {
    findUnique: (args: { where: { id: string }; include?: any }) => Promise<any>;
    update: (args: { where: { id: string }; data: any }) => Promise<any>;
  };
  connectedAccount: {
    findUnique: (args: { where: any }) => Promise<any>;
  };
  post: {
    update: (args: { where: { id: string }; data: any }) => Promise<any>;
  };
  statSnapshot: {
    create: (args: { data: any }) => Promise<any>;
  };
  $transaction: (queries: any[]) => Promise<any>;
};

const publisher = new SocialPublisher();

/**
 * Publish a scheduled post: mark the Post PUBLISHED, the ScheduledPost
 * PUBLISHED, write an external URL, and record a simulated engagement
 * snapshot so the dashboard has live numbers.
 */
export async function publishScheduledPost(prisma: PrismaLike, scheduleId: string): Promise<boolean> {
  const schedule = await prisma.scheduledPost.findUnique({
    where: { id: scheduleId },
    include: { post: true },
  });
  if (!schedule || schedule.status !== "SCHEDULED") return false;

  const connection = await prisma.connectedAccount.findUnique({
    where: { tenantId_platform: { tenantId: schedule.tenantId, platform: schedule.platform } },
  });

  const result = await publisher.publish({
    platform: schedule.platform,
    body: schedule.post.body,
    title: schedule.post.title ?? undefined,
    handle: connection?.handle ?? undefined,
  });

  const now = new Date();

  if (!result.ok) {
    await prisma.$transaction([
      prisma.scheduledPost.update({ where: { id: schedule.id }, data: { status: "FAILED", error: result.error } }),
      prisma.post.update({ where: { id: schedule.postId }, data: { status: "FAILED" } }),
    ]);
    return false;
  }

  const stats = simulateStats(schedule.platform);
  await prisma.$transaction([
    prisma.scheduledPost.update({
      where: { id: schedule.id },
      data: { status: "PUBLISHED", publishedAt: now, externalUrl: result.url ?? null },
    }),
    prisma.post.update({
      where: { id: schedule.postId },
      data: { status: "PUBLISHED", publishedAt: now },
    }),
    prisma.statSnapshot.create({
      data: {
        tenantId: schedule.tenantId,
        platform: schedule.platform,
        date: now,
        weekday: now.getDay(),
        hour: now.getHours(),
        ...stats,
      },
    }),
  ]);
  return true;
}

export function simulateStats(platform: string) {
  const base = 1200 + Math.floor(Math.random() * 3200);
  const reach = Math.round(
    base *
      (platform === "instagram" ? 1.4 : platform === "tiktok" ? 1.7 : platform === "youtube" ? 1.6 : 1.0),
  );
  const visits = Math.round(reach * (0.12 + Math.random() * 0.1));
  const clicks = Math.round(reach * (0.04 + Math.random() * 0.06));
  const shares = Math.round(reach * (0.015 + Math.random() * 0.03));
  const conversions = Math.round(reach * (0.006 + Math.random() * 0.01));
  return { reach, visits, clicks, shares, conversions, followers: Math.round(base * 0.02) };
}
