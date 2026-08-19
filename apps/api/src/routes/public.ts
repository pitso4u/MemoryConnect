import crypto from 'crypto';
import { Router, Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { formatMemorial } from '../lib/utils';
import { tributeSchema } from '@memorialconnect/shared';
import { brandFromFuneralHome } from '@memorialconnect/shared';
import { isZodError } from '../lib/validation';
import { env } from '../lib/env';
import { isPubliclyViewable, MEMORIAL_STATUS } from '../lib/publishing';
import { verifyPreviewToken, verifyQAToken } from '../middleware/auth';
import { z } from 'zod';
import { DEMO_SLUG, demoMemorialSnapshot, demoProgramme } from '../lib/demoMemorial';
import { applyPerformanceEvent, finalizeDueMemorials } from '../lib/performance';

const router = Router();

function queryValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

function expired(res: any) {
  return res.status(410).json({ success: false, code: 'MEMORIAL_EXPIRED', message: 'This memorial viewing period has ended.' });
}

function isLikelyBot(userAgent?: string | null) {
  if (!userAgent) return true;
  return /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slackbot|telegrambot|headless|serviceworker/i.test(userAgent);
}

// The visitor identity is the persistent anonymous browser ID alone. IP
// address and user-agent are intentionally excluded so a visitor moving
// between networks (or a changed UA) still resolves to the same person.
function visitorHash(visitorId: string) {
  return crypto.createHash('sha256').update(`${env.JWT_SECRET}:visitor:${visitorId}`).digest('hex');
}

const viewSchema = z.object({
  visitorId: z.string().trim().min(12).max(200),
});

const publicMemorialInclude = {
  photos: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
  tributes: { where: { approved: true }, orderBy: { createdAt: 'desc' } },
  locations: { orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] },
  funeralHome: {
    select: {
      name: true, slug: true, tradingName: true, phone: true, email: true, address: true, logoUrl: true, iconUrl: true,
      primaryColor: true, secondaryColor: true, accentColor: true, backgroundColor: true, textColor: true,
      fontFamily: true, buttonStyle: true, cardStyle: true, borderRadius: true, whatsapp: true,
      websiteUrl: true, facebookUrl: true, instagramUrl: true, tiktokUrl: true, footerText: true,
      copyrightText: true, whiteLabelEnabled: true, themeTemplate: true, homeBackgroundUrl: true,
      loginBackgroundUrl: true, memorialHeroUrl: true, projectorBackgroundUrl: true, pdfWatermarkUrl: true,
      splashScreenUrl: true, memorialStyle: true, animationLevel: true, galleryLayout: true,
      timelineStyle: true, programmeStyle: true,
    },
  },
} satisfies Prisma.MemorialInclude;

