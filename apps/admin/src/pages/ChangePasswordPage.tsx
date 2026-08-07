import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';

function isFamilyRole(role?: string) {
  return role === 'FAMILY_MANAGER' || role === 'FAMILY_CONTRIBUTOR';
}

export default function ChangePasswordPage() {
  const { token, completePasswordChange } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const defaultLogo = !brand.whiteLabelEnabled && !brand.logoUrl ? '/brand/memory-connect-logo-horizontal.png' : null;

  if (!token) return <Navigate to="/login" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const data = await api.changePassword(currentPassword, newPassword);
      completePasswordChange(data.accessToken, data.user);
      navigate(data.user.role === 'SUPER_ADMIN' ? '/admin-owner' : isFamilyRole(data.user.role) ? '/family' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex brand-surface">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden bg-[var(--brand-primary)]">
        {brand.loginBackgroundUrl && <div className="absolute inset-0 bg-cover bg-center opacity-35" style={{ backgroundImage: `url(${brand.loginBackgroundUrl})` }} />}
        <div className="relative text-center px-12">
          {(brand.logoUrl || defaultLogo) && <img src={brand.logoUrl || defaultLogo || ''} alt={`${brand.companyName} logo`} className="mx-auto mb-6 max-h-20 max-w-72 rounded bg-white/95 p-2 object-contain" />}
          <h1 className="font-display text-5xl text-[var(--brand-secondary)] mb-4">{brand.tradingName || brand.companyName}</h1>
          <p className="text-[var(--brand-secondary)]/70 text-lg font-light max-w-md">
            Honour every life with a beautiful digital memorial experience.
          </p>
          {!brand.whiteLabelEnabled && <p className="mt-8 text-xs text-[var(--brand-secondary)]/45">Powered by Memory Connect</p>}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            {defaultLogo && <img src={defaultLogo} alt="Memory Connect" className="mx-auto mb-4 h-auto w-52" />}
            <h1 className="font-display text-3xl text-ink">{brand.tradingName || brand.companyName}</h1>
          </div>

          <h2 className="font-display text-2xl text-ink mb-1">Password change required</h2>
          <p className="text-muted mb-8">
            For security you must set a new permanent password. Your temporary password expires after 60 minutes.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-ink mb-1.5">Temporary password</label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-4 py-2.5 rounded-lg border border-parchment-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
                required
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-ink mb-1.5">New password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                className="w-full px-4 py-2.5 rounded-lg border border-parchment-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink mb-1.5">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                className="w-full px-4 py-2.5 rounded-lg border border-parchment-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="brand-button w-full py-3 font-medium transition disabled:opacity-50">
              {loading ? 'Saving...' : 'Set new password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
