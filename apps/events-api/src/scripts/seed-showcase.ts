import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { ensureEventUploadsDir, eventPhotoPublicUrl } from '../lib/uploads';

// Showcase seed: the three example events linked from the landing page.
// Run: npm run seed:showcase -w @memorialconnect/events-api
// Idempotent (upsert by slug): safe to run repeatedly in dev AND prod.
// NEVER run the dev seed (seed.ts) in production — it is not idempotent-safe
// for prod and creates demo credentials. This script is the only seed that
// may run against production. Requires EVENTS_SHOWCASE_PASSWORD in the env.

const SHOWCASE_EMAIL = 'showcase@events.local';

interface ShowcasePhoto {
  file: string;
  caption: string;
  label: string;
  from: string;
  to: string;
  accent: string;
}

interface ShowcaseEvent {
  slug: string;
  eventType: string;
  title: string;
  description: string;
  hostName: string;
  start: string;
  end: string;
  theme: string;
  locations: { name: string; address: string; notes: string }[];
  agenda: { title: string; description?: string; startTime?: string; endTime?: string; location?: string }[];
  messages: { authorName: string; message: string }[];
  photos: ShowcasePhoto[];
}

const SHOWCASE_EVENTS: ShowcaseEvent[] = [
  {
    slug: 'sarah-john-wedding-demo',
    eventType: 'WEDDING',
    title: "Sarah & John's Wedding",
    description: [
      'It started with a shared taxi route and a borrowed umbrella — five years later, we are getting married and we want you there.',
      '',
      'Join us for an outdoor ceremony on the lawn, followed by dinner, speeches and dancing under the Joburg sky. Dress code: garden formal.',
    ].join('\n'),
    hostName: 'Sarah & John',
    start: '2026-11-21T11:00:00+02:00',
    end: '2026-11-21T22:00:00+02:00',
    theme: 'ELEGANT',
    locations: [
      {
        name: 'Johannesburg Country Club',
        address: 'Auckland Park, Johannesburg',
        notes: 'Ceremony on the lawn at 11:00 sharp. Free parking at the main gate; shuttles run every 20 minutes.',
      },
      {
        name: 'The Club Hall — Reception',
        address: 'Auckland Park, Johannesburg',
        notes: 'Reception follows in the hall from 14:00. Find your table number at the entrance.',
      },
    ],
    agenda: [
      { title: 'Guests arrive & welcome drinks', description: 'Find your seat on the lawn and enjoy a cold drink.', startTime: '10:00', endTime: '10:45' },
      { title: 'Wedding ceremony', description: 'Officiated by Rev. Maseko.', startTime: '11:00', endTime: '12:00', location: 'Main lawn' },
      { title: 'Family photos', description: 'Bridal party and family portraits in the gardens.', startTime: '12:30', endTime: '13:30' },
      { title: 'Reception & dinner', description: 'Three-course dinner, speeches and the first dance.', startTime: '14:00', endTime: '20:00', location: 'Club hall' },
      { title: 'Celebration & send-off', description: 'Dancing, dessert table and sparkler send-off.', startTime: '20:00', endTime: '22:00' },
    ],
    messages: [
      { authorName: 'Aunt Maria', message: 'So happy for you both! I have watched this love story from the front row — cannot wait to celebrate with you.' },
      { authorName: 'Sipho & Ayanda', message: 'Congratulations! Wishing you a lifetime of laughter, patience and Sunday morning pancakes.' },
      { authorName: 'Gogo Dlamini', message: 'My grandchildren are getting married! I am counting the days.' },
      { authorName: 'Priya', message: 'The most beautiful couple. See you on the dance floor!' },
    ],
    photos: [
      { file: 'showcase-wedding-1.svg', caption: 'The venue gardens', label: 'S & J', from: '#fecdd3', to: '#fb7185', accent: '#881337' },
      { file: 'showcase-wedding-2.svg', caption: 'Ceremony on the lawn', label: 'Lawn', from: '#fde68a', to: '#f59e0b', accent: '#92400e' },
      { file: 'showcase-wedding-3.svg', caption: 'Golden hour portraits', label: 'Love', from: '#ddd6fe', to: '#8b5cf6', accent: '#5b21b6' },
      { file: 'showcase-wedding-4.svg', caption: 'Reception details', label: 'Dinner', from: '#bae6fd', to: '#0284c7', accent: '#0c4a6e' },
      { file: 'showcase-wedding-5.svg', caption: 'First dance', label: 'Dance', from: '#fbcfe8', to: '#db2777', accent: '#831843' },
    ],
  },
  {
    slug: 'thabo-50th-birthday-demo',
    eventType: 'BIRTHDAY',
    title: "Thabo's 50th Birthday",
    description: [
      'Fifty years of stories, questionable dance moves and legendary braais — and Thabo is just getting started.',
      '',
      'Join us for a night of great food, live music and a few surprises. Dress code: gold and black. No gifts — your presence is the present.',
    ].join('\n'),
    hostName: 'Thabo',
    start: '2026-10-10T18:00:00+02:00',
    end: '2026-10-10T23:00:00+02:00',
    theme: 'CELEBRATION',
    locations: [
      {
        name: 'The Venue, Sandton',
        address: 'Sandton, Johannesburg',
        notes: 'Doors open at 17:30. Secure parking in the basement; entrance on the corner.',
      },
    ],
    agenda: [
      { title: 'Welcome drinks & canapés', startTime: '18:00', endTime: '19:00' },
      { title: 'Birthday dinner', description: 'Cape Malay curry buffet with vegetarian options.', startTime: '19:00', endTime: '20:30' },
      { title: 'Speeches, roast & cake', description: 'Friends and family take the mic — keep it kind!', startTime: '20:30', endTime: '21:30' },
      { title: 'Live music set', description: 'Amahubo Band on stage.', startTime: '21:30', endTime: '22:15' },
      { title: 'Dance floor with DJ Tumi', startTime: '22:15', endTime: '23:00' },
    ],
    messages: [
      { authorName: 'Lerato', message: 'Happy 50th! Half a century of being legendary. Save me a dance!' },
      { authorName: 'The Mokoena Family', message: 'To fifty more years of laughter. We love you, Thabo!' },
      { authorName: 'Bra J', message: 'Fifty looks good on you, my friend. The braai will never be the same without your secret spice.' },
    ],
    photos: [
      { file: 'showcase-birthday-1.svg', caption: 'Gold and black setup', label: '50', from: '#fde68a', to: '#d97706', accent: '#451a03' },
      { file: 'showcase-birthday-2.svg', caption: 'The birthday table', label: 'Cake', from: '#fef3c7', to: '#f59e0b', accent: '#92400e' },
      { file: 'showcase-birthday-3.svg', caption: 'Dance floor', label: 'Party', from: '#ddd6fe', to: '#7c3aed', accent: '#4c1d95' },
      { file: 'showcase-birthday-4.svg', caption: 'Family toast', label: 'Cheers', from: '#fecdd3', to: '#e11d48', accent: '#881337' },
    ],
  },
  {
    slug: 'naledi-graduation-demo',
    eventType: 'GRADUATION',
    title: "Naledi's Graduation Celebration",
    description: [
      'After four years of early mornings, late nights and endless resits, Naledi has graduated with a BCom in Accounting — cum laude!',
      '',
      'Join the family for a celebratory lunch, a few proud speeches and plenty of photos in the garden.',
    ].join('\n'),
    hostName: 'Naledi — Class of 2026',
    start: '2026-12-05T12:00:00+02:00',
    end: '2026-12-05T16:00:00+02:00',
    theme: 'MODERN',
    locations: [
      {
        name: 'Family Home, Pretoria',
        address: 'Pretoria East',
        notes: 'Parking on the street; the marquee is in the back garden. Bring a chair if you can.',
      },
    ],
    agenda: [
      { title: 'Arrival & congratulations', startTime: '12:00', endTime: '12:30' },
      { title: 'Celebration lunch', description: 'Spitbraai, salads and Malva pudding.', startTime: '12:30', endTime: '14:00' },
      { title: 'Proud speeches', description: 'Parents, siblings and the graduate herself.', startTime: '14:00', endTime: '15:00' },
      { title: 'Cap toss & group photos', startTime: '15:00', endTime: '15:30' },
      { title: 'Dessert & celebration', startTime: '15:30', endTime: '16:00' },
    ],
    messages: [
      { authorName: 'Prof. Dlamini', message: 'Congratulations Naledi — so proud of your achievement. The profession is lucky to have you!' },
      { authorName: 'Cousin Busi', message: 'You did it! From study sessions to cum laude. Inspiration!' },
      { authorName: 'Tebogo', message: 'Hard work pays off. Celebrating you today and always!' },
    ],
    photos: [
      { file: 'showcase-graduation-1.svg', caption: 'The graduate', label: '2026', from: '#bae6fd', to: '#0369a1', accent: '#082f49' },
      { file: 'showcase-graduation-2.svg', caption: 'Family lunch setup', label: 'Lunch', from: '#e0f2fe', to: '#0284c7', accent: '#0c4a6e' },
      { file: 'showcase-graduation-3.svg', caption: 'Garden marquee', label: 'Garden', from: '#ddd6fe', to: '#4c5fd5', accent: '#312e81' },
      { file: 'showcase-graduation-4.svg', caption: 'Proud moment', label: 'Proud', from: '#fef3c7', to: '#d97706', accent: '#451a03' },
      { file: 'showcase-graduation-5.svg', caption: 'Class of 2026', label: 'Class', from: '#fbcfe8', to: '#9d174d', accent: '#500724' },
    ],
  },
];

