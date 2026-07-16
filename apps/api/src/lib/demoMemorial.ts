import { brandFromFuneralHome } from '@memorialconnect/shared';
import { MEMORIAL_STATUS, PAYMENT_STATUS } from './publishing';

export const DEMO_SLUG = 'demo';
export const DEMO_MEMORIAL_ID = 'memory-connect-demo';
export const DEMO_FUNERAL_HOME_EMAIL = 'demo@memoryconnect.co.za';
export const DEMO_FUNERAL_HOME_NAME = 'Ubuntu Legacy Funeral Care';
export const DEMO_PUBLISHED_AT = '2026-07-12T08:00:00.000Z';

export const demoProgramme = [
  { id: 'demo-programme-01', type: 'opening_prayer', title: 'Processional and Seating of the Family', speaker: 'Ubuntu Legacy Funeral Care Team', duration: 8, order: 0 },
  { id: 'demo-programme-02', type: 'opening_prayer', title: 'Opening Prayer', speaker: 'Rev. Thabo Mokoena', duration: 5, order: 1 },
  { id: 'demo-programme-03', type: 'speaker', title: 'Welcome and Introductions', speaker: 'Ms. Naledi Khumalo, Programme Director', duration: 6, order: 2 },
  { id: 'demo-programme-04', type: 'scripture', title: 'Scripture Reading: Psalm 23', speaker: 'Grandchild: Lethabo Maseko', duration: 4, order: 3 },
  { id: 'demo-programme-05', type: 'hymn', title: 'Hymn: Amazing Grace', speaker: 'Community Choir', duration: 5, order: 4 },
  { id: 'demo-programme-06', type: 'speaker', title: 'Reading of the Obituary', speaker: 'Mrs. Palesa Maseko', duration: 10, order: 5 },
  { id: 'demo-programme-07', type: 'family_tribute', title: 'Tribute from the Spouse', speaker: 'Mr. Daniel Maseko', duration: 7, order: 6 },
  { id: 'demo-programme-08', type: 'family_tribute', title: 'Tribute from the Children', speaker: 'Thandi, Kabelo and Lerato', duration: 9, order: 7 },
  { id: 'demo-programme-09', type: 'family_tribute', title: 'Tribute from the Grandchildren', speaker: 'Amohelang Maseko', duration: 5, order: 8 },
  { id: 'demo-programme-10', type: 'speaker', title: 'Tribute from Friends', speaker: 'Mrs. Dineo Nkosi', duration: 6, order: 9 },
  { id: 'demo-programme-11', type: 'speaker', title: 'Workplace Tribute', speaker: 'Mr. Sipho Dlamini', duration: 6, order: 10 },
  { id: 'demo-programme-12', type: 'hymn', title: 'Musical Item: Ke Na Le Modisa', speaker: 'Grace Notes Ensemble', duration: 5, order: 11 },
  { id: 'demo-programme-13', type: 'speaker', title: 'Sermon and Words of Comfort', speaker: 'Rev. Thabo Mokoena', duration: 18, order: 12 },
  { id: 'demo-programme-14', type: 'speaker', title: 'Acknowledgements', speaker: 'Family Representative', duration: 5, order: 13 },
  { id: 'demo-programme-15', type: 'speaker', title: 'Vote of Thanks', speaker: 'Mr. Kabelo Maseko', duration: 4, order: 14 },
  { id: 'demo-programme-16', type: 'speaker', title: 'Notices and Directions', speaker: 'Funeral Director: Ms. Lerato Ndlovu', duration: 4, order: 15 },
  { id: 'demo-programme-17', type: 'closing_prayer', title: 'Closing Prayer', speaker: 'Pastor Miriam Phiri', duration: 4, order: 16 },
  { id: 'demo-programme-18', type: 'burial', title: 'Recessional and Proceeding to Cemetery', speaker: 'Ubuntu Legacy Funeral Care Team', duration: 12, order: 17 },
];

