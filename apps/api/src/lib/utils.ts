import { customAlphabet } from 'nanoid';

const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
const generateSlug = customAlphabet(alphabet, 8);

export function createMemorialSlug(): string {
  return generateSlug();
}

export function formatMemorial(memorial: Record<string, unknown>) {
  return {
    id: memorial.id,
    slug: memorial.slug,
    deceasedName: memorial.deceasedName,
    dateOfBirth: memorial.dateOfBirth
      ? (memorial.dateOfBirth as Date).toISOString().split('T')[0]
      : undefined,
    dateOfDeath: memorial.dateOfDeath
      ? (memorial.dateOfDeath as Date).toISOString().split('T')[0]
      : undefined,
    serviceDate: memorial.serviceDate
      ? (memorial.serviceDate as Date).toISOString()
      : undefined,
    serviceVenue: memorial.serviceVenue,
    coverPhotoUrl: memorial.coverPhotoUrl,
    obituary: memorial.obituary,
    biography: memorial.biography,
    programme: memorial.programme,
    currentProgrammeIndex: memorial.currentProgrammeIndex,
    announcements: memorial.announcements,
    settings: memorial.settings,
    status: memorial.status,
    createdAt: (memorial.createdAt as Date).toISOString(),
    updatedAt: (memorial.updatedAt as Date).toISOString(),
  };
}
