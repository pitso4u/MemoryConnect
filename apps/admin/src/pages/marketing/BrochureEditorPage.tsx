import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ImageIcon, Plus, QrCode, Trash2, Upload, X } from 'lucide-react';
import { api, Brochure, BrochureCategory, photoUrl } from '../../lib/api';

export default function BrochureEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [categories, setCategories] = useState<BrochureCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');

  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  const [published, setPublished] = useState(false);
  const [featured, setFeatured] = useState(false);

  const [gallery, setGallery] = useState<Array<{ id: string; url: string }>>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getBrochureCategories().catch(() => []),
      id ? api.getBrochure(id).catch(() => null) : Promise.resolve(null),
    ]).then(([cats, brochure]) => {
      setCategories(cats);
      if (brochure) {
        setTitle(brochure.title);
        setCategoryId(brochure.categoryId || '');
        setDescription(brochure.description || '');
        setCoverImageUrl(brochure.coverImageUrl || '');
        setPdfUrl(brochure.pdfUrl || '');
        setCtaEnabled(brochure.ctaEnabled ?? false);
        setCtaText(brochure.ctaText || '');
        setCtaUrl(brochure.ctaUrl || '');
        setWhatsappNumber(brochure.whatsappNumber || '');
        setPhoneNumber(brochure.phoneNumber || '');
        setEmailAddress(brochure.emailAddress || '');
        setSeoTitle(brochure.seoTitle || '');
        setSeoDescription(brochure.seoDescription || '');
        setPublished(brochure.published ?? false);
        setFeatured(brochure.featured ?? false);
        setGallery(brochure.gallery?.map((g) => ({ id: g.id, url: g.url })) || []);
        fetchQrCode(brochure.id);
      }
    }).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
    .finally(() => setLoading(false));
  }, [id]);

  const fetchQrCode = async (brochureId: string) => {
    try {
      const qr = await api.getBrochureQrCode(brochureId);
      setQrCodeUrl(qr.qrCodeUrl);
      setPublicUrl(qr.publicUrl);
    } catch { /* QR may not exist yet */ }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const data = {
        title: title.trim(),
        categoryId: categoryId || null,
        description,
        ctaEnabled,
        ctaText: ctaText || null,
        ctaUrl: ctaUrl || null,
        whatsappNumber: whatsappNumber || null,
        phoneNumber: phoneNumber || null,
        emailAddress: emailAddress || null,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        published,
        featured,
      };

      let brochure: Brochure;
      if (isEditing && id) {
        brochure = await api.updateBrochure(id, data);
        setMessage('Brochure saved');
      } else {
        brochure = await api.createBrochure(data);
        navigate(`/marketing/brochures/${brochure.id}`, { replace: true });
        setMessage('Brochure created');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCoverUpload = async (file: File) => {
    if (!id) { setError('Save the brochure first before uploading images'); return; }
    setUploadingCover(true);
    setError('');
    try {
      const result = await api.uploadBrochureCover(id, file);
      setCoverImageUrl(result.coverImageUrl);
      setMessage('Cover uploaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingCover(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    if (!id) { setError('Save the brochure first before uploading PDF'); return; }
    setUploadingPdf(true);
    setError('');
    try {
      const result = await api.uploadBrochurePdf(id, file);
      setPdfUrl(result.pdfUrl);
      setMessage('PDF uploaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleGalleryUpload = async (files: FileList) => {
    if (!id) { setError('Save the brochure first before uploading gallery'); return; }
    setUploadingGallery(true);
    setError('');
    try {
      const items = await api.uploadBrochureGallery(id, files);
      setGallery((prev) => [...prev, ...items.map((g) => ({ id: g.id, url: g.url }))]);
      setMessage('Gallery images uploaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleDeleteGallery = async (galleryId: string) => {
    if (!id) return;
    if (!confirm('Remove this image from gallery?')) return;
    try {
      await api.deleteBrochureGalleryItem(id, galleryId);
      setGallery((prev) => prev.filter((g) => g.id !== galleryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (loading) return <div className="p-8 text-muted">Loading brochure editor...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate('/marketing/brochures')} className="mb-6 flex items-center gap-2 text-sm text-muted transition hover:text-ink">
          <ArrowLeft size={16} /> Back to Brochures
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Marketing Hub</p>
        <h1 className="mt-3 font-display text-4xl text-ink">{isEditing ? 'Edit Brochure' : 'New Brochure'}</h1>

        <form onSubmit={handleSave} className="mt-8 space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <section className="rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="font-display text-xl text-ink">Basic Information</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Title *</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Category</span>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]">
                  <option value="">None</option>
                  {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Cover Image</span>
                {coverImageUrl ? (
                  <div className="relative inline-block">
                    <img src={photoUrl(coverImageUrl)} alt="Cover" className="h-24 w-40 rounded-lg object-cover" />
                    <button type="button" onClick={() => setCoverImageUrl('')} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white"><X size={14} /></button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-parchment-dark p-4 text-sm text-muted transition hover:border-[var(--brand-accent)]">
                    <ImageIcon size={20} className="mb-1" />
                    <span>{uploadingCover ? 'Uploading...' : 'Click to upload'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ''; }} />
                  </label>
                )}
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">PDF Brochure</span>
                {pdfUrl ? (
                  <div className="flex items-center gap-2 rounded-lg border border-parchment-dark bg-parchment/30 p-2">
                    <a href={photoUrl(pdfUrl)} target="_blank" rel="noreferrer" className="text-sm text-[var(--brand-accent)] underline">View PDF</a>
                    <button type="button" onClick={() => setPdfUrl('')} className="ml-auto text-red-500"><X size={14} /></button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-parchment-dark p-4 text-sm text-muted transition hover:border-[var(--brand-accent)]">
                    <Upload size={20} className="mb-1" />
                    <span>{uploadingPdf ? 'Uploading...' : 'Upload PDF'}</span>
                    <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.target.value = ''; }} />
                  </label>
                )}
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="font-display text-xl text-ink">Call to Action</h2>
            <label className="mt-4 flex items-center gap-3 rounded-lg bg-parchment px-4 py-3 text-sm font-semibold text-ink">
              <input type="checkbox" checked={ctaEnabled} onChange={(e) => setCtaEnabled(e.target.checked)} />
              Enable Call to Action
            </label>
            {ctaEnabled && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted">CTA Text</span>
                  <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="e.g. Download Brochure" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted">CTA URL</span>
                  <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                </label>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="font-display text-xl text-ink">Contact Information</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">WhatsApp Number</span>
                <input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+27..." className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Phone Number</span>
                <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Email Address</span>
                <input value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} type="email" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="font-display text-xl text-ink">SEO</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-muted">SEO Title</span>
                <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-muted">SEO Description</span>
                <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="font-display text-xl text-ink">Publishing</h2>
            <div className="mt-5 flex flex-wrap gap-6">
              <label className="flex items-center gap-3 rounded-lg bg-parchment px-4 py-3 text-sm font-semibold text-ink">
                <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
                Published
              </label>
              <label className="flex items-center gap-3 rounded-lg bg-parchment px-4 py-3 text-sm font-semibold text-ink">
                <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                Featured
              </label>
            </div>
          </section>

          {isEditing && id && (
            <section className="rounded-lg border border-parchment-dark bg-white p-6">
              <h2 className="font-display text-xl text-ink">Gallery</h2>
              {gallery.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {gallery.map((item) => (
                    <div key={item.id} className="group relative">
                      <img src={photoUrl(item.url)} alt="" className="h-28 w-full rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => handleDeleteGallery(item.id)}
                        className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-parchment-dark p-4 text-sm text-muted transition hover:border-[var(--brand-accent)]">
                <Plus size={16} />
                <span>{uploadingGallery ? 'Uploading...' : 'Add Images'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => { const f = e.target.files; if (f && f.length > 0) handleGalleryUpload(f); e.target.value = ''; }} />
              </label>
            </section>
          )}

          {isEditing && qrCodeUrl && (
            <section className="rounded-lg border border-parchment-dark bg-white p-6">
              <h2 className="flex items-center gap-2 font-display text-xl text-ink"><QrCode size={20} /> QR Code</h2>
              <div className="mt-4 flex flex-wrap items-center gap-6">
                <img src={photoUrl(qrCodeUrl)} alt="QR Code" className="h-32 w-32 rounded-lg border" />
                {publicUrl && (
                  <div>
                    <p className="text-xs font-semibold text-muted">Public URL</p>
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--brand-accent)] underline">{publicUrl}</a>
                  </div>
                )}
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={saving} className="brand-button flex items-center gap-2 px-5 py-3 text-sm font-semibold" style={saving ? { opacity: 0.6 } : {}}>
              {saving ? 'Saving...' : isEditing ? 'Save Brochure' : 'Create Brochure'}
            </button>
            {message && <span className="flex items-center gap-1.5 text-sm text-emerald-700"><Check size={15} />{message}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
