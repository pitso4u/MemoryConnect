import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemorialHeader } from '../components/memorial/MemorialHeader';
import type { MemorialDetail } from '../lib/api';

const memorial = {
  id: 'memorial-1',
  slug: 'vl1dqprg',
  deceasedName: 'Demo Person',
  status: 'PUBLISHED',
  settings: { theme: 'elegant', showTributeWall: true, moderateTributes: true, showDonations: false },
} as MemorialDetail;

describe('MemorialHeader public routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens Preview at the configured memorial app slug route', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<MemoryRouter><MemorialHeader memorial={memorial} saving={false} canDelete={false} onDelete={vi.fn()} onPublish={vi.fn()} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(open).toHaveBeenCalledWith('http://localhost:5174/vl1dqprg', '_blank', 'noopener,noreferrer');
  });

  it('opens Projector at the memorial projector route', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<MemoryRouter><MemorialHeader memorial={memorial} saving={false} canDelete={false} onDelete={vi.fn()} onPublish={vi.fn()} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Projector' }));

    expect(open).toHaveBeenCalledWith('http://localhost:5174/vl1dqprg/projector', '_blank', 'noopener,noreferrer');
  });
});
