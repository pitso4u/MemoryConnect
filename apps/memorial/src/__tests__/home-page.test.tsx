import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';

describe('HomePage', () => {
  it('presents the funeral home offer and demo memorial', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Memory Connect' })).toBeInTheDocument();
    expect(screen.getByText('R499')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Demo Memorial' })).toHaveAttribute('href', '/msjevkt1');
  });
});
