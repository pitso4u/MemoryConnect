import { describe, expect, it } from 'vitest';
import { createMemorialLocationSchema } from '@memorialconnect/shared';

describe('Memorial location validation', () => {
  const validLocation = {
    type: 'HOME' as const,
    name: 'Family Home',
    latitude: -26.204103,
    longitude: 28.047305,
  };

  it('accepts an exact GPS pin', () => {
    expect(createMemorialLocationSchema.parse(validLocation)).toMatchObject(validLocation);
  });

  it('requires both coordinates', () => {
    const result = createMemorialLocationSchema.safeParse({ ...validLocation, latitude: undefined });
    expect(result.success).toBe(false);
  });

  it('rejects coordinates outside valid ranges', () => {
    expect(createMemorialLocationSchema.safeParse({ ...validLocation, latitude: -91 }).success).toBe(false);
    expect(createMemorialLocationSchema.safeParse({ ...validLocation, longitude: 181 }).success).toBe(false);
  });
});
