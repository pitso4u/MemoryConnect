import { prisma } from '../lib/prisma';

/**
 * Seeds the SmartSales CRM with the two permanent sample leads that the
 * original client-side prototype shipped with. Idempotent: does nothing if
 * leads already exist so it is safe to run on every deploy.
 */
async function main() {
  const existing = await prisma.crmLead.count();
  if (existing > 0) {
    console.log(`CRM seed skipped: ${existing} leads already present.`);
    return;
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  await prisma.crmLead.create({
    data: {
      project: 'Memory Connect',
      funeralHome: 'Mokoena Funeral Services',
      province: 'Free State',
      town: 'Welkom',
      owner: 'Mr Mokoena',
      phone: '0820000000',
      whatsapp: '0820000000',
      email: 'info@mokoenafunerals.co.za',
      source: 'Google Maps',
      status: 'Demo Booked',
      revenue: 0,
      followUpDate: '2026-07-22',
      demoDate: '2026-07-25',
      notes: 'Owner wants to see QR codes and printed programme examples.',
      dateAdded: new Date('2026-07-15T07:22:00.000Z'),
      activities: {
        create: [
          { type: 'Email', at: new Date('2026-07-15T07:22:00.000Z'), note: 'Intro sent.' },
          { type: 'WhatsApp', at: new Date('2026-07-15T07:25:00.000Z'), note: 'Sent brochure.' },
          { type: 'Call', at: new Date('2026-07-16T09:40:00.000Z'), note: 'Interested. Demo next week.' },
        ],
      },
    },
  });

  await prisma.crmLead.create({
    data: {
      project: 'DocuEase',
      funeralHome: 'Heaven Rest Parlour',
      province: 'Gauteng',
      town: 'Soweto',
      owner: 'Ms Nkosi',
      phone: '0830000000',
      whatsapp: '0830000000',
      email: 'admin@heavenrest.co.za',
      source: 'Referral',
      status: 'Contacted',
      revenue: 0,
      followUpDate: today,
      notes: 'Asked for a simple document workflow demo.',
      dateAdded: now,
      activities: {
        create: [{ type: 'Call', at: now, note: 'Initial discussion.' }],
      },
    },
  });

  console.log('CRM seed complete: 2 sample leads created.');
}

main()
  .catch((error) => {
    console.error('CRM seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
