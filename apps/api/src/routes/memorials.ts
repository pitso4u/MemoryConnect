import { Router, Request } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { createMemorialSlug, formatMemorial } from '../lib/utils';
import { canPublishAnotherMemorial, getActiveSubscription, getUsage } from '../lib/billing';
import { isZodError } from '../lib/validation';

const router = Router();

function rand(cents: number) {
  return `R${(cents / 100).toFixed(2)}`;
}

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

const createSchema = z.object({
  deceasedName: z.string().min(2),
  dateOfBirth: z.string().optional(),
  dateOfDeath: z.string().optional(),
  serviceDate: z.string().optional(),
  serviceVenue: z.string().optional(),
});

const updateSchema = z.object({
  deceasedName: z.string().min(2).optional(),
  dateOfBirth: z.string().optional().nullable(),
  dateOfDeath: z.string().optional().nullable(),
  serviceDate: z.string().optional().nullable(),
  serviceVenue: z.string().optional().nullable(),
  coverPhotoUrl: z.string().optional().nullable(),
  obituary: z.string().optional().nullable(),
  biography: z.record(z.unknown()).optional(),
  programme: z.array(z.record(z.unknown())).optional(),
  currentProgrammeIndex: z.number().int().min(0).optional(),
  announcements: z.array(z.record(z.unknown())).optional(),
  settings: z.record(z.unknown()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

router.get('/', authenticate, async (req, res) => {
  try {
    const memorials = await prisma.memorial.findMany({
      where: { funeralHomeId: req.user!.funeralHomeId },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: memorials.map((m: any) => formatMemorial(m as unknown as Record<string, unknown>)),
    });
  } catch (err) {
    console.error('List memorials error:', err);
    res.status(500).json({ success: false, error: 'Failed to load memorials' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const body = createSchema.parse(req.body);
    const slug = createMemorialSlug();
    const activeSubscription = await getActiveSubscription(req.user!.funeralHomeId);
    if (!activeSubscription) {
      const existingDemo = await prisma.memorial.findFirst({
        where: { funeralHomeId: req.user!.funeralHomeId, isDemo: true },
        select: { id: true },
      });
      if (existingDemo) {
        return res.status(402).json({
          success: false,
          code: 'BILLING_REQUIRED',
          error: 'Your free demo memorial is already in use. Activate a Memory Connect plan to create real funeral memorials.',
        });
      }
    }

    const memorial = await prisma.memorial.create({
      data: {
        slug,
        deceasedName: body.deceasedName,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        dateOfDeath: body.dateOfDeath ? new Date(body.dateOfDeath) : null,
        serviceDate: body.serviceDate ? new Date(body.serviceDate) : null,
        serviceVenue: body.serviceVenue,
        funeralHomeId: req.user!.funeralHomeId,
        isDemo: !activeSubscription,
        programme: [],
        announcements: [],
        settings: {
          theme: 'elegant',
          showTributeWall: true,
          moderateTributes: true,
          showDonations: false,
        },
      },
    });

    res.status(201).json({
      success: true,
      data: formatMemorial(memorial as unknown as Record<string, unknown>),
    });
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    console.error('Create memorial error:', err);
    res.status(500).json({ success: false, error: 'Failed to create memorial' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = paramId(req);
    const memorial = await prisma.memorial.findFirst({
      where: { id, funeralHomeId: req.user!.funeralHomeId },
      include: {
        photos: { orderBy: { order: 'asc' } },
        tributes: { orderBy: { createdAt: 'desc' } },
        locations: { orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    if (!memorial) {
      return res.status(404).json({ success: false, error: 'Memorial not found' });
    }

    res.json({
      success: true,
      data: {
        ...formatMemorial(memorial as unknown as Record<string, unknown>),
        photos: memorial.photos,
        tributes: memorial.tributes,
        locations: memorial.locations,
      },
    });
  } catch (error) {
    console.error('Get memorial error:', error);
    res.status(500).json({ success: false, error: 'Failed to load memorial' });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const id = paramId(req);
    const body = updateSchema.parse(req.body);
    const existing = await prisma.memorial.findFirst({
      where: { id, funeralHomeId: req.user!.funeralHomeId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Memorial not found' });
    }

    let subscription: Awaited<ReturnType<typeof getActiveSubscription>> = null;
    let shouldRecordUsage = false;
    if (body.status === 'published' && existing.status !== 'published' && !existing.isDemo) {
      subscription = await getActiveSubscription(req.user!.funeralHomeId);
      if (!subscription) {
        return res.status(402).json({
          success: false,
          code: 'BILLING_REQUIRED',
          error: 'Activate a Memory Connect plan before publishing this memorial.',
        });
      }
      const existingUsage = await prisma.usageLedger.findUnique({ where: { memorialId: id } });
      if (!existingUsage) {
        const usage = await getUsage(req.user!.funeralHomeId, subscription);
        if (!canPublishAnotherMemorial(usage)) {
          return res.status(402).json({
            success: false,
            code: 'MEMORIAL_LIMIT_REACHED',
            error: `You have used all included funerals for this billing cycle. Pay ${rand(subscription.plan.extraMemorialAmount)} for one extra funeral memorial, or upgrade your plan.`,
          });
        }
        shouldRecordUsage = true;
      }
    }

    const { biography, programme, announcements, settings, ...rest } = body;
    const memorial = await prisma.memorial.update({
      where: { id },
      data: {
        ...rest,
        biography: biography as any | undefined,
        programme: programme as any | undefined,
        announcements: announcements as any | undefined,
        settings: settings as any | undefined,
        dateOfBirth: body.dateOfBirth !== undefined
          ? body.dateOfBirth ? new Date(body.dateOfBirth) : null
          : undefined,
        dateOfDeath: body.dateOfDeath !== undefined
          ? body.dateOfDeath ? new Date(body.dateOfDeath) : null
          : undefined,
        serviceDate: body.serviceDate !== undefined
          ? body.serviceDate ? new Date(body.serviceDate) : null
          : undefined,
      },
    });

    if (shouldRecordUsage && subscription) {
      await prisma.usageLedger.create({
        data: {
          funeralHomeId: req.user!.funeralHomeId,
          subscriptionId: subscription.id,
          memorialId: id,
          periodStart: subscription.currentPeriodStart!,
          periodEnd: subscription.currentPeriodEnd!,
        },
      });
    }

    res.json({
      success: true,
      data: formatMemorial(memorial as unknown as Record<string, unknown>),
    });
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, error: 'Failed to update memorial' });
  }
});

router.post('/:id/programme/next', authenticate, async (req, res) => {
  const id = paramId(req);
  const memorial = await prisma.memorial.findFirst({
    where: { id, funeralHomeId: req.user!.funeralHomeId },
  });

  if (!memorial) {
    return res.status(404).json({ success: false, error: 'Memorial not found' });
  }

  const programme = memorial.programme as unknown[];
  const nextIndex = Math.min(memorial.currentProgrammeIndex + 1, programme.length - 1);

  const updated = await prisma.memorial.update({
    where: { id },
    data: { currentProgrammeIndex: nextIndex },
  });

  res.json({
    success: true,
    data: formatMemorial(updated as unknown as Record<string, unknown>),
  });
});

router.post('/:id/programme/previous', authenticate, async (req, res) => {
  const id = paramId(req);
  const memorial = await prisma.memorial.findFirst({
    where: { id, funeralHomeId: req.user!.funeralHomeId },
  });

  if (!memorial) {
    return res.status(404).json({ success: false, error: 'Memorial not found' });
  }

  const prevIndex = Math.max(memorial.currentProgrammeIndex - 1, 0);

  const updated = await prisma.memorial.update({
    where: { id },
    data: { currentProgrammeIndex: prevIndex },
  });

  res.json({
    success: true,
    data: formatMemorial(updated as unknown as Record<string, unknown>),
  });
});

router.delete('/:id', authenticate, async (req, res) => {
  const id = paramId(req);
  const existing = await prisma.memorial.findFirst({
    where: { id, funeralHomeId: req.user!.funeralHomeId },
  });

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Memorial not found' });
  }

  await prisma.memorial.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
