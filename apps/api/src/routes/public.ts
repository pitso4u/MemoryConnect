import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { formatMemorial } from '../lib/utils';
import { tributeSchema } from '@memorialconnect/shared';

const router = Router();

router.get('/memorials/:slug', async (req, res) => {
  const memorial = await prisma.memorial.findFirst({
    where: { slug: req.params.slug, status: 'published' },
    include: {
      photos: { orderBy: { order: 'asc' } },
      tributes: { where: { approved: true }, orderBy: { createdAt: 'desc' } },
      funeralHome: { select: { name: true, phone: true, logoUrl: true } },
    },
  });

  if (!memorial) {
    return res.status(404).json({ success: false, message: 'Memorial not found' });
  }

  res.json({
    success: true,
    data: {
      ...formatMemorial(memorial as unknown as Record<string, unknown>),
      photos: memorial.photos,
      tributes: memorial.tributes,
      funeralHome: memorial.funeralHome,
    },
  });
});

router.get('/memorials/:slug/projector', async (req, res) => {
  const memorial = await prisma.memorial.findFirst({
    where: { slug: req.params.slug, status: 'published' },
  });

  if (!memorial) {
    return res.status(404).json({ success: false, message: 'Memorial not found' });
  }

  const programme = memorial.programme as Array<Record<string, unknown>>;
  const current = programme[memorial.currentProgrammeIndex];
  const next = programme[memorial.currentProgrammeIndex + 1];

  res.json({
    success: true,
    data: {
      deceasedName: memorial.deceasedName,
      currentIndex: memorial.currentProgrammeIndex,
      totalItems: programme.length,
      currentItem: current || null,
      nextItem: next || null,
      announcements: (memorial.announcements as unknown[]).filter(
        (a) => (a as Record<string, unknown>).active
      ),
    },
  });
});

router.post('/memorials/:slug/tributes', async (req, res) => {
  try {
    const body = tributeSchema.parse(req.body);
    const memorial = await prisma.memorial.findFirst({
      where: { slug: req.params.slug, status: 'published' },
    });

    if (!memorial) {
      return res.status(404).json({ success: false, message: 'Memorial not found' });
    }

    const settings = memorial.settings as Record<string, unknown>;
    if (!settings.showTributeWall) {
      return res.status(403).json({ success: false, message: 'Tribute wall is disabled' });
    }

    const moderate = settings.moderateTributes !== false;

    const tribute = await prisma.tribute.create({
      data: {
        memorialId: memorial.id,
        authorName: body.authorName,
        message: body.message,
        approved: !moderate,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...tribute,
        pending: moderate,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: err.errors[0].message });
    }
    res.status(500).json({ success: false, message: 'Failed to submit tribute' });
  }
});

export default router;
