import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocationManager } from '../components/memorial/LocationManager';
import type { MemorialLocation } from '../lib/api';

describe('LocationManager', () => {
  it('offers GPS capture and manual coordinate fields for a new location', () => {
    render(<LocationManager memorialId="memorial-1" locations={[]} onChange={vi.fn()} />);

    expect(screen.getByText('Locations & Directions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use my current location' })).toBeInTheDocument();
    expect(screen.getByText('Latitude')).toBeInTheDocument();
    expect(screen.getByText('Longitude')).toBeInTheDocument();
  });

  it('links a saved pin to exact Google Maps directions', () => {
    const location: MemorialLocation = {
      id: 'location-1',
      memorialId: 'memorial-1',
      type: 'CHURCH',
      name: 'St Mary Church',
      addressText: 'Near the community hall',
      latitude: -26.204103,
      longitude: 28.047305,
      notes: 'Use the side entrance',
      orderIndex: 0,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    };

    render(<LocationManager memorialId="memorial-1" locations={[location]} onChange={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Open this pin in Google Maps' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=-26.204103,28.047305',
    );
  });
});
