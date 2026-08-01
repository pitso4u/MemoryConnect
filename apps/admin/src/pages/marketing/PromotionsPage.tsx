import { FormEvent, useEffect, useState } from 'react';
import { Check, ImageIcon, Megaphone, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, Promotion, photoUrl } from '../../lib/api';

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      setPromotions(await api.getPromotions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setBannerImageUrl('');
    setStartDate('');
    setEndDate('');
    setButtonText('');
    setButtonUrl('');
    setPublished(false);
    setEditorOpen(true);
    setError('');
  };

  const openEdit = (p: Promotion) => {
    setEditingId(p.id);
    setTitle(p.title);
    setDescription(p.description || '');
    setBannerImageUrl(p.bannerImageUrl || '');
    setStartDate(p.startDate.slice(0, 10));
    setEndDate(p.endDate ? p.endDate.slice(0, 10) : '');
    setButtonText(p.buttonText || '');
    setButtonUrl(p.buttonUrl || '');
    setPublished(p.published ?? false);
    setEditorOpen(true);
    setError('');
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const data = {
        title: title.trim(),
        description: description || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        buttonText: buttonText || undefined,
        buttonUrl: buttonUrl || undefined,
        published,
      };

      if (editingId) {
        const updated = await api.updatePromotion(editingId, data);
        setPromotions((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
        setMessage('Promotion updated');
        closeEditor();
      } else {
        await api.createPromotion(data);
        setMessage('Promotion created');
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
    if (!confirm('Delete this promotion?')) return;
    try {
      await api.deletePromotion(id);
      setPromotions((prev) => prev.filter((p) => p.id !== id));
      setMessage('Promotion deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleBannerUpload = async (file: File, promoId: string) => {
    setUploadingBanner(true);
    try {
      const result = await api.uploadPromotionBanner(promoId, file);
      setBannerImageUrl(result.bannerImageUrl);
      setPromotions((prev) => prev.map((p) => (p.id === promoId ? { ...p, bannerImageUrl: result.bannerImageUrl } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Banner upload failed');
    } finally {
      setUploadingBanner(false);
    }
  };

  if (loading) return <div className="p-8 text-muted">Loading promotions...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Marketing Hub</p>
            <h1 className="mt-3 font-display text-4xl text-ink">Promotions</h1>
          </div>
          {!editorOpen && (
            <button onClick={openNew} className="brand-button flex items-center gap-2 px-5 py-3 text-sm font-semibold">
              <Plus size={16} /> New Promotion
            </button>
          )}
        </div>

        {error && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="mt-6 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><Check size={15} />{message}</div>}

        {editorOpen && (
          <form onSubmit={handleSave} className="mt-6 rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="font-display text-xl text-ink">{editingId ? 'Edit Promotion' : 'New Promotion'}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Title *</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Start Date *</span>
                <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">End Date</span>
                <input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="date" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Button Text</span>
                <input value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="e.g. Learn More" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Button URL</span>
                <input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="https://" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Banner Image</span>
                {bannerImageUrl ? (
                  <div className="relative inline-block">
                    <img src={photoUrl(bannerImageUrl)} alt="Banner" className="h-28 w-full max-w-md rounded-lg object-cover" />
                    <button type="button" onClick={() => setBannerImageUrl('')} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white"><X size={14} /></button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-parchment-dark p-4 text-sm text-muted transition hover:border-[var(--brand-accent)]">
                    <ImageIcon size={20} className="mb-1" />
                    <span>{uploadingBanner ? 'Uploading...' : 'Click to upload banner'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f && editingId) handleBannerUpload(f, editingId);
                      e.target.value = '';
                    }} />
                  </label>
                )}
              </label>
              <label className="flex items-center gap-3 rounded-lg bg-parchment px-4 py-3 text-sm font-semibold text-ink sm:col-span-2">
                <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
                Published
              </label>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button type="submit" disabled={saving} className="brand-button px-5 py-3 text-sm font-semibold" style={saving ? { opacity: 0.6 } : {}}>
                {saving ? 'Saving...' : editingId ? 'Update Promotion' : 'Create Promotion'}
              </button>
              <button type="button" onClick={closeEditor} className="rounded-lg border border-parchment-dark px-5 py-3 text-sm text-muted transition hover:text-ink">Cancel</button>
            </div>
          </form>
        )}

        {promotions.length === 0 && !editorOpen ? (
          <div className="mt-12 text-center">
            <Megaphone size={48} className="mx-auto text-parchment-dark/40" />
            <p className="mt-4 text-lg font-semibold text-ink">No promotions yet</p>
            <p className="mt-1 text-sm text-muted">Create your first promotion to highlight special offers.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-lg border border-parchment-dark bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-parchment-dark bg-parchment/50 text-left text-xs font-semibold uppercase text-muted">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Date Range</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Published</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((promo) => (
                  <tr key={promo.id} className="border-b border-parchment-dark/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{promo.title}</td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(promo.startDate).toLocaleDateString()} – {promo.endDate ? new Date(promo.endDate).toLocaleDateString() : 'Ongoing'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${promo.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {promo.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${promo.published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {promo.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(promo)} className="rounded-lg p-1.5 text-muted transition hover:bg-parchment hover:text-ink" title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(promo.id)} className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
