import { Router } from 'express';
import { Prisma } from '../generated/prisma';
import { prisma } from '../lib/prisma';
import { funeralFeedbackSchema } from '@memorialconnect/shared';
import { isZodError } from '../lib/validation';
import { isPubliclyViewable } from '../lib/publishing';
import { authenticate, requireRole, ROLES } from '../middleware/auth';
import { requireFeature } from '../lib/featureService';
import { sendContactRequestNotification } from '../lib/email';
import { z } from 'zod';

const router = Router();

// ── Public: Submit feedback for a published memorial ─────────────────────────

router.post('/public/memorials/:slug/feedback', async (req, res) => {
  try {
    const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
    if (!slug) return res.status(400).json({ success: false, message: 'Invalid slug' });

    const memorial = await prisma.memorial.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, status: true, isDemo: true, publicExpiresAt: true, deletedAt: true, funeralHomeId: true, funeralHome: { select: { email: true, name: true } } },
    });
    if (!memorial) return res.status(404).json({ success: false, message: 'Memorial not found' });

    if (!memorial.isDemo && !isPubliclyViewable(memorial)) {
      return res.status(403).json({ success: false, message: 'This memorial is not accepting feedback' });
    }

    const body = funeralFeedbackSchema.parse(req.body);

    if (body.allowContact) {
      if (!body.name || !body.name.trim()) {
        return res.status(400).json({ success: false, message: 'Name is required when requesting contact' });
      }
      if (!body.phone || !body.phone.trim()) {
        return res.status(400).json({ success: false, message: 'Phone is required when requesting contact' });
      }
    }

    const feedback = await prisma.funeralFeedback.create({
      data: {
        memorialId: memorial.id,
        overallRating: body.overallRating,
        staffRating: body.staffRating ?? null,
        organisationRating: body.organisationRating ?? null,
        venueRating: body.venueRating ?? null,
        recommend: body.recommend ?? null,
        useAgain: body.useAgain ?? null,
        comments: body.comments ?? null,
        allowContact: body.allowContact,
        name: body.allowContact ? (body.name ?? null) : null,
        phone: body.allowContact ? (body.phone ?? null) : null,
        email: body.allowContact ? (body.email ?? null) : null,
        contactStatus: body.allowContact ? 'NEW' : 'CLOSED',
      },
    });

    if (body.allowContact && memorial.funeralHome?.email) {
      try {
        await sendContactRequestNotification({
          funeralHomeEmail: memorial.funeralHome.email,
          funeralHomeName: memorial.funeralHome.name,
          name: body.name || '',
          phone: body.phone || '',
          email: body.email || '',
          overallRating: body.overallRating,
          comments: body.comments || '',
          memorialName: memorial.funeralHome.name,
          deceasedName: '',
        });
      } catch {
        console.warn('Failed to send contact request notification for feedback', feedback.id);
      }
    }

    res.status(201).json({ success: true, data: { id: feedback.id } });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Submit feedback error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit feedback' });
  }
});

// ── Admin: Get all feedback for a memorial ──────────────────────────────────

