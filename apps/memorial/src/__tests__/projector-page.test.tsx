import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ProjectorData } from '../lib/api';
import ProjectorPage, { SLIDESHOW_INTERVAL_MS } from '../pages/ProjectorPage';

const projector: ProjectorData = {
  deceasedName: 'Nomvula Dlamini',
  currentIndex: 0,
  totalItems: 2,
  currentItem: { id: 'programme-1', type: 'speaker', title: 'Words of remembrance', speaker: 'Lerato Dlamini', order: 0 },
  nextItem: { id: 'programme-2', type: 'hymn', title: 'Closing hymn', order: 1 },
  announcements: [],
  photos: [
    { id: 'photo-1', url: '/uploads/one.jpg', caption: 'A joyful day', category: 'family', order: 0 },
    { id: 'photo-2', url: '/uploads/two.jpg', caption: 'Together always', category: 'family', order: 1 },
  ],
};

describe('ProjectorPage photo slideshow', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rotates memorial photos while preserving programme information', async () => {
    vi.useFakeTimers();
    vi.spyOn(api, 'getProjector').mockResolvedValue(projector);

    render(
      <MemoryRouter initialEntries={['/nomvula/projector']}>
        <Routes><Route path="/:slug/projector" element={<ProjectorPage />} /></Routes>
      </MemoryRouter>,
    );

    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole('heading', { name: 'Lerato Dlamini' })).toBeInTheDocument();
    expect(screen.getByAltText('A joyful day')).toHaveAttribute('data-active', 'true');

    await act(async () => { await vi.advanceTimersByTimeAsync(SLIDESHOW_INTERVAL_MS); });

    expect(screen.getByAltText('Together always')).toHaveAttribute('data-active', 'true');
  });
});
