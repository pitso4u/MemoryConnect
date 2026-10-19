import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-story"><Link to="/" className="brand-lockup"><img src="/events-connect-mark.png" alt="" /><span>Events <strong>Connect</strong></span></Link><div className="auth-story-copy"><p className="section-kicker">MADE FOR THE MOMENTS THAT MATTER</p><h2>Gather everyone around one beautiful page.</h2><p>Keep the details, photos and heartfelt words together, ready to share with the people you love.</p></div><p className="auth-quote">“The best days are the ones we remember together.”</p></aside>
      <div className="auth-form-side"><form onSubmit={submit} className="auth-form-card space-y-4">
        <p className="section-kicker">YOUR EVENT SPACE</p><h1>Welcome back</h1><p>Sign in to pick up where you left off.</p>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <label className="label">Email<input className="input" type="email" placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="label">Password<input className="input" type="password" placeholder="Your password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="text-sm text-gray-600">New to MemoryConnect Events? <Link to="/register" className="text-amber-800 font-semibold">Create an account</Link></p>
      </form></div>
    </div>
  );
}
