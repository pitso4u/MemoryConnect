import { FormEvent, useEffect, useState } from 'react';
import { Building2, Check, Palette, Users } from 'lucide-react';
import { api, FuneralHomeProfile } from '../lib/api';

export default function ProfilePage() {
  const [profile, setProfile] = useState<FuneralHomeProfile | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => { api.getFuneralHomeProfile().then(setProfile); }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    const updated = await api.updateFuneralHomeProfile(profile);
    setProfile({ ...profile, ...updated });
    setMessage('Profile saved');
  };

  if (!profile) return <div className="p-8 text-muted">Loading profile...</div>;
  const field = (key: keyof FuneralHomeProfile, label: string, type = 'text', placeholder = '') => (
    <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span><input type={type} value={String(profile[key] || (type === 'color' ? '#c9a84c' : ''))} placeholder={placeholder} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} className="w-full rounded-lg border border-parchment-dark px-3 py-2.5 text-sm outline-none focus:border-gold" /></label>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8"><form onSubmit={save} className="mx-auto max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-dark">Funeral home</p>
      <h1 className="mt-3 font-display text-4xl text-ink">Profile & branding</h1>
      <p className="mt-2 text-muted">Your details and colours appear on every public funeral page. They never change the R299.99 publishing price.</p>
      <section className="mt-8 rounded-2xl border border-parchment-dark bg-white p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink"><Building2 size={20} /> Business details</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">{field('name', 'Business name')}{field('phone', 'Contact number')}{field('email', 'Business email', 'email')}{field('address', 'Address')}{field('logoUrl', 'Logo URL', 'url')}{field('websiteUrl', 'Website', 'url', 'https://')}{field('facebookUrl', 'Facebook page', 'url', 'https://')}</div>
      </section>
      <section className="mt-5 rounded-2xl border border-parchment-dark bg-white p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink"><Palette size={20} /> Brand colours</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">{field('primaryColor', 'Primary colour', 'color')}{field('secondaryColor', 'Secondary colour', 'color')}</div>
      </section>
      <section className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-parchment-dark bg-white p-6"><h2 className="flex items-center gap-2 font-display text-xl"><Building2 size={18} /> Branches</h2><p className="mt-3 text-sm text-muted">{profile.branches.length ? profile.branches.map((branch) => branch.name).join(', ') : 'No optional branches configured.'}</p></div>
        <div className="rounded-2xl border border-parchment-dark bg-white p-6"><h2 className="flex items-center gap-2 font-display text-xl"><Users size={18} /> Staff users</h2><p className="mt-3 text-sm text-muted">{profile.users.length} user{profile.users.length === 1 ? '' : 's'} can access this funeral home.</p></div>
      </section>
      <section className="mt-5 rounded-2xl border border-parchment-dark bg-white p-6">
        <h2 className="font-display text-xl text-ink">Account access</h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <p className="rounded-lg bg-parchment p-3">Analytics: <strong>{profile.analyticsAccessEnabled ? 'Enabled' : 'Disabled'}</strong></p>
          <p className="rounded-lg bg-parchment p-3">API access: <strong>{profile.apiAccessEnabled ? 'Enabled' : 'Disabled'}</strong></p>
          <p className="rounded-lg bg-parchment p-3">Dedicated support: <strong>{profile.dedicatedSupportEnabled ? 'Enabled' : 'Standard support'}</strong></p>
        </div>
        <p className="mt-3 text-xs text-muted">These capabilities never change the R299.99 publishing price.</p>
      </section>
      <div className="mt-6 flex items-center gap-4"><button className="rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-parchment">Save profile</button>{message && <span className="flex items-center gap-1.5 text-sm text-emerald-700"><Check size={15} />{message}</span>}</div>
    </form></div>
  );
}