export const demoBiography = {
  sections: [
    {
      heading: 'Childhood and Family Roots',
      body: 'Mme Nomvula Grace Maseko was born in the Free State in the winter of 1954, the second child in a home where faith, discipline and neighbourly care were part of daily life. She grew up surrounded by cousins, aunties and grandparents who taught her to greet every person with respect and to make room at the table for anyone who arrived hungry.',
    },
    {
      heading: 'Education and Working Life',
      body: 'She loved reading from a young age and carried that love into her studies. After completing school, she trained in administration and later became a steady presence in a busy community clinic office. Colleagues remember her as the person who knew every file, every family name and every gentle way to calm someone who was anxious.',
    },
    {
      heading: 'Marriage and Home',
      body: 'Nomvula and Daniel built a home marked by laughter, Sunday meals and open doors. Their children remember school shoes polished before sunrise, prayers whispered at night, and a mother who could correct with firmness while still making each child feel chosen and loved.',
    },
    {
      heading: 'Character and Values',
      body: 'Her life was shaped by service. She believed that dignity was shown in small acts: arriving on time, visiting the sick, writing things down, keeping promises and speaking carefully when emotions were high. She had a quiet humour and a strength that made other people feel safe.',
    },
    {
      heading: 'Faith and Community',
      body: 'At church she served in the women’s fellowship, helped prepare meals after services and mentored younger women who were finding their own way. She did not seek attention, but her absence will be felt in every place where she used to stand with folded hands and a ready smile.',
    },
    {
      heading: 'Family Legacy',
      body: 'Nomvula leaves a legacy of tenderness, order and courage. Her family gives thanks for a mother, wife, sister, grandmother and friend whose love was practical, faithful and enduring. May her memory continue to gather the family in kindness.',
    },
  ],
  timeline: [
    { id: 'demo-timeline-1954', year: '1954', title: 'Born in the Free State', description: 'Welcomed into a close family rooted in faith and community.' },
    { id: 'demo-timeline-1978', year: '1978', title: 'Started community clinic work', description: 'Began a career of practical care and administration.' },
    { id: 'demo-timeline-1981', year: '1981', title: 'Married Daniel Maseko', description: 'Built a warm family home known for Sunday meals and open doors.' },
    { id: 'demo-timeline-2006', year: '2006', title: 'Became a grandmother', description: 'Found new joy in stories, school concerts and gentle guidance.' },
    { id: 'demo-timeline-2026', year: '2026', title: 'Remembered with love', description: 'Honoured by family, friends, colleagues and community members.' },
  ],
};

export const demoObituary = `In Loving Memory of Mme Nomvula Grace Maseko

Mme Nomvula Grace Maseko lived with a rare combination of gentleness and strength. She was a woman of prayer, a careful listener, a patient organiser and a loving anchor to her family. Those who knew her will remember the calm way she entered a room, the kindness in her voice and the practical care she offered without waiting to be asked.

This demonstration memorial shows how Memory Connect can hold the story, programme, photographs, tributes and directions for one funeral in a single respectful link. All personal contact details and locations shown here are sample demonstration information.`;

export const demoAnnouncements = [
  { id: 'demo-announcement-01', message: 'You are viewing a Memory Connect demonstration memorial. Details and locations are sample information.', active: true, createdAt: DEMO_PUBLISHED_AT },
  { id: 'demo-announcement-02', message: 'Guests may follow the programme, view directions, browse photos and read approved tributes from one link.', active: true, createdAt: DEMO_PUBLISHED_AT },
];

export const demoSettings = {
  theme: 'elegant',
  showTributeWall: true,
  moderateTributes: true,
  showDonations: false,
};

