import { describe, it, expect } from 'vitest';
import { createQrPosterCanvas, formatEventDate, formatEventTime } from '../lib/qrPoster';

describe('createQrPosterCanvas', () => {
  it('renders a full A4 canvas with event details', async () => {
    const canvas = await createQrPosterCanvas({
      funeralHomeName: 'Serenity Funeral Services',
      logoUrl: null,
      portraitUrl: null,
      memorialUrl: 'https://memoryconnect.co.za/memorials/mrs-david-mokoena',
      deceasedName: 'Mrs. David Mokoena',
      eventDateLabel: 'Saturday, 1 August 2026',
      eventTime: '09:00 AM',
      eventVenue: 'St Mary Anglican Church, Johannesburg',
      includeEventInfo: true,
    });
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(2480);
    expect(canvas.height).toBe(3508);
  });

  it('renders without event info (portrait fallback placeholder path)', async () => {
    const canvas = await createQrPosterCanvas({
      funeralHomeName: 'Serenity Funeral Services',
      portraitUrl: '/uploads/nonexistent.png',
      memorialUrl: 'https://memoryconnect.co.za/memorials/john-doe',
      includeEventInfo: false,
    });
    expect(canvas.width).toBe(2480);
    expect(canvas.height).toBe(3508);
  });
});

describe('poster date/time formatting', () => {
  it('formats event time with leading-zero hour', () => {
    const result = formatEventTime('2026-08-01T09:05:00.000Z', 'UTC');
    expect(result).toMatch(/09:05/);
  });

  it('formats event date in en-ZA long form', () => {
    const result = formatEventDate('2026-08-01T09:05:00.000Z', 'UTC');
    expect(result).toMatch(/August/);
  });
});
