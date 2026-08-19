import { Router, Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, ROLES } from '../middleware/auth';
import { isZodError } from '../lib/validation';
import { createCrmLeadSchema, updateCrmLeadSchema, createCrmActivitySchema } from '@memorialconnect/shared';

const CRM_ROLES = [ROLES.SUPER_ADMIN, ROLES.FUNERAL_HOME_ADMIN, ROLES.FUNERAL_HOME_STAFF];

const router = Router();
router.use(authenticate, requireRole(CRM_ROLES));

type CrmLeadWithActivities = Prisma.CrmLeadGetPayload<{ include: { activities: true } }>;

function paramId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function leadInclude() {
  return { activities: { orderBy: { at: 'desc' as const } } } satisfies Prisma.CrmLeadInclude;
}

function statusForActivity(type: string): string | null {
  if (type === 'Email' || type === 'WhatsApp' || type === 'Call') return 'Contacted';
  if (type === 'Follow-up') return 'Waiting';
  if (type === 'Demo') return 'Demo Booked';
  if (type === 'Closed Sale') return 'Customer';
  if (type === 'Not Interested') return 'Lost';
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// LIST LEADS
// ══════════════════════════════════════════════════════════════════════════

router.get('/', async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const project = req.query.project as string | undefined;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (project) where.project = project;
    const leads = await prisma.crmLead.findMany({
      where,
      include: leadInclude(),
      orderBy: { dateAdded: 'desc' },
    });
    res.json({ success: true, data: leads });
  } catch (error) {
    console.error('Get CRM leads error:', error);
    res.status(500).json({ success: false, message: 'Failed to load leads' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET SINGLE LEAD
// ══════════════════════════════════════════════════════════════════════════

router.get('/:id', async (req, res) => {
  try {
    const lead = await prisma.crmLead.findUnique({ where: { id: paramId(req) }, include: leadInclude() });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (error) {
    console.error('Get CRM lead error:', error);
    res.status(500).json({ success: false, message: 'Failed to load lead' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// CREATE LEAD
// ══════════════════════════════════════════════════════════════════════════

router.post('/', async (req, res) => {
  try {
    const body = createCrmLeadSchema.parse(req.body);
    const lead = await prisma.crmLead.create({
      data: { ...body, createdById: req.user?.userId } as never,
      include: leadInclude(),
    });
    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Create CRM lead error:', error);
    res.status(500).json({ success: false, message: 'Failed to create lead' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// UPDATE LEAD
// ══════════════════════════════════════════════════════════════════════════

router.patch('/:id', async (req, res) => {
  try {
    const body = updateCrmLeadSchema.parse(req.body);
    const existing = await prisma.crmLead.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Lead not found' });
    const lead = await prisma.crmLead.update({
      where: { id: existing.id },
      data: body as never,
      include: leadInclude(),
    });
    res.json({ success: true, data: lead });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Update CRM lead error:', error);
    res.status(500).json({ success: false, message: 'Failed to update lead' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE LEAD
// ══════════════════════════════════════════════════════════════════════════

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.crmLead.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Lead not found' });
    await prisma.crmLead.delete({ where: { id: existing.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete CRM lead error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete lead' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ADD ACTIVITY (also advances the lead status)
// ══════════════════════════════════════════════════════════════════════════

router.post('/:id/activities', async (req, res) => {
  try {
    const body = createCrmActivitySchema.parse(req.body);
    const existing = await prisma.crmLead.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Lead not found' });

    const activity = await prisma.crmActivity.create({
      data: { leadId: existing.id, type: body.type, note: body.note || null },
    });

    const nextStatus = statusForActivity(body.type);
    let lead: CrmLeadWithActivities;
    if (nextStatus && existing.status !== nextStatus) {
      lead = await prisma.crmLead.update({
        where: { id: existing.id },
        data: { status: nextStatus },
        include: leadInclude(),
      });
    } else {
      lead = await prisma.crmLead.findUniqueOrThrow({
        where: { id: existing.id },
        include: leadInclude(),
      });
    }

    res.status(201).json({ success: true, data: { activity, lead } });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Add CRM activity error:', error);
    res.status(500).json({ success: false, message: 'Failed to add activity' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE ACTIVITY
// ══════════════════════════════════════════════════════════════════════════

router.delete('/activities/:activityId', async (req, res) => {
  try {
    const activityId = String(req.params.activityId);
    const activity = await prisma.crmActivity.findUnique({ where: { id: activityId } });
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });
    await prisma.crmActivity.delete({ where: { id: activity.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete CRM activity error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete activity' });
  }
});

export default router;
