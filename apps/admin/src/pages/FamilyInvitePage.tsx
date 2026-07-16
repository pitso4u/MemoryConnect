import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, FamilyInvitePreview } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function FamilyInvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<FamilyInvitePreview | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getFamilyInvite(token)
      .then((data) => {
        setInvite(data);
        setName(data.name);
        setEmail(data.email || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Invitation could not be loaded'))
      .finally(() => setLoading(false));
  }, [token]);

  const acceptInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await api.acceptFamilyInvite(token, { name, email, password: password || undefined });
      login(data.accessToken, data.user);
      navigate('/family');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen grid place-items-center text-muted">Loading invitation...</div>;

  return (
    <div className="min-h-screen bg-parchment px-6 py-12">
      <main className="mx-auto max-w-md rounded-xl border border-parchment-dark bg-white p-6 shadow-sm">
        <h1 className="font-display text-3xl text-ink">Family invitation</h1>
        {invite && (
          <p className="mt-2 text-sm text-muted">
            {invite.funeralHome.name} invited you to contribute to {invite.memorial.deceasedName}.
          </p>
        )}
        {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {invite && (
          <form onSubmit={acceptInvite} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-parchment-dark px-4 py-2.5 outline-none focus:border-gold" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-lg border border-parchment-dark px-4 py-2.5 outline-none focus:border-gold" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} placeholder="Only required for a new account" className="w-full rounded-lg border border-parchment-dark px-4 py-2.5 outline-none focus:border-gold" />
            </label>
            <button disabled={submitting} className="w-full rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-parchment disabled:opacity-50">
              {submitting ? 'Accepting...' : 'Accept invitation'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
