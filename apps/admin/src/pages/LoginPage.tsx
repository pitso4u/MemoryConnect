import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';

function isFamilyRole(role?: string) {
  return role === 'FAMILY_MANAGER' || role === 'FAMILY_CONTRIBUTOR';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(email, password);
      login(data.accessToken, data.user);
      navigate(data.user.role === 'SUPER_ADMIN' ? '/admin-owner' : isFamilyRole(data.user.role) ? '/family' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex brand-surface">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden bg-[var(--brand-primary)]">
        {brand.loginBackgroundUrl && <div className="absolute inset-0 bg-cover bg-center opacity-35" style={{ backgroundImage: `url(${brand.loginBackgroundUrl})` }} />}
        <div className="relative text-center px-12">
          {brand.logoUrl && <img src={brand.logoUrl} alt={`${brand.companyName} logo`} className="mx-auto mb-6 max-h-20 max-w-72 object-contain" />}
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
            <h1 className="font-display text-3xl text-ink">{brand.tradingName || brand.companyName}</h1>
          </div>

          <h2 className="font-display text-2xl text-ink mb-1">Welcome back</h2>
          <p className="text-muted mb-8">Sign in to your funeral home portal</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-parchment-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-parchment-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
            className="brand-button w-full py-3 font-medium transition disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            New funeral home?{' '}
            <Link to="/register" className="text-gold-dark hover:text-gold font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
