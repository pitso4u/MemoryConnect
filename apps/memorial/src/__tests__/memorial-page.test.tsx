import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MemorialPage, { getDirectionsUrl } from '../pages/MemorialPage';
import { api, PublicMemorial } from '../lib/api';

describe('MemorialPage', () => {
  it('creates an exact-pin Google Maps directions link', () => {
    expect(getDirectionsUrl(-26.204103, 28.047305)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-26.204103,28.047305',
    );
  });

  it('shows multiple saved location pins in display order', async () => {
    const memorial: PublicMemorial = {
      id: 'memorial-1',
      slug: 'test-slug',
      deceasedName: 'David Mokoena',
      status: 'published',
      programme: [],
      currentProgrammeIndex: 0,
      announcements: [],
      settings: {
        theme: 'elegant',
        showTributeWall: true,
        moderateTributes: true,
        showDonations: false,
      },
      locations: [
        {
          id: 'home', memorialId: 'memorial-1', type: 'HOME', name: 'Family Home',
          latitude: -26.204103, longitude: 28.047305, orderIndex: 0,
          createdAt: '2026-06-29T00:00:00.000Z', updatedAt: '2026-06-29T00:00:00.000Z',
        },
        {
          id: 'church', memorialId: 'memorial-1', type: 'CHURCH', name: 'St Mary Church',
          latitude: -26.205, longitude: 28.048, orderIndex: 1,
          createdAt: '2026-06-29T00:00:00.000Z', updatedAt: '2026-06-29T00:00:00.000Z',
        },
      ],
      photos: [],
      tributes: [],
      funeralHome: { name: 'Mokoena Funerals' },
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    };
    const getMemorial = vi.spyOn(api, 'getMemorial').mockResolvedValue(memorial);

    const view = render(
      <MemoryRouter initialEntries={['/test-slug']}>
        <Routes><Route path="/:slug" element={<MemorialPage />} /></Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Directions' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Directions' }));
    expect(screen.getByRole('heading', { name: 'Family Home' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'St Mary Church' })).toBeInTheDocument();
    const directionLinks = screen.getAllByRole('link', { name: 'Open Directions' });
    expect(directionLinks).toHaveLength(2);
    expect(directionLinks[0]).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=-26.204103,28.047305',
    );

    view.unmount();
    getMemorial.mockRestore();
  });

  it('renders loading state', () => {
    render(
      <MemoryRouter initialEntries={['/test-slug']}>
        <Routes>
          <Route path="/:slug" element={<MemorialPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Loading memorial...')).toBeInTheDocument();
  });
});