export const demoPhotos = [
  ['demo-photo-01.jpg', 'A dignified portrait for the memorial hero.', 'recent'],
  ['demo-photo-02.jpg', 'Family gathered in remembrance and gratitude.', 'family'],
  ['demo-photo-03.jpg', 'A quiet moment from the family album.', 'family'],
  ['demo-photo-04.jpg', 'Loved ones celebrating a life of service.', 'celebrations'],
  ['demo-photo-05.jpg', 'Memories from earlier years.', 'older-photographs'],
  ['demo-photo-06.jpg', 'A warm family occasion.', 'family'],
  ['demo-photo-07.jpg', 'Community and friendship remembered.', 'community'],
  ['demo-photo-08.jpg', 'A treasured recent photograph.', 'recent'],
  ['demo-photo-09.jpg', 'Generations together.', 'family'],
  ['demo-photo-10.jpg', 'A life shared with friends and neighbours.', 'friends'],
  ['demo-photo-11.jpg', 'A celebration of faith and family.', 'celebrations'],
  ['demo-photo-12.jpg', 'A meaningful moment preserved for guests.', 'other'],
  ['demo-photo-13.jpg', 'Family love across the years.', 'family'],
  ['demo-photo-14.jpg', 'Remembered with dignity and tenderness.', 'recent'],
].map(([fileName, caption, category], order) => ({
  id: `demo-photo-${String(order + 1).padStart(2, '0')}`,
  memorialId: DEMO_MEMORIAL_ID,
  url: `/uploads/${DEMO_SLUG}/${fileName}`,
  caption,
  category,
  mediaType: 'PHOTO',
  order,
  storageBytes: 0,
  deletedAt: null,
  createdAt: DEMO_PUBLISHED_AT,
}));

export const demoLocations = [
  {
    id: 'demo-location-home',
    memorialId: DEMO_MEMORIAL_ID,
    type: 'HOME',
    name: 'Family Gathering Point',
    addressText: 'Demonstration address, Johannesburg, Gauteng',
    latitude: -26.2041028,
    longitude: 28.0473051,
    notes: 'Sample family-home meeting point. This is a sanitised public city-centre coordinate, not a private residence.',
    orderIndex: 0,
    createdAt: DEMO_PUBLISHED_AT,
    updatedAt: DEMO_PUBLISHED_AT,
  },
  {
    id: 'demo-location-church',
    memorialId: DEMO_MEMORIAL_ID,
    type: 'CHURCH',
    name: 'Ubuntu Community Chapel',
    addressText: 'Sample Service Venue, Soweto, Gauteng',
    latitude: -26.2477,
    longitude: 27.8585,
    notes: 'Guests are requested to arrive 30 minutes before the service begins.',
    orderIndex: 1,
    createdAt: DEMO_PUBLISHED_AT,
    updatedAt: DEMO_PUBLISHED_AT,
  },
  {
    id: 'demo-location-cemetery',
    memorialId: DEMO_MEMORIAL_ID,
    type: 'CEMETERY',
    name: 'Westpark Cemetery Demonstration Pin',
    addressText: 'Public cemetery area, Johannesburg',
    latitude: -26.1664,
    longitude: 27.9762,
    notes: 'The procession will proceed to the cemetery after the church service.',
    orderIndex: 2,
    createdAt: DEMO_PUBLISHED_AT,
    updatedAt: DEMO_PUBLISHED_AT,
  },
  {
    id: 'demo-location-reception',
    memorialId: DEMO_MEMORIAL_ID,
    type: 'RECEPTION',
    name: 'Community Hall After-tears Venue',
    addressText: 'Sample reception venue, Johannesburg',
    latitude: -26.1952,
    longitude: 28.0341,
    notes: 'Light refreshments will be served after the burial. This is a demonstration venue.',
    orderIndex: 3,
    createdAt: DEMO_PUBLISHED_AT,
    updatedAt: DEMO_PUBLISHED_AT,
  },
];

export const demoTributes = [
  ['Mr. Daniel Maseko, spouse', 'My dearest Nomvula, thank you for building a home where love had a rhythm and prayer had a place. I will miss your voice in the morning and your hand in mine.'],
  ['Thandi Maseko, daughter', 'Mama taught us that care is something you do, not only something you say. Every meal, every school uniform, every late-night prayer told us we were loved.'],
  ['Kabelo Maseko, son', 'She had a way of making responsibility feel like dignity. I carry her lessons into my own home and I hear her wisdom when I need courage.'],
  ['Lerato Maseko, daughter', 'Our mother was gentle, but never weak. She showed us how to stand, how to forgive and how to keep family close even in difficult seasons.'],
  ['Amohelang, grandchild', 'Gogo always remembered the small things. She asked about tests, birthdays and dreams. I will miss her stories and her laugh.'],
  ['Mrs. Palesa Nkosi, sister', 'My sister was a keeper of family history. She knew who needed a phone call, who needed a visit and who needed to be reminded they belonged.'],
  ['Mr. Sipho Dlamini, colleague', 'At the clinic she brought order and humanity together. People trusted her because she treated every file like it belonged to a real family.'],
  ['Mrs. Dineo Nkosi, friend', 'We shared many cups of tea and many prayers. Nomvula listened deeply and answered slowly. Her friendship was a shelter.'],
  ['Women’s Fellowship', 'We honour a faithful servant who prepared, encouraged, visited and prayed. Her seat will be empty, but her example remains with us.'],
  ['Ubuntu Legacy Funeral Care', 'This tribute wall is demonstration content showing how approved messages can be preserved respectfully for guests and family.'],
].map(([authorName, message], index) => ({
  id: `demo-tribute-${String(index + 1).padStart(2, '0')}`,
  memorialId: DEMO_MEMORIAL_ID,
  authorName,
  message,
  approved: true,
  createdAt: new Date(Date.parse(DEMO_PUBLISHED_AT) + index * 60_000).toISOString(),
}));

