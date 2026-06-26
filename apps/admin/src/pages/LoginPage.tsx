import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(email, password);
      login(data.accessToken, data.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-ink items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, var(--color-gold) 0%, transparent 60%)' }}
        />
        <div className="relative text-center px-12">
          <h1 className="font-display text-5xl text-parchment mb-4">MemorialConnect</h1>
          <p className="text-parchment/70 text-lg font-light max-w-md">
            Honour every life with a beautiful digital memorial experience.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <h1 className="font-display text-3xl text-ink">MemorialConnect</h1>
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
              <label className="block text-sm font-medium text-ink mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-parchment-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Password</label>
              <input
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
              className="w-full py-3 bg-ink text-parchment rounded-lg font-medium hover:bg-ink-light transition disabled:opacity-50"
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
