import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import DashboardLayout from '../components/DashboardLayout';
import { AuthProvider } from '../context/AuthContext';

describe('DashboardLayout navigation', () => {
  it('uses a collapsible mobile menu while keeping page content in normal flow', () => {
    const { container } = render(
      <MemoryRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<div>Admin page content</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Admin page content')).toBeInTheDocument();
    expect(container.querySelector('header')).toHaveClass('md:hidden');
    expect(container.querySelector('aside')).toHaveClass('hidden', 'md:flex');

    fireEvent.click(screen.getByRole('button', { name: 'Open admin menu' }));
    expect(screen.getByRole('navigation', { name: 'Mobile admin navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close admin menu' })).toHaveAttribute('aria-expanded', 'true');
  });
});
