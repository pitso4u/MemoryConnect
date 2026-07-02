import crypto from 'crypto';
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { formatMemorial } from '../lib/utils';
import { tributeSchema } from '@memorialconnect/shared';
import { isZodError } from '../lib/validation';
import { env } from '../lib/env';
import { isPubliclyViewable, MEMORIAL_STATUS } from '../lib/publishing';
import { verifyPreviewToken } from '../middleware/auth';

const router = Router();

const DEMO_PROGRAMME = [
  { id: 'demo-1', type: 'opening_prayer', title: 'Opening prayer', speaker: 'Rev. Thabo Molefe', order: 0 },
  { id: 'demo-2', type: 'family_tribute', title: 'A tribute from the family', speaker: 'Lerato Dlamini', order: 1 },
  { id: 'demo-3', type: 'hymn', title: 'Hymn and reflection', speaker: 'Community Choir', order: 2 },
  { id: 'demo-4', type: 'burial', title: 'Committal and closing prayer', speaker: 'Rev. Thabo Molefe', order: 3 },
];

const DEMO_MEMORIAL = {
  id: 'memory-connect-demo',
  slug: 'demo',
  deceasedName: 'Nomvula Dlamini',
  dateOfBirth: '1954-05-12',
  dateOfDeath: '2026-06-20',
  serviceDate: '2026-06-27T08:00:00.000Z',
  serviceVenue: 'Ubuntu Community Chapel',
  deceasedPhotoUrl: null,
  obituary: 'Nomvula Dlamini lived with warmth, courage and a generous spirit. She devoted her life to her family, her faith and the community she loved. Her kindness will continue to be felt in every life she touched.',
  biography: null,
  programme: DEMO_PROGRAMME,
  currentProgrammeIndex: 1,
  announcements: [{ id: 'demo-announcement', message: 'Thank you for joining the family in remembrance.', active: true }],
  settings: { theme: 'elegant', showTributeWall: false, moderateTributes: true },
  status: MEMORIAL_STATUS.PUBLISHED,
  paymentStatus: 'SUCCESS',
  paymentId: null,
  publishedAt: '2026-06-27T07:00:00.000Z',
  editLocksAt: '2026-06-30T07:00:00.000Z',
  publicExpiresAt: '2099-12-31T23:59:59.000Z',
  deleteAfter: null,
  deletedAt: null,
  viewCount: 0,
  storageBytes: 0,
  photos: [],
  tributes: [
    { id: 'demo-tribute', memorialId: 'memory-connect-demo', authorName: 'The Mokoena Family', message: 'A beautiful soul remembered with love.', approved: true, createdAt: '2026-06-27T10:00:00.000Z' },
  ],
  locations: [
    { id: 'demo-location', memorialId: 'memory-connect-demo', type: 'CHURCH', name: 'Ubuntu Community Chapel', addressText: 'Johannesburg, Gauteng', latitude: -26.2041, longitude: 28.0473, notes: 'Please arrive 30 minutes before the service.', orderIndex: 0, createdAt: '2026-06-20T10:00:00.000Z', updatedAt: '2026-06-20T10:00:00.000Z' },
  ],
  funeralHome: {
    name: 'Ubuntu Funeral Care', phone: '011 555 0123', email: 'care@example.co.za', address: 'Johannesburg, Gauteng',
    logoUrl: null, primaryColor: '#c9a84c', secondaryColor: '#1a1a2e', websiteUrl: null, facebookUrl: null,
  },
  createdAt: '2026-06-20T10:00:00.000Z',
  updatedAt: '2026-06-27T10:00:00.000Z',
};

function queryValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

function expired(res: any) {
  return res.status(410).json({ success: false, code: 'MEMORIAL_EXPIRED', message: 'This memorial viewing period has ended.' });
}