function svgPhoto(label: string, from: string, to: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>`
    + `</linearGradient></defs>`
    + `<rect width="800" height="600" fill="url(#g)"/>`
    + `<circle cx="640" cy="110" r="150" fill="#ffffff" opacity="0.18"/>`
    + `<circle cx="120" cy="500" r="110" fill="#ffffff" opacity="0.14"/>`
    + `<circle cx="400" cy="300" r="120" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.5"/>`
    + `<text x="400" y="325" text-anchor="middle" font-family="Georgia, serif" font-size="72" font-weight="bold" fill="${accent}" opacity="0.9">${label}</text>`
    + `</svg>`;
}

function resolvePassword(explicit?: string): string {
  const password = explicit ?? process.env.EVENTS_SHOWCASE_PASSWORD;
  if (!password) {
    throw new Error(
      'EVENTS_SHOWCASE_PASSWORD is required (set it in apps/events-api/.env for dev, or in the VM env for production). It is never committed to Git.',
    );
  }
  return password;
}

export async function seedShowcase(explicitPassword?: string): Promise<void> {
  const password = resolvePassword(explicitPassword);

  let organiser = await prisma.organiser.findUnique({ where: { email: SHOWCASE_EMAIL } });
  if (!organiser) {
    organiser = await prisma.organiser.create({
      data: {
        name: 'MemoryConnect Showcase',
        email: SHOWCASE_EMAIL,
        users: {
          create: { name: 'Showcase', email: SHOWCASE_EMAIL, passwordHash: await bcrypt.hash(password, 12) },
        },
      },
    });
    console.log('Showcase organiser created.');
  }

  for (const spec of SHOWCASE_EVENTS) {
    const scalars = {
      organiserId: organiser.id,
      eventType: spec.eventType,
      title: spec.title,
      description: spec.description,
      hostName: spec.hostName,
      startDateTime: new Date(spec.start),
      endDateTime: new Date(spec.end),
      timezone: 'Africa/Johannesburg',
      status: 'PUBLISHED',
      visibility: 'UNLISTED',
      theme: spec.theme,
      isDemo: true,
      expiresAt: null as Date | null,
      publishedAt: new Date(),
    };
    const existing = await prisma.event.findUnique({ where: { slug: spec.slug } });
    const event = existing
      ? await prisma.event.update({ where: { slug: spec.slug }, data: { ...scalars, publishedAt: existing.publishedAt ?? new Date() } })
      : await prisma.event.create({ data: { slug: spec.slug, ...scalars } });

    // Replace children so reruns converge to exactly this content.
    await prisma.eventMessage.deleteMany({ where: { eventId: event.id } });
    await prisma.eventPhoto.deleteMany({ where: { eventId: event.id } });
    await prisma.eventLocation.deleteMany({ where: { eventId: event.id } });
    await prisma.eventAgendaItem.deleteMany({ where: { eventId: event.id } });

    const dir = ensureEventUploadsDir(event.id);
    const photoRows = spec.photos.map((p, i) => {
      fs.writeFileSync(path.join(dir, p.file), svgPhoto(p.label, p.from, p.to, p.accent));
      return {
        eventId: event.id,
        url: eventPhotoPublicUrl(event.id, p.file),
        caption: p.caption,
        order: i,
      };
    });

    await prisma.eventLocation.createMany({
      data: spec.locations.map((l, i) => ({ eventId: event.id, ...l, order: i })),
    });
    await prisma.eventAgendaItem.createMany({
      data: spec.agenda.map((a, i) => ({ eventId: event.id, ...a, order: i })),
    });
    await prisma.eventMessage.createMany({
      data: spec.messages.map((m) => ({ eventId: event.id, ...m, approved: true })),
    });
    await prisma.eventPhoto.createMany({ data: photoRows });

    console.log(`Showcase ready: ${spec.slug}`);
  }
}

async function main() {
  await seedShowcase();
}

// Only auto-run as a CLI script, never on import (tests import seedShowcase).
if (!process.env.VITEST) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
