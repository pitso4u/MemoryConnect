import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';

export default function RegisterPage() {
  const [form, setForm] = useState({
    funeralHomeName: '',
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { brand } = useBrand();
  const defaultLogo = !brand.whiteLabelEnabled && !brand.logoUrl ? '/brand/memory-connect-logo-horizontal.png' : null;
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.register(form);
      login(data.accessToken, data.user);
      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="brand-surface min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {(brand.logoUrl || defaultLogo) && <img src={brand.logoUrl || defaultLogo || ''} alt={`${brand.companyName} logo`} className="mx-auto mb-4 max-h-14 max-w-48 rounded bg-white/95 p-1.5 object-contain" />}
          <h1 className="font-display text-3xl text-ink">{brand.whiteLabelEnabled ? 'Create your branded portal' : 'Memory Connect'}</h1>
          <p className="text-muted mt-2">Register your funeral home</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {(['funeralHomeName', 'name', 'email', 'password'] as const).map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium text-ink mb-1.5 capitalize">
                {field === 'funeralHomeName' ? 'Funeral Home Name' : field}
              </label>
              <input
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-parchment-dark bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
                required
                minLength={field === 'password' ? 8 : undefined}
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="brand-button w-full py-3 font-medium transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already registered?{' '}
          <Link to="/login" className="text-gold-dark hover:text-gold font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
