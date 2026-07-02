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
    expect(screen.getByText('R299.99')).toBeInTheDocument();
    expect(screen.getByText('Publish each funeral for R299.99')).toBeInTheDocument();
    expect(screen.getByText('No monthly fees. No packages. No complicated subscriptions.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Demo Memorial' })).toHaveAttribute('href', '/demo');
  });
});
