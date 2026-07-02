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
    deceasedPhotoUrl: memorial.deceasedPhotoUrl,
    obituary: memorial.obituary,
    biography: memorial.biography,
    programme: memorial.programme,
    currentProgrammeIndex: memorial.currentProgrammeIndex,
    announcements: memorial.announcements,
    settings: memorial.settings,
    status: memorial.status,
    paymentStatus: memorial.paymentStatus,
    paymentId: memorial.paymentId,
    publishedAt: memorial.publishedAt ? (memorial.publishedAt as Date).toISOString() : undefined,
    editLocksAt: memorial.editLocksAt ? (memorial.editLocksAt as Date).toISOString() : undefined,
    publicExpiresAt: memorial.publicExpiresAt ? (memorial.publicExpiresAt as Date).toISOString() : undefined,
    deleteAfter: memorial.deleteAfter ? (memorial.deleteAfter as Date).toISOString() : undefined,
    deletedAt: memorial.deletedAt ? (memorial.deletedAt as Date).toISOString() : undefined,
    viewCount: memorial.viewCount,
    storageBytes: memorial.storageBytes,
    createdAt: (memorial.createdAt as Date).toISOString(),
    updatedAt: (memorial.updatedAt as Date).toISOString(),
  };
}
