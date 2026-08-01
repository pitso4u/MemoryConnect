import { FormEvent, useEffect, useState } from 'react';
import { Check, ImageIcon, Phone, X } from 'lucide-react';
import { api, photoUrl } from '../../lib/api';

export default function ContactPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [address, setAddress] = useState('');
  const [telephone, setTelephone] = useState('');
  const [mobile, setMobile] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [enableBrochures, setEnableBrochures] = useState(true);
  const [enableContact, setEnableContact] = useState(true);
  const [enableBranches, setEnableBranches] = useState(true);
  const [enablePromotions, setEnablePromotions] = useState(true);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getMarketingContact();
      if (data) {
        setBusinessName(data.businessName || '');
        setDescription(data.description || '');
        setLogoUrl(data.logoUrl || '');
        setCoverImageUrl(data.coverImageUrl || '');
        setAddress(data.address || '');
        setTelephone(data.telephone || '');
        setMobile(data.mobile || '');
        setWhatsapp(data.whatsapp || '');
        setEmail(data.email || '');
        setWebsite(data.website || '');
        setBusinessHours(data.businessHours || '');
        setGoogleMapsUrl(data.googleMapsUrl || '');
        setFacebook(data.facebook || '');
        setInstagram(data.instagram || '');
        setTiktok(data.tiktok || '');
        setLinkedin(data.linkedin || '');
        setEnableBrochures(data.enableBrochures ?? true);
        setEnableContact(data.enableContact ?? true);
        setEnableBranches(data.enableBranches ?? true);
        setEnablePromotions(data.enablePromotions ?? true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!businessName.trim()) { setError('Business name is required'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      await api.updateMarketingContact({
        businessName: businessName.trim(),
        description: description || undefined,
        address: address || undefined,
        telephone: telephone || undefined,
        mobile: mobile || undefined,
        whatsapp: whatsapp || undefined,
        email: email || undefined,
        website: website || undefined,
        businessHours: businessHours || undefined,
        googleMapsUrl: googleMapsUrl || undefined,
        facebook: facebook || undefined,
        instagram: instagram || undefined,
        tiktok: tiktok || undefined,
        linkedin: linkedin || undefined,
        enableBrochures,
        enableContact,
        enableBranches,
        enablePromotions,
      });
      setMessage('Contact information saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true); setError('');
    try {
      const result = await api.uploadMarketingContactLogo(file);
      setLogoUrl(result.logoUrl);
      setMessage('Logo uploaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true); setError('');
    try {
      const result = await api.uploadMarketingContactCover(file);
      setCoverImageUrl(result.coverImageUrl);
      setMessage('Cover uploaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingCover(false);
    }
  };

  if (loading) return <div className="p-8 text-muted">Loading contact information...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Marketing Hub</p>
        <h1 className="mt-3 font-display text-4xl text-ink">Contact Information</h1>

        <form onSubmit={handleSave} className="mt-8 space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <section className="rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="flex items-center gap-2 font-display text-xl text-ink"><Phone size={20} /> Business Details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Business Name *</span>
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Logo</span>
                {logoUrl ? (
                  <div className="relative inline-block">
                    <img src={photoUrl(logoUrl)} alt="Logo" className="h-20 w-20 rounded-lg object-cover" />
                    <button type="button" onClick={() => setLogoUrl('')} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white"><X size={14} /></button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-parchment-dark p-4 text-sm text-muted transition hover:border-[var(--brand-accent)]">
                    <ImageIcon size={20} className="mb-1" />
                    <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }} />
                  </label>
                )}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Cover Image</span>
                {coverImageUrl ? (
                  <div className="relative inline-block">
                    <img src={photoUrl(coverImageUrl)} alt="Cover" className="h-20 w-40 rounded-lg object-cover" />
                    <button type="button" onClick={() => setCoverImageUrl('')} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white"><X size={14} /></button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-parchment-dark p-4 text-sm text-muted transition hover:border-[var(--brand-accent)]">
                    <ImageIcon size={20} className="mb-1" />
                    <span>{uploadingCover ? 'Uploading...' : 'Upload Cover'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ''; }} />
                  </label>
                )}
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="font-display text-xl text-ink">Contact Details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Office Address</span><input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Business Hours</span><input value={businessHours} onChange={(e) => setBusinessHours(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Telephone</span><input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Mobile</span><input value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">WhatsApp</span><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Email</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Website</span><input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Google Maps URL</span><input value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
            </div>
          </section>

          <section className="rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="font-display text-xl text-ink">Social Media</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Facebook URL</span><input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">Instagram URL</span><input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">TikTok URL</span><input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="https://" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">LinkedIn URL</span><input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" /></label>
            </div>
          </section>

          <section className="rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="font-display text-xl text-ink">Module Settings</h2>
            <p className="mt-1 text-sm text-muted">Enable or disable sections on the public marketing site.</p>
            <div className="mt-4 flex flex-wrap gap-6">
              <label className="flex items-center gap-3 rounded-lg bg-parchment px-4 py-3 text-sm font-semibold text-ink capitalize">
                <input type="checkbox" checked={enableBrochures} onChange={(e) => setEnableBrochures(e.target.checked)} /> Brochures
              </label>
              <label className="flex items-center gap-3 rounded-lg bg-parchment px-4 py-3 text-sm font-semibold text-ink capitalize">
                <input type="checkbox" checked={enableContact} onChange={(e) => setEnableContact(e.target.checked)} /> Contact
              </label>
              <label className="flex items-center gap-3 rounded-lg bg-parchment px-4 py-3 text-sm font-semibold text-ink capitalize">
                <input type="checkbox" checked={enableBranches} onChange={(e) => setEnableBranches(e.target.checked)} /> Branches
              </label>
              <label className="flex items-center gap-3 rounded-lg bg-parchment px-4 py-3 text-sm font-semibold text-ink capitalize">
                <input type="checkbox" checked={enablePromotions} onChange={(e) => setEnablePromotions(e.target.checked)} /> Promotions
              </label>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={saving} className="brand-button px-5 py-3 text-sm font-semibold" style={saving ? { opacity: 0.6 } : {}}>
              {saving ? 'Saving...' : 'Save Contact Information'}
            </button>
            {message && <span className="flex items-center gap-1.5 text-sm text-emerald-700"><Check size={15} />{message}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
