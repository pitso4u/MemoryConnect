import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MemorialPage from '../pages/MemorialPage';

describe('MemorialPage', () => {
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