export const demoFuneralHome = {
  id: 'memory-connect-demo-home',
  name: DEMO_FUNERAL_HOME_NAME,
  tradingName: 'Ubuntu Legacy Funeral Care',
  email: 'care@example.co.za',
  phone: '011 555 0199',
  whatsapp: '+27115550199',
  address: '25 Memorial Avenue, Johannesburg, Gauteng',
  logoUrl: 'https://memoryconnect.co.za/brand/memory-connect-logo-horizontal.png',
  iconUrl: 'https://memoryconnect.co.za/brand/memory-connect-emblem.png',
  primaryColor: '#0b2346',
  secondaryColor: '#f8f4ec',
  accentColor: '#c79a3d',
  backgroundColor: '#101828',
  textColor: '#f8f4ec',
  fontFamily: 'elegant',
  buttonStyle: 'pill',
  cardStyle: 'glass',
  borderRadius: '16px',
  websiteUrl: 'https://memoryconnect.co.za',
  facebookUrl: 'https://facebook.com/memoryconnect',
  instagramUrl: 'https://instagram.com/memoryconnect',
  tiktokUrl: null,
  footerText: 'Demonstration funeral-home branding for Memory Connect.',
  copyrightText: 'Demo content. No private family contact information is displayed.',
  whiteLabelEnabled: false,
  themeTemplate: 'luxury',
  homeBackgroundUrl: null,
  loginBackgroundUrl: null,
  memorialHeroUrl: null,
  projectorBackgroundUrl: null,
  pdfWatermarkUrl: null,
  splashScreenUrl: null,
  memorialStyle: 'rounded',
  animationLevel: 'subtle',
  galleryLayout: 'masonry',
  timelineStyle: 'editorial',
  programmeStyle: 'ceremonial',
};

export const demoMemorialCore = {
  id: DEMO_MEMORIAL_ID,
  slug: DEMO_SLUG,
  deceasedName: 'Mme Nomvula Grace Maseko',
  dateOfBirth: '1954-05-12',
  dateOfDeath: '2026-06-20',
  serviceDate: '2026-07-18T08:00:00.000Z',
  serviceVenue: 'Ubuntu Community Chapel',
  deceasedPhotoUrl: demoPhotos[0].url,
  obituary: demoObituary,
  biography: demoBiography,
  programme: demoProgramme,
  currentProgrammeIndex: 5,
  announcements: demoAnnouncements,
  settings: demoSettings,
  status: MEMORIAL_STATUS.PUBLISHED,
  isDemo: true,
  paymentStatus: PAYMENT_STATUS.SUCCESS,
  paymentId: null,
  publishedAt: DEMO_PUBLISHED_AT,
  editLocksAt: null,
  publicExpiresAt: null,
  deleteAfter: null,
  deletedAt: null,
  videosDeletedAt: null,
  viewCount: 0,
  storageBytes: 0,
  createdAt: DEMO_PUBLISHED_AT,
  updatedAt: DEMO_PUBLISHED_AT,
};

export function demoMemorialSnapshot() {
  return {
    ...demoMemorialCore,
    photos: demoPhotos,
    tributes: demoTributes,
    locations: demoLocations,
    funeralHome: {
      ...demoFuneralHome,
      brand: brandFromFuneralHome(demoFuneralHome),
    },
  };
}
