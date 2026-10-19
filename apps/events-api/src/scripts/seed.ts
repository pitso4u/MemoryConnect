import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

// Development seed: wedding + birthday + graduation with realistic content.
// Run: npm run seed -w @memorialconnect/events-api
// Idempotent: existing slugs are skipped.
async function main() {
  const email = 'demo@events.local';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const organiser = await prisma.organiser.create({
      data: {
        name: 'Demo Family',
        email,
        users: {
          create: { name: 'Demo Organiser', email, passwordHash: await bcrypt.hash('events-demo-123', 12) },
        },
      },
      include: { users: true },
    });
    user = organiser.users[0];
    console.log(`Demo organiser created: ${email} / events-demo-123`);
  } else {
    console.log(`Demo organiser exists: ${email} / events-demo-123`);
  }
  const organiserId = user.organiserId;

  const demos = [
    {
      slug: 'sarah-john-wedding-demo',
      eventType: 'WEDDING',
      title: "Sarah & John's Wedding",
      description: [
        'It started with a shared taxi route and a borrowed umbrella — five years later,',
        'we are getting married and we want you there.',
        '',
        'Join us for an outdoor ceremony on the lawn, followed by dinner, speeches,',
        'and dancing under the Joburg sky. Dress code: garden formal.',
      ].join('\n'),
      hostName: 'Sarah & John',
      start: new Date('2026-11-21T11:00:00+02:00'),
      end: new Date('2026-11-21T22:00:00+02:00'),
      theme: 'ELEGANT',
      location: {
        name: 'Johannesburg Country Club',
        address: 'Auckland Park, Johannesburg',
        notes: 'Ceremony on the lawn at 11:00 sharp. Free parking at the main gate; shuttles run every 20 minutes.',
      },
      agenda: [
        { title: 'Guests arrive & welcome drinks', description: 'Find your seat on the lawn and enjoy a cold drink.', startTime: '10:00', endTime: '10:45', order: 0 },
        { title: 'Wedding ceremony', description: 'Officiated by Rev. Maseko.', startTime: '11:00', endTime: '12:00', location: 'Main lawn', order: 1 },
        { title: 'Family photos', description: 'Bridal party and family portraits in the gardens.', startTime: '12:30', endTime: '13:30', order: 2 },
        { title: 'Reception & dinner', description: 'Three-course dinner, speeches and the first dance.', startTime: '14:00', endTime: '20:00', location: 'Club hall', order: 3 },
        { title: 'Celebration & send-off', description: 'Dancing, dessert table and sparkler send-off.', startTime: '20:00', endTime: '22:00', order: 4 },
      ],
      messages: [
        { authorName: 'Aunt Maria', message: 'So happy for you both! I have watched this love story from the front row — cannot wait to celebrate with you.' },
        { authorName: 'Sipho & Ayanda', message: 'Congratulations! Wishing you a lifetime of laughter, patience and Sunday morning pancakes.' },
        { authorName: 'Gogo Dlamini', message: 'My grandchildren are getting married! I am counting the days.' },
      ],
    },
    {
      slug: 'thabo-50th-birthday-demo',
      eventType: 'BIRTHDAY',
      title: "Thabo's 50th Birthday",
      description: [
        'Fifty years of stories, questionable dance moves and legendary braais —',
        'and Thabo is just getting started.',
        '',
        'Join us for a night of great food, live music and a few surprises.',
        'Dress code: gold and black. No gifts — your presence is the present.',
      ].join('\n'),
      hostName: 'Thabo',
      start: new Date('2026-10-10T18:00:00+02:00'),
      end: new Date('2026-10-10T23:00:00+02:00'),
      theme: 'CELEBRATION',
      location: {
        name: 'The Venue, Sandton',
        address: 'Sandton, Johannesburg',
        notes: 'Doors open at 17:30. Secure parking in the basement; entrance on the corner.',
      },
      agenda: [
        { title: 'Welcome drinks & canapés', startTime: '18:00', endTime: '19:00', order: 0 },
        { title: 'Birthday dinner', description: 'Cape Malay curry buffet with vegetarian options.', startTime: '19:00', endTime: '20:30', order: 1 },
        { title: 'Speeches, roast & cake', description: 'Friends and family take the mic — keep it kind!', startTime: '20:30', endTime: '21:30', order: 2 },
        { title: 'Dance floor with DJ Tumi', startTime: '21:30', endTime: '23:00', order: 3 },
      ],
      messages: [
        { authorName: 'Lerato', message: 'Happy 50th! Half a century of being legendary. Save me a dance!' },
        { authorName: 'The Mokoena Family', message: 'To fifty more years of laughter. We love you, Thabo!' },
      ],
    },
    {
      slug: 'naledi-graduation-demo',
      eventType: 'GRADUATION',
      title: "Naledi's Graduation Celebration",
      description: [
        'After four years of early mornings, late nights and endless resits,',
        'Naledi has graduated with a BCom in Accounting — cum laude!',
        '',
        'Join the family for a celebratory lunch, a few proud speeches and',
        'plenty of photos in the garden.',
      ].join('\n'),
      hostName: 'Naledi — Class of 2026',
      start: new Date('2026-12-05T12:00:00+02:00'),
      end: new Date('2026-12-05T16:00:00+02:00'),
      theme: 'MODERN',
      location: {
        name: 'Family Home, Pretoria',
        address: 'Pretoria East',
        notes: 'Parking on the street; the marquee is in the back garden. Bring a chair if you can.',
      },
      agenda: [
        { title: 'Arrival & congratulations', startTime: '12:00', endTime: '12:30', order: 0 },
        { title: 'Celebration lunch', description: 'Spitbraai, salads and Malva pudding.', startTime: '12:30', endTime: '14:00', order: 1 },
        { title: 'Proud speeches', description: 'Parents, siblings and the graduate herself.', startTime: '14:00', endTime: '15:00', order: 2 },
        { title: 'Photos & celebration', startTime: '15:00', endTime: '16:00', order: 3 },
      ],
      messages: [
        { authorName: 'Prof. Dlamini', message: 'Congratulations Naledi — so proud of your achievement. The profession is lucky to have you!' },
        { authorName: 'Cousin Busi', message: 'You did it! From study sessions to cum laude. Inspiration!' },
      ],
    },
  ];

  for (const demo of demos) {
    const existing = await prisma.event.findUnique({ where: { slug: demo.slug } });
    if (existing) {
      console.log(`Exists: ${demo.slug}`);
      continue;
    }
    await prisma.event.create({
      data: {
        slug: demo.slug,
        organiserId,
        eventType: demo.eventType,
        title: demo.title,
        description: demo.description,
        hostName: demo.hostName,
        startDateTime: demo.start,
        endDateTime: demo.end,
        timezone: 'Africa/Johannesburg',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        theme: demo.theme,
        publishedAt: new Date(),
        locations: { create: [{ ...demo.location, order: 0 }] },
        agenda: { create: demo.agenda },
        messages: { create: demo.messages.map((m) => ({ ...m, approved: true })) },
      },
    });
    console.log(`Seeded: ${demo.slug}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