async function getSeededDemoMemorial() {
  let memorial = null;
  try {
    memorial = await prisma.memorial.findFirst({
      where: { slug: DEMO_SLUG, isDemo: true, deletedAt: null },
      include: publicMemorialInclude,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') return null;
    throw error;
  }
  if (!memorial) return null;
  return {
    ...formatMemorial(memorial as unknown as Record<string, unknown>),
    photos: memorial.photos,
    tributes: memorial.tributes,
    locations: memorial.locations,
    funeralHome: { ...memorial.funeralHome, brand: brandFromFuneralHome(memorial.funeralHome) },
  };
}

router.get('/memorials/:slug', async (req, res) => {
  try {
    const slug = queryValue(req.params.slug);
    if (slug === DEMO_SLUG) {
      const demo = await getSeededDemoMemorial();
      return res.json({ success: true, data: demo || demoMemorialSnapshot() });
    }
    const memorial = await prisma.memorial.findFirst({
      where: { slug },
      include: publicMemorialInclude,
    });
    if (!memorial) return res.status(404).json({ success: false, message: 'Memorial not found' });
    const preview = verifyPreviewToken(queryValue(req.query.preview));
    const isPreview = Boolean(
      preview
      && preview.memorialId === memorial.id
      && preview.funeralHomeId === memorial.funeralHomeId,
    );
    if (!isPreview && !isPubliclyViewable(memorial)) return expired(res);

    const brand = brandFromFuneralHome(memorial.funeralHome);
    // Use memorial's custom logo if set, otherwise fall back to funeral home's logo
    brand.logoUrl = memorial.logoUrl || brand.logoUrl;

    res.json({
      success: true,
      data: {
        ...formatMemorial(memorial as unknown as Record<string, unknown>),
        photos: memorial.photos,
        tributes: memorial.tributes,
        locations: memorial.locations,
        funeralHome: { ...memorial.funeralHome, brand },
        isPreview,
      },
    });
  } catch (error) {
    console.error('Get public memorial error:', error);
    res.status(500).json({ success: false, message: 'Failed to load memorial' });
  }
});

router.post('/memorials/:slug/view', async (req, res) => {
  try {
    const slug = queryValue(req.params.slug);
    if (slug === DEMO_SLUG) return res.json({ success: true, data: { counted: false, viewCount: 0 } });
    if (req.get('x-memoryconnect-preview')?.toLowerCase() === 'true') {
      return res.json({ success: true, data: { counted: false } });
    }

    const body = viewSchema.parse(req.body || {});
    const memorial = await prisma.memorial.findFirst({ where: { slug, deletedAt: null } });
    if (!memorial) return res.status(404).json({ success: false, message: 'Memorial not found' });
    if (!isPubliclyViewable(memorial)) return expired(res);

    const userAgent = req.get('user-agent')?.slice(0, 500) || null;
    if (isLikelyBot(userAgent)) {
      return res.json({ success: true, data: { counted: false, viewCount: memorial.viewCount } });
    }

    const hash = visitorHash(body.visitorId);
    const now = new Date();
    let counted = false;
    const updated = await prisma.$transaction(async (tx) => {
      try {
        // Idempotent insert: ONE visitor + ONE memorial = ONE view, forever.
        // The (memorialId, visitorHash) unique constraint turns repeats
        // (refreshes, reopens, later days) into a no-op — equivalent to
        // INSERT ... ON CONFLICT (memorialId, visitorHash) DO NOTHING.
        await tx.memorialView.create({
          data: {
            memorialId: memorial.id,
            visitorHash: hash,
            userAgent,
            referrer: req.get('referer')?.slice(0, 1000) || null,
            createdAt: now,
          },
        });
        counted = true;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          counted = false;
          return memorial;
        }
        throw error;
      }
      const updatedMemorial = await tx.memorial.update({ where: { id: memorial.id }, data: { viewCount: { increment: 1 } } });
      await applyPerformanceEvent(tx, { id: memorial.id, publishedAt: memorial.publishedAt }, 'view', { visitorHash: hash, now }).catch(() => undefined);
      return updatedMemorial;
    });

    res.json({ success: true, data: { counted, viewCount: updated.viewCount } });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Record public memorial view error:', error);
    res.status(500).json({ success: false, message: 'Failed to record memorial view' });
  }
});

const engagementSchema = z.object({
  visitorId: z.string().trim().min(12).max(200).optional(),
});

async function recordEngagement(req: Request, eventType: 'qr_scan' | 'share', res: any) {
  try {
    const slug = queryValue(req.params.slug);
    if (slug === DEMO_SLUG) return res.json({ success: true, data: { counted: false } });
    if (req.get('x-memoryconnect-preview')?.toLowerCase() === 'true') {
      return res.json({ success: true, data: { counted: false } });
    }
    const memorial = await prisma.memorial.findFirst({ where: { slug, deletedAt: null } });
    if (!memorial) return res.status(404).json({ success: false, message: 'Memorial not found' });
    if (!isPubliclyViewable(memorial)) return expired(res);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await applyPerformanceEvent(tx, { id: memorial.id, publishedAt: memorial.publishedAt }, eventType, {
        visitorHash: null,
        now,
      });
    });
    return res.json({ success: true, data: { counted: true } });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error(`Record memorial ${eventType} error:`, error);
    return res.status(500).json({ success: false, message: 'Failed to record engagement' });
  }
}

router.post('/memorials/:slug/qr-scan', async (req, res) => {
  const body = engagementSchema.safeParse(req.body || {});
  if (!body.success) return res.status(400).json({ success: false, message: body.error.errors[0].message });
  return recordEngagement(req, 'qr_scan', res);
});

