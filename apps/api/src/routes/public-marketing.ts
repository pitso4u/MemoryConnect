import { Router, Request } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { isZodError } from '../lib/validation';
import { env } from '../lib/env';
import { enquirySchema, analyticsEventSchema } from '@memorialconnect/shared';
import { brandFromFuneralHome } from '@memorialconnect/shared';

const router = Router();

function queryValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

function isLikelyBot(userAgent?: string | null) {
  if (!userAgent) return true;
  return /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slackbot|telegrambot|headless|serviceworker/i.test(userAgent);
}

function ipHash(ip: string | undefined): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(`${env.JWT_SECRET}:ip:${ip}`).digest('hex');
}

// ── Get funeral home marketing page data ──────────────────────────────────

router.get('/funeral-homes/:slug', async (req, res) => {
  try {
    const slug = queryValue(req.params.slug);
    if (!slug) return res.status(400).json({ success: false, message: 'Invalid slug' });

    const funeralHome = await prisma.funeralHome.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: {
        id: true, name: true, slug: true, tradingName: true, logoUrl: true, iconUrl: true,
        phone: true, email: true, address: true, whatsapp: true, websiteUrl: true,
        facebookUrl: true, instagramUrl: true, tiktokUrl: true, footerText: true, copyrightText: true,
        whiteLabelEnabled: true, themeTemplate: true,
        primaryColor: true, secondaryColor: true, accentColor: true, backgroundColor: true, textColor: true,
        fontFamily: true, buttonStyle: true, cardStyle: true, borderRadius: true,
        memorialHeroUrl: true, homeBackgroundUrl: true,
      },
    });

    if (!funeralHome) return res.status(404).json({ success: false, message: 'Funeral home not found' });

    const [contact, brochures, promotions, branches] = await Promise.all([
      prisma.marketingContact.findUnique({ where: { funeralHomeId: funeralHome.id } }),
      prisma.brochure.findMany({
        where: { funeralHomeId: funeralHome.id, published: true },
        orderBy: [{ featured: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'desc' }],
        include: { category: true, gallery: { orderBy: { displayOrder: 'asc' }, take: 1 } },
      }),
      prisma.promotion.findMany({
        where: {
          funeralHomeId: funeralHome.id,
          published: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.branch.findMany({
        where: { funeralHomeId: funeralHome.id },
        orderBy: { name: 'asc' },
      }),
    ]);

    const brand = brandFromFuneralHome(funeralHome as any);

    res.json({
      success: true,
      data: {
        funeralHome: { ...funeralHome, brand },
        contact,
        brochures,
        promotions: promotions.map((p) => ({ ...p, active: true })),
        branches,
      },
    });
  } catch (error) {
    console.error('Get funeral home marketing page error:', error);
    res.status(500).json({ success: false, message: 'Failed to load page' });
  }
});

// ── List brochures for a funeral home ─────────────────────────────────────

router.get('/funeral-homes/:slug/brochures', async (req, res) => {
  try {
    const slug = queryValue(req.params.slug);
    if (!slug) return res.status(400).json({ success: false, message: 'Invalid slug' });
    const funeralHome = await prisma.funeralHome.findFirst({ where: { slug, status: 'ACTIVE' }, select: { id: true } });
    if (!funeralHome) return res.status(404).json({ success: false, message: 'Funeral home not found' });

    const categorySlug = queryValue(req.query.category);
    const where: Record<string, unknown> = { funeralHomeId: funeralHome.id, published: true };
    if (categorySlug) where.category = { slug: categorySlug };

    const brochures = await prisma.brochure.findMany({
      where: where as any,
      orderBy: [{ featured: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'desc' }],
      include: { category: true, gallery: { orderBy: { displayOrder: 'asc' }, take: 1 } },
    });

    res.json({ success: true, data: brochures });
  } catch (error) {
    console.error('List brochures error:', error);
    res.status(500).json({ success: false, message: 'Failed to load brochures' });
  }
});

// ── Get single brochure page (canonical, tenant-scoped) ───────────────────
// Canonical URL is /services/{funeralHomeSlug}/{brochureSlug}. The funeral home
// is resolved from its slug first (status ACTIVE), then the brochure is looked
// up scoped to that funeral home. Only published brochures are exposed.

const publicBrochureFuneralHomeSelect = {
  id: true, name: true, slug: true, tradingName: true, logoUrl: true, iconUrl: true,
  phone: true, email: true, address: true, whatsapp: true, websiteUrl: true,
  facebookUrl: true, instagramUrl: true, tiktokUrl: true,
  primaryColor: true, secondaryColor: true, accentColor: true, backgroundColor: true,
  textColor: true, fontFamily: true, buttonStyle: true, cardStyle: true, borderRadius: true,
} as const;

async function resolveBrochure(fhSlug: string | undefined, slug: string | undefined) {
  if (!fhSlug || !slug) return null;
  const funeralHome = await prisma.funeralHome.findFirst({
    where: { slug: fhSlug, status: 'ACTIVE' },
    select: publicBrochureFuneralHomeSelect,
  });
  if (!funeralHome) return null;
  const brochure = await prisma.brochure.findFirst({
    where: { funeralHomeId: funeralHome.id, slug },
    include: { category: true, gallery: { orderBy: { displayOrder: 'asc' } } },
  });
  if (!brochure || !brochure.published) return null;
  return { funeralHome, brochure };
}

router.get('/brochures/:fhSlug/:slug', async (req, res) => {
  try {
    const resolved = await resolveBrochure(queryValue(req.params.fhSlug), queryValue(req.params.slug));
    if (!resolved) return res.status(404).json({ success: false, message: 'Brochure not found' });
    const brand = brandFromFuneralHome(resolved.funeralHome as any);
    res.json({
      success: true,
      data: {
        brochure: { ...resolved.brochure, viewCount: resolved.brochure.viewCount },
        funeralHome: { ...resolved.funeralHome, brand },
        contact: await prisma.marketingContact.findUnique({ where: { funeralHomeId: resolved.brochure.funeralHomeId } }),
      },
    });
  } catch (error) {
    console.error('Get brochure error:', error);
    res.status(500).json({ success: false, message: 'Failed to load brochure' });
  }
});

// ── Legacy single-brochure redirect (backwards compatibility) ─────────────
// Old URLs are /services/{slug}. When the slug resolves to exactly one
// published brochure, return its canonical path so existing links and printed
// QR codes redirect to the tenant-scoped URL. Ambiguous slugs are not
// auto-resolved.

router.get('/brochures/:slug', async (req, res) => {
  try {
    const slug = queryValue(req.params.slug);
    if (!slug) return res.status(400).json({ success: false, message: 'Invalid slug' });
    const matches = await prisma.brochure.findMany({
      where: { slug, published: true },
      select: { funeralHome: { select: { slug: true } } },
    });
    const fhSlugs = matches.map((m) => m.funeralHome?.slug).filter((s): s is string => Boolean(s));
    if (fhSlugs.length === 0) return res.status(404).json({ success: false, message: 'Brochure not found' });
    if (fhSlugs.length > 1) {
      return res.status(409).json({ success: false, message: 'This brochure link is ambiguous and could not be resolved automatically.' });
    }
    res.json({ success: true, data: { canonicalPath: `/services/${fhSlugs[0]}/${slug}` } });
  } catch (error) {
    console.error('Resolve legacy brochure error:', error);
    res.status(500).json({ success: false, message: 'Failed to load brochure' });
  }
});

// ── Submit brochure enquiry ───────────────────────────────────────────────

async function createEnquiryForBrochure(brochure: { id: string; funeralHomeId: string }, req: Request, res: any) {
  const body = enquirySchema.parse(req.body);
  const enquiry = await prisma.enquiry.create({
    data: {
      brochureId: brochure.id,
      funeralHomeId: brochure.funeralHomeId,
      fullName: body.fullName,
      phoneNumber: body.phoneNumber ?? null,
      emailAddress: body.emailAddress ?? null,
      message: body.message ?? null,
    },
  });

  // Track enquiry event
  try {
    const userAgent = req.get('user-agent')?.slice(0, 500) || null;
    await prisma.analyticsEvent.create({
      data: {
        funeralHomeId: brochure.funeralHomeId,
        brochureId: brochure.id,
        eventType: 'enquiry',
        visitorId: null,
        ipHash: ipHash(req.ip),
        userAgent,
      },
    });
  } catch { /* analytics non-blocking */ }

  res.status(201).json({ success: true, data: { id: enquiry.id } });
}

router.post('/brochures/:fhSlug/:slug/enquiry', async (req, res) => {
  try {
    const resolved = await resolveBrochure(queryValue(req.params.fhSlug), queryValue(req.params.slug));
    if (!resolved) return res.status(404).json({ success: false, message: 'Brochure not found' });
    return createEnquiryForBrochure(resolved.brochure, req, res);
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Submit enquiry error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit enquiry' });
  }
});

// Legacy enquiry endpoint: resolves a single unambiguous slug so old links keep working.
router.post('/brochures/:slug/enquiry', async (req, res) => {
  try {
    const slug = queryValue(req.params.slug);
    if (!slug) return res.status(400).json({ success: false, message: 'Invalid slug' });
    const matches = await prisma.brochure.findMany({
      where: { slug, published: true },
      select: { id: true, funeralHomeId: true },
    });
    if (matches.length !== 1) return res.status(404).json({ success: false, message: 'Brochure not found' });
    return createEnquiryForBrochure(matches[0], req, res);
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Submit enquiry error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit enquiry' });
  }
});

// ── Track analytics event (public) ────────────────────────────────────────

router.post('/analytics/track', async (req, res) => {
  try {
    const body = analyticsEventSchema.parse(req.body);
    const userAgent = req.get('user-agent')?.slice(0, 500) || null;

    if (isLikelyBot(userAgent)) {
      return res.json({ success: true, data: { tracked: false } });
    }

    let brochureId = body.brochureId || null;
    let funeralHomeId: string | null = null;

    if (brochureId) {
      const brochure = await prisma.brochure.findUnique({
        where: { id: brochureId },
        select: { id: true, funeralHomeId: true },
      });
      if (brochure) {
        brochureId = brochure.id;
        funeralHomeId = brochure.funeralHomeId;
      }
    }

    await prisma.analyticsEvent.create({
      data: {
        funeralHomeId,
        brochureId,
        eventType: body.eventType,
        metadata: body.metadata || null,
        visitorId: body.visitorId || null,
        ipHash: ipHash(req.ip),
        userAgent,
      },
    });

    // Update brochure view count for page_view events
    if (body.eventType === 'page_view' && brochureId) {
      await prisma.brochure.update({
        where: { id: brochureId },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {});
    }

    res.json({ success: true, data: { tracked: true } });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Track analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to track event' });
  }
});

// ── Short link redirect ───────────────────────────────────────────────────

router.get('/s/:slug', async (req, res) => {
  try {
    const slug = queryValue(req.params.slug);
    if (!slug) return res.status(400).json({ success: false, message: 'Invalid slug' });

    const link = await prisma.shortLink.findUnique({ where: { slug } });
    if (!link) return res.status(404).json({ success: false, message: 'Link not found' });

    await prisma.shortLink.update({ where: { id: link.id }, data: { clickCount: { increment: 1 } } });

    res.redirect(301, link.targetUrl);
  } catch (error) {
    console.error('Short link redirect error:', error);
    res.status(500).json({ success: false, message: 'Redirect failed' });
  }
});

export default router;