router.get(
  '/admin/memorials/:id/feedback',
  authenticate,
  requireFeature('FEEDBACK'),
  async (req, res) => {
    try {
      const memorialId = typeof req.params.id === 'string' ? req.params.id : '';
      if (!memorialId) return res.status(400).json({ success: false, message: 'Invalid memorial ID' });

      const memorial = await prisma.memorial.findUnique({
        where: { id: memorialId },
        select: { id: true, funeralHomeId: true, deceasedName: true, slug: true },
      });
      if (!memorial) return res.status(404).json({ success: false, message: 'Memorial not found' });

      const userRole = req.user?.role;
      if (userRole !== ROLES.SUPER_ADMIN && req.user?.funeralHomeId !== memorial.funeralHomeId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const feedback = await prisma.funeralFeedback.findMany({
        where: { memorialId },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: feedback });
    } catch (error) {
      console.error('Get feedback error:', error);
      res.status(500).json({ success: false, message: 'Failed to load feedback' });
    }
  },
);

// ── Admin: Get feedback summary for a memorial ──────────────────────────────

router.get(
  '/admin/memorials/:id/feedback/summary',
  authenticate,
  requireFeature('FEEDBACK'),
  async (req, res) => {
    try {
      const memorialId = typeof req.params.id === 'string' ? req.params.id : '';
      if (!memorialId) return res.status(400).json({ success: false, message: 'Invalid memorial ID' });

      const memorial = await prisma.memorial.findUnique({
        where: { id: memorialId },
        select: { id: true, funeralHomeId: true },
      });
      if (!memorial) return res.status(404).json({ success: false, message: 'Memorial not found' });

      const userRole = req.user?.role;
      if (userRole !== ROLES.SUPER_ADMIN && req.user?.funeralHomeId !== memorial.funeralHomeId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const allFeedback = await prisma.funeralFeedback.findMany({
        where: { memorialId },
        select: {
          overallRating: true,
          staffRating: true,
          organisationRating: true,
          venueRating: true,
          recommend: true,
          useAgain: true,
        },
      });

      const totalResponses = allFeedback.length;
      if (totalResponses === 0) {
        return res.json({
          success: true,
          data: {
            averageRating: 0,
            totalResponses: 0,
            recommendPercentage: 0,
            useAgainPercentage: 0,
            averageStaffRating: 0,
            averageOrganisationRating: 0,
            averageVenueRating: 0,
          },
        });
      }

      const recommendCount = allFeedback.filter((f) => f.recommend === true).length;
      const useAgainCount = allFeedback.filter((f) => f.useAgain === true).length;

      const staffRatings: number[] = [];
      const orgRatings: number[] = [];
      const venueRatings: number[] = [];
      for (const f of allFeedback) {
        if (f.staffRating !== null) staffRatings.push(f.staffRating);
        if (f.organisationRating !== null) orgRatings.push(f.organisationRating);
        if (f.venueRating !== null) venueRatings.push(f.venueRating);
      }

      const avg = (arr: number[]) => arr.length ? arr.reduce((sum, v) => sum + v, 0) / arr.length : 0;

      res.json({
        success: true,
        data: {
          averageRating: avg(allFeedback.map((f) => f.overallRating)),
          totalResponses,
          recommendPercentage: Math.round((recommendCount / totalResponses) * 100),
          useAgainPercentage: Math.round((useAgainCount / totalResponses) * 100),
          averageStaffRating: staffRatings.length ? avg(staffRatings) : 0,
          averageOrganisationRating: orgRatings.length ? avg(orgRatings) : 0,
          averageVenueRating: venueRatings.length ? avg(venueRatings) : 0,
        },
      });
    } catch (error) {
      console.error('Get feedback summary error:', error);
      res.status(500).json({ success: false, message: 'Failed to load feedback summary' });
    }
  },
);

// ── Admin: Update contact request status ────────────────────────────────────

const contactStatusSchema = z.object({
  contactStatus: z.enum(['NEW', 'CONTACTED', 'CLOSED']),
});

router.patch(
  '/admin/memorials/:id/feedback/:feedbackId/status',
  authenticate,
  requireFeature('FEEDBACK'),
  requireRole([ROLES.SUPER_ADMIN, ROLES.FUNERAL_HOME_ADMIN]),
  async (req, res) => {
    try {
      const feedbackId = typeof req.params.feedbackId === 'string' ? req.params.feedbackId : '';
      if (!feedbackId) return res.status(400).json({ success: false, message: 'Invalid feedback ID' });

      const { contactStatus } = contactStatusSchema.parse(req.body);

      const feedback = await prisma.funeralFeedback.findUnique({
        where: { id: feedbackId },
        select: { id: true, memorial: { select: { funeralHomeId: true } } },
      });
      if (!feedback) return res.status(404).json({ success: false, message: 'Feedback not found' });

      const userRole = req.user?.role;
      if (userRole !== ROLES.SUPER_ADMIN && req.user?.funeralHomeId !== feedback.memorial.funeralHomeId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const updated = await prisma.funeralFeedback.update({
        where: { id: feedbackId },
        data: {
          contactStatus,
          contactedAt: contactStatus === 'CONTACTED' ? new Date() : contactStatus === 'NEW' ? null : undefined,
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
      console.error('Update contact status error:', error);
      res.status(500).json({ success: false, message: 'Failed to update contact status' });
    }
  },
);

// ── Admin: Get all contact enquiries across funeral home ─────────────────────

router.get(
  '/admin/contact-enquiries',
  authenticate,
  requireFeature('FEEDBACK'),
  requireRole([ROLES.SUPER_ADMIN, ROLES.FUNERAL_HOME_ADMIN]),
  async (req, res) => {
    try {
      const userRole = req.user?.role;
      const where: Prisma.FuneralFeedbackWhereInput = {
        allowContact: true,
        name: { not: null },
        phone: { not: null },
      };

      if (userRole !== ROLES.SUPER_ADMIN && req.user?.funeralHomeId) {
        where.memorial = { funeralHomeId: req.user.funeralHomeId };
      }

      const enquiries = await prisma.funeralFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          memorial: { select: { deceasedName: true, slug: true } },
        },
      });

      const summary = {
        NEW: enquiries.filter((e) => e.contactStatus === 'NEW').length,
        CONTACTED: enquiries.filter((e) => e.contactStatus === 'CONTACTED').length,
        CLOSED: enquiries.filter((e) => e.contactStatus === 'CLOSED').length,
        total: enquiries.length,
        thisMonth: enquiries.filter((e) => {
          const d = new Date(e.createdAt);
          const now = new Date();
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length,
      };

      res.json({ success: true, data: { enquiries, summary } });
    } catch (error) {
      console.error('Get contact enquiries error:', error);
      res.status(500).json({ success: false, message: 'Failed to load enquiries' });
    }
  },
);

export default router;
