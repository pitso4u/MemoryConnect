import { prisma } from "../lib/db";
import bcrypt from "bcryptjs";
import { addMinutes } from "@smartreach/scheduler";

/**
 * Seeds a permanent demo tenant — MemoryConnect (the first SmartReach customer)
 * — with a business profile, content sources, connected accounts, generated
 * posts and an upcoming schedule so the platform demos immediately.
 */
async function seed() {
  const email = "demo@memoryconnect.co.za";
  const password = "DemoPass123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("[seed] demo tenant already exists — skipping");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, name: "Pitso (Demo)", passwordHash } });
    const tenant = await tx.tenant.create({ data: { slug: "memoryconnect", name: "MemoryConnect" } });
    await tx.tenantUser.create({
      data: { tenantId: tenant.id, userId: user.id, role: "ORG_ADMIN" },
    });

    await tx.business.create({
      data: {
        tenantId: tenant.id,
        name: "MemoryConnect",
        industry: "Funeral Services & Digital Memorials",
        website: "https://memoryconnect.co.za",
        description:
          "Digital memorial platform helping funeral homes publish dignified online memorials and share funeral programmes.",
        primaryColor: "#7c3aed",
        secondaryColor: "#f59e0b",
        fonts: "Modern",
        tone: "Friendly",
        audience: "South Africa",
        keywords: JSON.stringify(["memorials", "funeral services", "remembrance", "obituary"]),
      },
    });

    const sources = [
      { type: "website", label: "memoryconnect.co.za", url: "https://memoryconnect.co.za" },
      {
        type: "memorials",
        label: "Online Memorials",
        content:
          "Families can now honour loved ones with a beautiful online memorial — share the funeral programme, photos, tributes and directions in one place.",
      },
      {
        type: "promotions",
        label: "Publish a memorial",
        content: "Publish a memorial for R299.99 once-off. Paystack secure checkout.",
      },
    ];
    for (const s of sources) {
      await tx.contentSource.create({
        data: {
          tenantId: tenant.id,
          businessId: (await tx.business.findUnique({ where: { tenantId: tenant.id } }))!.id,
          type: s.type,
          label: s.label,
          url: s.url ?? null,
          content: s.content ?? null,
        },
      });
    }

    const platforms = ["facebook", "instagram", "linkedin", "tiktok", "youtube", "x", "google", "whatsapp"];
    for (const platform of platforms) {
      await tx.connectedAccount.create({
        data: {
          tenantId: tenant.id,
          platform,
          handle: `memoryconnect`,
          connected: true,
          externalId: `ext_demo_${platform}`,
        },
      });
    }

    const now = new Date();
    const samplePosts = [
      {
        platform: "facebook",
        title: "Honour a loved one",
        body: "Did you know?\n\nFamilies can now honour loved ones with a beautiful online memorial — share the programme, photos and tributes in one place.\n\nCreate yours today: https://memoryconnect.co.za\n\n#MemoryConnect #Memorial #Remembrance",
        status: "PUBLISHED",
        publishedAt: addMinutes(now, -180),
      },
      {
        platform: "instagram",
        title: "Online memorials",
        body: "Small moments. Meaningful care. ✨\n\nHonour a loved one with a beautiful online memorial.\n\n#memorials #remembrance #family #MemoryConnect",
        status: "PUBLISHED",
        publishedAt: addMinutes(now, -90),
      },
      {
        platform: "linkedin",
        title: "Modernising funeral care",
        body: "At MemoryConnect we believe consistent, caring service is built on clear communication.\n\nFuneral teams across South Africa face the same challenge: reaching the right families at the right moment. Our platform pairs technology with a human touch.\n\nLearn more: https://memoryconnect.co.za",
        status: "SCHEDULED",
      },
      {
        platform: "tiktok",
        title: "30-second script",
        body: "[HOOK — 0-3s] On-screen text: \"This is what digital memorials look like.\"\n[INTRO — 3-8s] \"Families deserve clarity on their hardest days.\"\n[BODY — 8-22s] Quick cuts showing memorials, photos, tributes.\n[CTA — 22-30s] \"Visit the link in bio to learn more.\"\n\n#memorials #remembrance #viral",
        status: "SCHEDULED",
      },
    ];

    const business = await tx.business.findUnique({ where: { tenantId: tenant.id } });
    const created: { id: string; platform: string }[] = [];
    for (const sp of samplePosts) {
      const post = await tx.post.create({
        data: {
          tenantId: tenant.id,
          businessId: business!.id,
          platform: sp.platform,
          title: sp.title,
          body: sp.body,
          tone: "Friendly",
          variant: "Friendly",
          status: sp.status,
          publishedAt: sp.publishedAt ?? null,
          sourceNote: "Online Memorials",
        },
      });
      created.push({ id: post.id, platform: sp.platform });
      if (sp.status === "PUBLISHED" && sp.publishedAt) {
        await tx.statSnapshot.create({
          data: {
            tenantId: tenant.id,
            platform: sp.platform,
            date: sp.publishedAt,
            weekday: sp.publishedAt.getDay(),
            hour: sp.publishedAt.getHours(),
            reach: 6200,
            visits: 740,
            clicks: 310,
            shares: 96,
            conversions: 23,
            followers: 2140,
          },
        });
      }
    }

    const dayOffsets: Record<string, number> = { linkedin: 1, tiktok: 2, facebook: 3, instagram: 4 };
    for (const p of created) {
      const scheduled = p.platform === "facebook" || p.platform === "instagram";
      if (scheduled) continue;
      const at = new Date(now);
      at.setDate(at.getDate() + (dayOffsets[p.platform] ?? 1));
      at.setHours(9 + (p.platform === "tiktok" ? 8 : 0), 0, 0, 0);
      await tx.scheduledPost.create({
        data: {
          tenantId: tenant.id,
          postId: p.id,
          publishAt: at,
          status: "SCHEDULED",
          platform: p.platform,
        },
      });
    }

    await tx.lead.create({
      data: {
        tenantId: tenant.id,
        name: "Thabo Mokoena",
        email: "thabo@example.co.za",
        source: "COMMENT",
        notes: "Interested in a memorial for a family member.",
      },
    });

    console.log(`[seed] demo tenant ready — login: ${email} / ${password}`);
  });

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});