function deviceType(userAgent?: string) {
  if (!userAgent) return null;
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  if (/mobile|android|iphone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

function ipHash(ip?: string) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(`${env.JWT_SECRET}:${ip}`).digest('hex');
}

router.get('/memorials/:slug', async (req, res) => {
  try {
    const slug = queryValue(req.params.slug);
    if (slug === 'demo') return res.json({ success: true, data: DEMO_MEMORIAL });
    const memorial = await prisma.memorial.findFirst({
      where: { slug },
      include: {
        photos: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
        tributes: { where: { approved: true }, orderBy: { createdAt: 'desc' } },
        locations: { orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] },
        funeralHome: {
          select: {
            name: true, phone: true, email: true, address: true, logoUrl: true,
            primaryColor: true, secondaryColor: true, websiteUrl: true, facebookUrl: true,
          },
        },
      },
    });
    if (!memorial) return res.status(404).json({ success: false, message: 'Memorial not found' });
    const preview = verifyPreviewToken(queryValue(req.query.preview));
    const isPreview = Boolean(
      preview
      && preview.memorialId === memorial.id
      && preview.funeralHomeId === memorial.funeralHomeId,
    );
    if (!isPreview && !isPubliclyViewable(memorial)) return expired(res);

    if (!isPreview) {
      const userAgent = req.get('user-agent')?.slice(0, 500) || null;
      await prisma.$transaction([
        prisma.memorialView.create({
          data: {
            memorialId: memorial.id,
            ipHash: ipHash(req.ip),
            userAgent,
            referrer: req.get('referer')?.slice(0, 1000) || null,
            country: req.get('cf-ipcountry')?.slice(0, 2) || null,
            deviceType: deviceType(userAgent || undefined),
          },
        }),
        prisma.memorial.update({ where: { id: memorial.id }, data: { viewCount: { increment: 1 } } }),
      ]);
    }

    res.json({
      success: true,
      data: {
        ...formatMemorial({ ...memorial, viewCount: memorial.viewCount + (isPreview ? 0 : 1) } as unknown as Record<string, unknown>),
        photos: memorial.photos,
        tributes: memorial.tributes,
        locations: memorial.locations,
        funeralHome: memorial.funeralHome,
        isPreview,
      },
    });
  } catch (error) {
    console.error('Get public memorial error:', error);
    res.status(500).json({ success: false, message: 'Failed to load memorial' });
  }
});

router.get('/memorials/:slug/projector', async (req, res) => {
  const slug = queryValue(req.params.slug);
  if (slug === 'demo') {
    return res.json({
      success: true,
      data: {
        deceasedName: DEMO_MEMORIAL.deceasedName,
        currentIndex: DEMO_MEMORIAL.currentProgrammeIndex,
        totalItems: DEMO_PROGRAMME.length,
        currentItem: DEMO_PROGRAMME[DEMO_MEMORIAL.currentProgrammeIndex],
        nextItem: DEMO_PROGRAMME[DEMO_MEMORIAL.currentProgrammeIndex + 1],
        announcements: DEMO_MEMORIAL.announcements,
      },
    });
  }
  const memorial = await prisma.memorial.findFirst({ where: { slug, deletedAt: null } });
  if (!memorial) return res.status(404).json({ success: false, message: 'Memorial not found' });
  const preview = verifyPreviewToken(queryValue(req.query.preview));
  const isPreview = Boolean(preview && preview.memorialId === memorial.id && preview.funeralHomeId === memorial.funeralHomeId);
  if (!isPreview && !isPubliclyViewable(memorial)) return expired(res);
  const programme = memorial.programme as Array<Record<string, unknown>>;
  res.json({
    success: true,
    data: {
      deceasedName: memorial.deceasedName,
      currentIndex: memorial.currentProgrammeIndex,
      totalItems: programme.length,
      currentItem: programme[memorial.currentProgrammeIndex] || null,
      nextItem: programme[memorial.currentProgrammeIndex + 1] || null,
      announcements: (memorial.announcements as unknown[]).filter((item) => (item as Record<string, unknown>).active),
    },
  });
});

router.post('/memorials/:slug/tributes', async (req, res) => {
  try {
    if (queryValue(req.params.slug) === 'demo') {
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

export default router;
