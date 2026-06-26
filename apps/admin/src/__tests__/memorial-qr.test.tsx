import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MemorialQrCode from '../components/MemorialQrCode';

describe('MemorialQrCode', () => {
  const mockProps = {
    slug: 'john-doe-2024',
    deceasedName: 'John Doe',
    demoNetworkUrl: 'http://192.168.1.100:5174',
    onSaveDemoUrl: async () => {},
  };

  it('renders QR code section', () => {
    render(<MemorialQrCode {...mockProps} />);
    expect(screen.getByText('QR Code')).toBeInTheDocument();
    expect(screen.getByText(/Guests scan this code/)).toBeInTheDocument();
  });

  it('renders demo network URL input', () => {
    render(<MemorialQrCode {...mockProps} />);
    expect(screen.getByText('Demo Network URL')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. http/)).toBeInTheDocument();
  });

  it('renders copy and download buttons', () => {
    render(<MemorialQrCode {...mockProps} />);
    expect(screen.getByRole('button', { name: /Copy link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download QR/i })).toBeInTheDocument();
  });

  it('displays memorial link with demo URL', () => {
    render(<MemorialQrCode {...mockProps} />);
    const link = screen.getByText(/http:\/\/192\.168\.1\.100:5174/);
    expect(link).toBeInTheDocument();
  });
});
