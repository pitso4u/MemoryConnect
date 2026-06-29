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
    expect(screen.getByText('R499.99')).toBeInTheDocument();
    expect(screen.getByText('R999.99')).toBeInTheDocument();
    expect(screen.getByText('R1999.99')).toBeInTheDocument();
    expect(screen.getByText('5 funerals/memorials per month')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Demo Memorial' })).toHaveAttribute('href', '/msjevkt1');
  });
});
