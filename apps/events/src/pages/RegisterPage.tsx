import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [organiserName, setOrganiserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(name.trim(), organiserName.trim(), email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-story"><Link to="/" className="brand-lockup"><img src="/events-connect-mark.png" alt="" /><span>Events <strong>Connect</strong></span></Link><div className="auth-story-copy"><p className="section-kicker">A PAGE THAT FEELS LIKE YOURS</p><h2>Start with a date. Make it a memory.</h2><p>Bring your people together with a page for the plan, the place, the photos and the wishes.</p></div><p className="auth-quote">For weddings, birthdays, graduations and every reason to celebrate.</p></aside>
      <div className="auth-form-side"><form onSubmit={submit} className="auth-form-card space-y-4">
        <p className="section-kicker">A WARM WELCOME</p><h1>Create your account</h1><p>Set up your organiser space and create your first event.</p>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <label className="label">Your name<input className="input" placeholder="e.g. Naledi Mokoena" aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></label>
        <label className="label">Family or organisation<input className="input" placeholder="e.g. The Mokoena family" aria-label="Family or organisation name" value={organiserName} onChange={(e) => setOrganiserName(e.target.value)} required minLength={2} /></label>
        <label className="label">Email<input className="input" type="email" placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="label">Password<input className="input" type="password" placeholder="At least 8 characters" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></label>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="text-sm text-gray-600">Already have an account? <Link to="/login" className="text-amber-800 font-semibold">Log in</Link></p>
      </form></div>
    </div>
  );
}