router.post('/memorials/:slug/share', async (req, res) => {
  const body = engagementSchema.safeParse(req.body || {});
  if (!body.success) return res.status(400).json({ success: false, message: body.error.errors[0].message });
  return recordEngagement(req, 'share', res);
});

router.get('/performance/maintenance', async (_req, res) => {
  const finalized = await finalizeDueMemorials().catch(() => 0);
  res.json({ success: true, data: { finalized } });
});

router.get('/memorials/:slug/projector', async (req, res) => {
  const slug = queryValue(req.params.slug);
  if (slug === DEMO_SLUG) {
    const seeded = await getSeededDemoMemorial();
    const demo = seeded || demoMemorialSnapshot();
    const programme = demo.programme as typeof demoProgramme;
    const currentProgrammeIndex = Number(demo.currentProgrammeIndex) || 0;
    return res.json({
      success: true,
      data: {
        deceasedName: demo.deceasedName,
        currentIndex: currentProgrammeIndex,
        totalItems: programme.length,
        currentItem: programme[currentProgrammeIndex],
        nextItem: programme[currentProgrammeIndex + 1],
        announcements: demo.announcements,
        photos: demo.photos,
        funeralHome: demo.funeralHome,
      },
    });
  }
  const memorial = await prisma.memorial.findFirst({
    where: { slug, deletedAt: null },
    include: {
      funeralHome: true,
      photos: {
        where: { deletedAt: null, mediaType: 'PHOTO' },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });
  if (!memorial) return res.status(404).json({ success: false, message: 'Memorial not found' });
  const preview = verifyPreviewToken(queryValue(req.query.preview));
  const isPreview = Boolean(preview && preview.memorialId === memorial.id && preview.funeralHomeId === memorial.funeralHomeId);
  if (!isPreview && !isPubliclyViewable(memorial)) return expired(res);
  const programme = memorial.programme as Array<Record<string, unknown>>;
  
  const brand = brandFromFuneralHome(memorial.funeralHome);
  // Use memorial's custom logo if set, otherwise fall back to funeral home's logo
  brand.logoUrl = memorial.logoUrl || brand.logoUrl;

  res.json({
    success: true,
    data: {
      deceasedName: memorial.deceasedName,
      currentIndex: memorial.currentProgrammeIndex,
      totalItems: programme.length,
      currentItem: programme[memorial.currentProgrammeIndex] || null,
      nextItem: programme[memorial.currentProgrammeIndex + 1] || null,
      announcements: (memorial.announcements as unknown[]).filter((item) => (item as Record<string, unknown>).active),
      photos: memorial.photos,
      funeralHome: { ...memorial.funeralHome, brand },
    },
  });
});

router.post('/memorials/:slug/tributes', async (req, res) => {
  try {
    if (queryValue(req.params.slug) === DEMO_SLUG) {
      return res.status(403).json({ success: false, message: 'The sample memorial does not accept tributes.' });
    }
    const body = tributeSchema.parse(req.body);
    const memorial = await prisma.memorial.findFirst({ where: { slug: req.params.slug, deletedAt: null } });
    if (!memorial) return res.status(404).json({ success: false, message: 'Memorial not found' });
    if (!isPubliclyViewable(memorial)) return expired(res);
    const settings = memorial.settings as Record<string, unknown>;
    if (!settings.showTributeWall) return res.status(403).json({ success: false, message: 'Tribute wall is disabled' });
    const moderate = settings.moderateTributes !== false;
    const tribute = await prisma.tribute.create({
      data: { memorialId: memorial.id, authorName: body.authorName, message: body.message, approved: !moderate },
    });
    res.status(201).json({ success: true, data: { ...tribute, pending: moderate } });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    res.status(500).json({ success: false, message: 'Failed to submit tribute' });
  }
});

router.post('/verify-qa', async (req, res) => {
  try {
    const token = req.body?.token;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Token required' });
    }
    const payload = verifyQAToken(token);
    if (!payload) {
      return res.status(403).json({ success: false, message: 'Invalid or expired QA token' });
    }
    res.json({ success: true, data: payload });
  } catch (error) {
    console.error('Verify QA token error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify QA token' });
  }
});

export default router;
