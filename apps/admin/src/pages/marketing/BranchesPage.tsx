import { FormEvent, useEffect, useState } from 'react';
import { Building2, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, MarketingBranch } from '../../lib/api';

export default function BranchesPage() {
  const [branches, setBranches] = useState<MarketingBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [manager, setManager] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [country, setCountry] = useState('');
  const [telephone, setTelephone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [gpsLatitude, setGpsLatitude] = useState('');
  const [gpsLongitude, setGpsLongitude] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      setBranches(await api.getMarketingBranches());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setName(''); setManager(''); setAddress(''); setCity(''); setProvince(''); setCountry('');
    setTelephone(''); setWhatsapp(''); setEmail(''); setGpsLatitude(''); setGpsLongitude('');
    setBusinessHours(''); setGoogleMapsUrl('');
    setEditorOpen(true); setError('');
  };

  const openEdit = (b: MarketingBranch) => {
    setEditingId(b.id);
    setName(b.name); setManager(b.manager || ''); setAddress(b.address || '');
    setCity(b.city || ''); setProvince(b.province || ''); setCountry(b.country || '');
    setTelephone(b.phone || ''); setWhatsapp(b.whatsapp || ''); setEmail(b.email || '');
    setGpsLatitude(b.latitude?.toString() || ''); setGpsLongitude(b.longitude?.toString() || '');
    setBusinessHours(b.businessHours || ''); setGoogleMapsUrl(b.googleMapsUrl || '');
    setEditorOpen(true); setError('');
  };

  const closeEditor = () => { setEditorOpen(false); setEditingId(null); };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setError('Branch name is required'); return; }
    setSaving(true); setError('');
    try {
      const data: Record<string, unknown> = {
        name: name.trim(),
      };
      if (manager) data.manager = manager;
      if (address) data.address = address;
      if (city) data.city = city;
      if (province) data.province = province;
      if (country) data.country = country;
      if (telephone) data.phone = telephone;
      if (whatsapp) data.whatsapp = whatsapp;
      if (email) data.email = email;
      if (gpsLatitude) data.latitude = parseFloat(gpsLatitude);
      if (gpsLongitude) data.longitude = parseFloat(gpsLongitude);
      if (businessHours) data.businessHours = businessHours;
      if (googleMapsUrl) data.googleMapsUrl = googleMapsUrl;

      if (editingId) {
        const updated = await api.updateMarketingBranch(editingId, data);
        setBranches((prev) => prev.map((b) => (b.id === editingId ? updated : b)));
        setMessage('Branch updated');
        closeEditor();
      } else {
        await api.createMarketingBranch(data);
        setMessage('Branch created');
        closeEditor();
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this branch?')) return;
    try {
      await api.deleteMarketingBranch(id);
      setBranches((prev) => prev.filter((b) => b.id !== id));
      setMessage('Branch deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (loading) return <div className="p-8 text-muted">Loading branches...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Marketing Hub</p>
            <h1 className="mt-3 font-display text-4xl text-ink">Branches</h1>
          </div>
          {!editorOpen && (
            <button onClick={openNew} className="brand-button flex items-center gap-2 px-5 py-3 text-sm font-semibold">
              <Plus size={16} /> Add Branch
            </button>
          )}
        </div>

        {error && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="mt-6 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><Check size={15} />{message}</div>}

        {editorOpen && (
          <form onSubmit={handleSave} className="mt-6 rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="font-display text-xl text-ink">{editingId ? 'Edit Branch' : 'New Branch'}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Branch Name *</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Manager</span><input value={manager} onChange={(e) => setManager(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Address</span><input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">City</span><input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Province</span><input value={province} onChange={(e) => setProvince(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Country</span><input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Telephone</span><input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">WhatsApp</span><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Email</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">GPS Latitude</span><input value={gpsLatitude} onChange={(e) => setGpsLatitude(e.target.value)} type="number" step="any" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">GPS Longitude</span><input value={gpsLongitude} onChange={(e) => setGpsLongitude(e.target.value)} type="number" step="any" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Google Maps URL</span><input value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block sm:col-span-2 lg:col-span-3">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Business Hours</span>
                <textarea value={businessHours} onChange={(e) => setBusinessHours(e.target.value)} rows={3} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button type="submit" disabled={saving} className="brand-button px-5 py-3 text-sm font-semibold" style={saving ? { opacity: 0.6 } : {}}>
                {saving ? 'Saving...' : editingId ? 'Update Branch' : 'Create Branch'}
              </button>
              <button type="button" onClick={closeEditor} className="rounded-lg border border-parchment-dark px-5 py-3 text-sm text-muted transition hover:text-ink">Cancel</button>
            </div>
          </form>
        )}

        {branches.length === 0 && !editorOpen ? (
          <div className="mt-12 text-center">
            <Building2 size={48} className="mx-auto text-parchment-dark/40" />
            <p className="mt-4 text-lg font-semibold text-ink">No branches yet</p>
            <p className="mt-1 text-sm text-muted">Add your funeral home branches to display on the public site.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => (
              <div key={branch.id} className="rounded-lg border border-parchment-dark bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-ink">{branch.name}</h3>
                    {branch.manager && <p className="text-xs text-muted">Manager: {branch.manager}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(branch)} className="rounded-lg p-1.5 text-muted transition hover:bg-parchment hover:text-ink"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(branch.id)} className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>
                {branch.address && <p className="mt-2 text-sm text-muted">{branch.address}{branch.city ? `, ${branch.city}` : ''}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {branch.phone && <span>Tel: {branch.phone}</span>}
                  {branch.whatsapp && <span>WA: {branch.whatsapp}</span>}
                  {branch.email && <span>{branch.email}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
