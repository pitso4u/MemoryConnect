import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MemorialQrCode from '../components/MemorialQrCode';
import { AuthProvider } from '../context/AuthContext';
import { BrandProvider } from '../context/BrandContext';

describe('MemorialQrCode', () => {
  const mockProps = {
    slug: 'john-doe-2024',
    deceasedName: 'John Doe',
    demoNetworkUrl: 'http://192.168.1.100:5174',
    onSaveDemoUrl: async () => {},
  };

  function renderQr() {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <BrandProvider>
            <MemorialQrCode {...mockProps} />
          </BrandProvider>
        </AuthProvider>
      </BrowserRouter>,
    );
  }

  it('renders QR code section', () => {
    renderQr();
    expect(screen.getByText('QR Code')).toBeInTheDocument();
    expect(screen.getByText(/Guests scan this code/)).toBeInTheDocument();
  });

  it('renders demo network URL input', () => {
    renderQr();
    expect(screen.getByText('Demo Network URL')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. http/)).toBeInTheDocument();
  });

  it('renders copy and download buttons', () => {
    renderQr();
    expect(screen.getByRole('button', { name: /Copy link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Download QR$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download QR Poster/i })).toBeInTheDocument();
  });

  it('displays memorial link with demo URL', () => {
    renderQr();
    const link = screen.getByText(/http:\/\/192\.168\.1\.100:5174/);
    expect(link).toBeInTheDocument();
  });
});
