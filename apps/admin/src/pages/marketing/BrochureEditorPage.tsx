import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  FileText,
  Globe,
  ImageIcon,
  Images,
  Info,
  LayoutGrid,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  QrCode,
  Rocket,
  Save,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { api, Brochure, BrochureCategory, photoUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

type StepId = 'basic' | 'details' | 'pricing' | 'cover' | 'gallery' | 'pdf' | 'contact' | 'preview' | 'publish';

const STEPS: Array<{ id: StepId; title: string; icon: typeof Tag; blurb: string }> = [
  { id: 'basic', title: 'Basic Information', icon: Tag, blurb: 'Start with the package name, a short description and the category.' },
  { id: 'details', title: 'Package Details', icon: LayoutGrid, blurb: 'List exactly what is included in this package for families.' },
  { id: 'pricing', title: 'Pricing', icon: Wallet, blurb: 'Tell families what the package costs and any payment options.' },
  { id: 'cover', title: 'Cover Image', icon: ImageIcon, blurb: 'Add the main image for this package page.' },
  { id: 'gallery', title: 'Gallery', icon: Images, blurb: 'Add brochure pages or extra photos that explain this package.' },
  { id: 'pdf', title: 'Brochure PDF', icon: FileText, blurb: 'Upload the full brochure so families can download it.' },
  { id: 'contact', title: 'Contact Information', icon: Phone, blurb: 'How can families reach you about this package?' },
  { id: 'preview', title: 'Preview', icon: Eye, blurb: 'Review how this package page will look to families.' },
  { id: 'publish', title: 'Publish', icon: Rocket, blurb: 'Save, preview or make your package public.' },
];

const ITEM_SUGGESTIONS = [
  'Coffin',
  'Hearse',
  'Family Car',
  'Tent',
  'Chairs',
  'Flowers',
  'Catering',
  'Funeral Programme',
  'Grave Preparation',
];

const CTA_OPTIONS: Array<{ value: string; label: string; icon: typeof Phone; hint: string }> = [
  { value: 'enquire', label: 'Send Enquiry', icon: Mail, hint: 'Families fill in the enquiry form on the page.' },
  { value: 'call', label: 'Call Us', icon: Phone, hint: 'Families tap the button to phone your number.' },
  { value: 'whatsapp', label: 'WhatsApp Us', icon: MessageSquare, hint: 'Families tap the button to open WhatsApp.' },
  { value: 'email', label: 'Send Email', icon: Mail, hint: 'Families tap the button to write an email.' },
  { value: 'branch', label: 'Visit a Branch', icon: MapPin, hint: 'Families are taken to your contact details.' },
  { value: 'custom', label: 'Custom Link', icon: Globe, hint: 'Link to any page or phone/WhatsApp number you like.' },
];

function formatPrice(value: string): string {
  const p = value.trim();
  if (!p) return '';
  return /^(R|R\$|ZAR|\$|£|€)\s?/i.test(p) ? p : `R ${p}`;
}

function resolveCta(
  type: string,
  opts: { phoneNumber: string; whatsappNumber: string; emailAddress: string; ctaText: string; ctaUrl: string },
): { text: string | null; url: string | null } {
  switch (type) {
    case 'call':
      return { text: 'Call Us', url: opts.phoneNumber ? `tel:${opts.phoneNumber.replace(/[^+\d]/g, '')}` : null };
    case 'whatsapp':
      return { text: 'WhatsApp Us', url: opts.whatsappNumber ? `https://wa.me/${opts.whatsappNumber.replace(/\D/g, '')}` : null };
    case 'email':
      return { text: 'Send Email', url: opts.emailAddress ? `mailto:${opts.emailAddress}` : null };
    case 'branch':
      return { text: 'Visit a Branch', url: null };
    case 'custom':
      return { text: opts.ctaText || null, url: opts.ctaUrl || null };
    case 'enquire':
    default:
      return { text: 'Send Enquiry', url: '#contact' };
  }
}

export default function BrochureEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshFeatures } = useAuth();
  const isEditing = Boolean(id);

  const [categories, setCategories] = useState<BrochureCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [stepIndex, setStepIndex] = useState(0);
  const [visited, setVisited] = useState<number[]>([0]);

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  const [includedItems, setIncludedItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');

  const [price, setPrice] = useState('');
  const [depositRequired, setDepositRequired] = useState(false);
  const [monthlyPaymentAvailable, setMonthlyPaymentAvailable] = useState(false);
  const [financeAvailable, setFinanceAvailable] = useState(false);

  const [ctaEnabled, setCtaEnabled] = useState(true);
  const [ctaType, setCtaType] = useState('enquire');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  const [contactPerson, setContactPerson] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [branchName, setBranchName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

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
        setIncludedItems(Array.isArray(brochure.includedItems) ? brochure.includedItems : []);
        setPrice(brochure.price || '');
        setDepositRequired(brochure.depositRequired ?? false);
        setMonthlyPaymentAvailable(brochure.monthlyPaymentAvailable ?? false);
        setFinanceAvailable(brochure.financeAvailable ?? false);
        setCtaEnabled(brochure.ctaEnabled ?? true);
        setCtaType(brochure.ctaType || 'enquire');
        setCtaText(brochure.ctaText || '');
        setCtaUrl(brochure.ctaUrl || '');
        setContactPerson(brochure.contactPerson || '');
        setPhoneNumber(brochure.phoneNumber || '');
        setWhatsappNumber(brochure.whatsappNumber || '');
        setEmailAddress(brochure.emailAddress || '');
        setBranchName(brochure.branchName || '');
        setWebsiteUrl(brochure.websiteUrl || '');
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

  const goToStep = (index: number) => {
    setError('');
    setVisited((prev) => (prev.includes(index) ? prev : [...prev, index]));
    setStepIndex(index);
  };

  const needsId = (index: number) => index >= 3;

  const handleNext = async () => {
    if (stepIndex === 0 && !title.trim()) {
      setError('Please enter a package name before continuing.');
      return;
    }
    setError('');
    const target = Math.min(stepIndex + 1, STEPS.length - 1);
    if (needsId(target) && !(isEditing && id)) {
      const ok = await save(false, { silent: true });
      if (!ok) return;
    }
    goToStep(target);
  };

  const handleBack = () => {
    setError('');
    setStepIndex(Math.max(stepIndex - 1, 0));
  };

  const buildPayload = (publish: boolean) => {
    const resolved = resolveCta(ctaType, { phoneNumber, whatsappNumber, emailAddress, ctaText, ctaUrl });
    return {
      title: title.trim(),
      categoryId: categoryId || null,
      description: description.trim() || null,
      includedItems: includedItems.length ? includedItems : undefined,
      price: formatPrice(price) || null,
      depositRequired,
      monthlyPaymentAvailable,
      financeAvailable,
      ctaEnabled,
      ctaType: ctaType || null,
      ctaText: ctaEnabled ? (resolved.text || null) : null,
      ctaUrl: ctaEnabled ? (resolved.url || null) : null,
      whatsappNumber: whatsappNumber || null,
      phoneNumber: phoneNumber || null,
      emailAddress: emailAddress || null,
      contactPerson: contactPerson || null,
      branchName: branchName || null,
      websiteUrl: websiteUrl || null,
      seoTitle: seoTitle.trim() || title.trim() || null,
      seoDescription: seoDescription.trim() || description.trim().slice(0, 160) || null,
      published: publish ? true : false,
      featured,
    };
  };

  const save = async (publish: boolean, opts?: { silent?: boolean }): Promise<Brochure | null> => {
    if (!title.trim()) {
      setError('Please enter a package name first.');
      return null;
    }
    setSaving(true);
    setError('');
    if (!opts?.silent) setMessage('');
    try {
      const payload = buildPayload(publish);
      let brochure: Brochure;
      if (isEditing && id) {
        brochure = await api.updateBrochure(id, payload);
      } else {
        brochure = await api.createBrochure(payload);
        navigate(`/marketing/brochures/${brochure.id}`, { replace: true });
      }
      if (!opts?.silent) setMessage(publish ? 'Package published' : 'Draft saved');
      void refreshFeatures();
      return brochure;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const brochure = await save(true);
    if (brochure) {
      setPublished(true);
      fetchQrCode(brochure.id);
    }
  };

  const handleSaveDraft = async () => {
    const brochure = await save(false);
    if (brochure) {
      setPublished(false);
      fetchQrCode(brochure.id);
    }
  };

  const addItem = () => {
    const item = newItem.trim();
    if (!item) return;
    if (!includedItems.some((i) => i.toLowerCase() === item.toLowerCase())) {
      setIncludedItems((prev) => [...prev, item]);
    }
    setNewItem('');
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
      setGallery(items.map((g) => ({ id: g.id, url: g.url })));
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

  const current = STEPS[stepIndex];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate('/marketing/brochures')} className="mb-6 flex items-center gap-2 text-sm text-muted transition hover:text-ink">
          <ArrowLeft size={16} /> Back to Brochures
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Marketing Hub</p>
        <h1 className="mt-3 font-display text-4xl text-ink">{isEditing ? 'Edit Package' : 'New Package'}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Answer a few simple questions to create a professional page families can view, download and enquire about.
        </p>

        {/* ── Stepper ── */}
        <ol className="mt-8 flex items-start overflow-x-auto pb-2" aria-label="Package editor steps">
          {STEPS.map((step, i) => {
            const StepIcon = step.icon;
            const active = i === stepIndex;
            const done = visited.includes(i) && i < stepIndex;
            const clickable = visited.includes(i);
            return (
              <li key={step.id} className="flex min-w-0 flex-1 items-center">
                {i > 0 && (
                  <span className={`mx-1 h-px flex-1 sm:mx-2 ${done ? 'bg-emerald-500/60' : 'bg-parchment-dark'}`} aria-hidden="true" />
                )}
                <button
                  type="button"
                  onClick={() => clickable && goToStep(i)}
                  disabled={!clickable}
                  aria-current={active ? 'step' : undefined}
                  className={`group flex flex-col items-center gap-1 px-1 text-center ${clickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition ${
                      done
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : active
                        ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]'
                        : 'border-parchment-dark bg-white text-muted'
                    }`}
                  >
                    {done ? <Check size={15} /> : <StepIcon size={15} />}
                  </span>
                  <span className={`hidden whitespace-nowrap text-[10px] font-semibold sm:block ${active ? 'text-ink' : 'text-muted'}`}>
                    {i + 1}. {step.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* ── Step content ── */}
        <div className="mt-8">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">
              Step {stepIndex + 1} of {STEPS.length} · {current.title}
            </p>
            <p className="mt-1 flex items-start gap-2 text-sm text-muted">
              <Info size={15} className="mt-0.5 shrink-0" />
              {current.blurb}
            </p>
          </div>

          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {message && !error && <div className="mb-5 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><Check size={15} />{message}</div>}

          <div className="rounded-lg border border-parchment-dark bg-white p-6">
            {stepIndex === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-muted">Package Name *</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Basic Package, Standard Package, Executive Package"
                    className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
                  />
                  <span className="mt-1 block text-xs text-muted">This is the name families will see at the top of the page.</span>
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-muted">Short Description</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Briefly describe who this package is for. Example: An affordable package that provides everything needed for a dignified funeral service."
                    className="w-full resize-y rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
                  />
                  <span className="mt-1 block text-xs text-muted">One or two sentences that explain this package to families.</span>
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-muted">Category</span>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
                  >
                    <option value="">None</option>
                    {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                  <span className="mt-1 block text-xs text-muted">Groups this package on your services page, e.g. "Funeral Packages".</span>
                </label>
              </div>
            )}

            {stepIndex === 1 && (
              <div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {includedItems.map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-lg border border-parchment-dark bg-parchment/30 px-3 py-2">
                      <Check size={14} className="shrink-0 text-emerald-600" />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{item}</span>
                      <button type="button" onClick={() => setIncludedItems((prev) => prev.filter((i) => i !== item))} className="text-muted transition hover:text-red-600" aria-label={`Remove ${item}`}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {includedItems.length === 0 && (
                    <p className="col-span-full rounded-lg border border-dashed border-parchment-dark px-4 py-5 text-center text-sm text-muted sm:col-span-3">
                      No items yet. Add what families receive with this package.
                    </p>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                    placeholder="e.g. Coffin, Hearse, Flowers..."
                    className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
                  />
                  <button type="button" onClick={addItem} className="brand-button flex shrink-0 items-center gap-2 px-4 text-sm font-semibold">
                    <Plus size={15} /> Add Item
                  </button>
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-muted">Common items — tap to add</p>
                  <div className="flex flex-wrap gap-2">
                    {ITEM_SUGGESTIONS.filter((s) => !includedItems.some((i) => i.toLowerCase() === s.toLowerCase())).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setIncludedItems((prev) => [...prev, s])}
                        className="rounded-full border border-parchment-dark bg-parchment/30 px-3 py-1.5 text-xs font-medium text-ink transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {stepIndex === 2 && (
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted">Package Price</span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center rounded-lg border border-parchment-dark bg-parchment/30 px-3 py-2.5 text-sm font-semibold text-ink">R</span>
                    <input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="e.g. 10,000"
                      inputMode="numeric"
                      className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
                    />
                  </div>
                  <span className="mt-1 block text-xs text-muted">The total price shown to families. Leave blank for "Pricing on request".</span>
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-parchment-dark bg-parchment/30 px-4 py-3">
                    <input type="checkbox" checked={depositRequired} onChange={(e) => setDepositRequired(e.target.checked)} className="h-4 w-4 accent-[var(--brand-accent)]" />
                    <span className="text-sm font-medium text-ink">Deposit Required</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-parchment-dark bg-parchment/30 px-4 py-3">
                    <input type="checkbox" checked={monthlyPaymentAvailable} onChange={(e) => setMonthlyPaymentAvailable(e.target.checked)} className="h-4 w-4 accent-[var(--brand-accent)]" />
                    <span className="text-sm font-medium text-ink">Monthly Payment Available</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-parchment-dark bg-parchment/30 px-4 py-3">
                    <input type="checkbox" checked={financeAvailable} onChange={(e) => setFinanceAvailable(e.target.checked)} className="h-4 w-4 accent-[var(--brand-accent)]" />
                    <span className="text-sm font-medium text-ink">Finance Available</span>
                  </label>
                </div>
              </div>
            )}

            {stepIndex === 3 && (
              <div>
                <p className="mb-4 flex items-start gap-2 rounded-lg bg-parchment/60 px-4 py-3 text-sm text-muted">
                  <Info size={15} className="mt-0.5 shrink-0" />
                  This is the main image that represents the package. It appears at the top of the public page. Recommended size: 1600 × 900.
                </p>
                {coverImageUrl ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <img src={photoUrl(coverImageUrl)} alt="Cover" className="h-40 w-72 rounded-lg object-cover" />
                    <button type="button" onClick={() => setCoverImageUrl('')} className="text-sm text-red-600 transition hover:text-red-700">Remove image</button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-parchment-dark p-8 text-sm text-muted transition hover:border-[var(--brand-accent)]">
                    <ImageIcon size={24} className="mb-2" />
                    <span className="font-medium text-ink">{uploadingCover ? 'Uploading...' : 'Click to upload a cover image'}</span>
                    <span className="mt-1 text-xs">PNG, JPG or WebP · up to 10MB</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ''; }} />
                  </label>
                )}
              </div>
            )}

            {stepIndex === 4 && (
              <div>
                <p className="mb-4 flex items-start gap-2 rounded-lg bg-parchment/60 px-4 py-3 text-sm text-muted">
                  <Info size={15} className="mt-0.5 shrink-0" />
                  Upload brochure pages or additional images that explain this package. These can include pricing sheets, what's included, vehicle photos, coffin options or promotional artwork.
                </p>
                {gallery.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              </div>
            )}

            {stepIndex === 5 && (
              <div>
                <p className="mb-4 flex items-start gap-2 rounded-lg bg-parchment/60 px-4 py-3 text-sm text-muted">
                  <Info size={15} className="mt-0.5 shrink-0" />
                  Upload your complete brochure in PDF format. Visitors will be able to download it from the page.
                </p>
                {pdfUrl ? (
                  <div className="flex items-center gap-3 rounded-lg border border-parchment-dark bg-parchment/30 p-3">
                    <FileText size={18} className="shrink-0 text-[var(--brand-accent)]" />
                    <a href={photoUrl(pdfUrl)} target="_blank" rel="noreferrer" className="text-sm text-[var(--brand-accent)] underline">View PDF</a>
                    <button type="button" onClick={() => setPdfUrl('')} className="ml-auto text-red-500"><X size={14} /></button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-parchment-dark p-8 text-sm text-muted transition hover:border-[var(--brand-accent)]">
                    <Upload size={24} className="mb-2" />
                    <span className="font-medium text-ink">{uploadingPdf ? 'Uploading...' : 'Upload PDF Brochure'}</span>
                    <span className="mt-1 text-xs">PDF only · up to 50MB</span>
                    <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.target.value = ''; }} />
                  </label>
                )}
              </div>
            )}

            {stepIndex === 6 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">Contact Person</span>
                    <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="e.g. Thandi Nkosi" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">Branch</span>
                    <input value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="e.g. Pretoria Branch" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">Phone Number</span>
                    <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="e.g. 012 345 6789" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">WhatsApp</span>
                    <input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="e.g. +27 82 123 4567" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">Email Address</span>
                    <input value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} type="email" placeholder="e.g. info@funeralhome.co.za" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-muted">Website (optional)</span>
                    <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                  </label>
                </div>

                <div className="rounded-lg border border-parchment-dark bg-parchment/30 p-5">
                  <label className="flex items-center gap-3 text-sm font-semibold text-ink">
                    <input type="checkbox" checked={ctaEnabled} onChange={(e) => setCtaEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--brand-accent)]" />
                    Show a call-to-action button on the page
                  </label>
                  {ctaEnabled && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold text-muted">When a visitor is interested, what should happen?</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {CTA_OPTIONS.map((opt) => {
                          const OptIcon = opt.icon;
                          const selected = ctaType === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setCtaType(opt.value)}
                              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
                                selected ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)]/10' : 'border-parchment-dark bg-white hover:border-[var(--brand-accent)]/50'
                              }`}
                            >
                              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${selected ? 'bg-[var(--brand-accent)] text-white' : 'bg-parchment text-muted'}`}>
                                <OptIcon size={15} />
                              </span>
                              <span>
                                <span className="block text-sm font-semibold text-ink">{opt.label}</span>
                                <span className="block text-xs text-muted">{opt.hint}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {ctaType === 'custom' && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-muted">Button Text</span>
                            <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="e.g. Download Price List" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold text-muted">Button Link</span>
                            <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https:// or tel:+27..." className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {stepIndex === 7 && (
              <div className="space-y-5">
                {id ? (
                  <>
                    {publicUrl && (
                      <div className="rounded-lg border border-parchment-dark bg-parchment/30 p-4">
                        <p className="text-xs font-semibold text-muted">Public page</p>
                        <a href={publicUrl} target="_blank" rel="noreferrer" className="break-all text-sm text-[var(--brand-accent)] underline">{publicUrl}</a>
                        <p className="mt-1 text-xs text-muted">
                          {published ? 'This package is live and visible to families.' : 'This package is a draft and not yet visible to families.'}
                        </p>
                        {published && (
                          <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white">
                            <Eye size={15} /> Open live page
                          </a>
                        )}
                      </div>
                    )}
                    {qrCodeUrl && (
                      <div className="flex items-center gap-4 rounded-lg border border-parchment-dark p-4">
                        <img src={photoUrl(qrCodeUrl)} alt="QR Code" className="h-24 w-24 rounded-lg border" />
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold text-ink"><QrCode size={15} /> Share with a QR code</p>
                          <p className="mt-1 text-xs text-muted">Print this QR code on the brochure or hand-outs so families can scan straight to the page.</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="rounded-lg border border-dashed border-parchment-dark px-4 py-6 text-center text-sm text-muted">
                    Save a draft first to generate a preview and QR code.
                  </p>
                )}

                <div className="overflow-hidden rounded-lg border border-parchment-dark">
                  <div className="bg-parchment/60 px-5 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Package summary</p>
                  </div>
                  <dl className="divide-y divide-parchment-dark text-sm">
                    <div className="grid grid-cols-[130px_1fr] gap-3 px-5 py-3">
                      <dt className="text-muted">Name</dt>
                      <dd className="font-medium text-ink">{title || '—'}</dd>
                    </div>
                    {categoryId && (
                      <div className="grid grid-cols-[130px_1fr] gap-3 px-5 py-3">
                        <dt className="text-muted">Category</dt>
                        <dd className="text-ink">{categories.find((c) => c.id === categoryId)?.name || '—'}</dd>
                      </div>
                    )}
                    {description && (
                      <div className="grid grid-cols-[130px_1fr] gap-3 px-5 py-3">
                        <dt className="text-muted">Description</dt>
                        <dd className="whitespace-pre-line text-ink">{description}</dd>
                      </div>
                    )}
                    {includedItems.length > 0 && (
                      <div className="grid grid-cols-[130px_1fr] gap-3 px-5 py-3">
                        <dt className="text-muted">What's included</dt>
                        <dd className="flex flex-wrap gap-1.5">
                          {includedItems.map((item) => (
                            <span key={item} className="rounded-full bg-parchment px-2.5 py-1 text-xs font-medium text-ink">{item}</span>
                          ))}
                        </dd>
                      </div>
                    )}
                    {price && (
                      <div className="grid grid-cols-[130px_1fr] gap-3 px-5 py-3">
                        <dt className="text-muted">Price</dt>
                        <dd className="font-semibold text-ink">{formatPrice(price)}</dd>
                      </div>
                    )}
                    <div className="grid grid-cols-[130px_1fr] gap-3 px-5 py-3">
                      <dt className="text-muted">Media</dt>
                      <dd className="text-ink">
                        {coverImageUrl ? 'Cover image ✓' : 'No cover image'}
                        {gallery.length > 0 && ` · ${gallery.length} gallery image${gallery.length === 1 ? '' : 's'}`}
                        {pdfUrl && ' · PDF ✓'}
                      </dd>
                    </div>
                    <div className="grid grid-cols-[130px_1fr] gap-3 px-5 py-3">
                      <dt className="text-muted">Status</dt>
                      <dd className="text-ink">{published ? 'Published' : 'Draft'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}

            {stepIndex === 8 && (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="flex flex-col items-start gap-1 rounded-lg border border-parchment-dark bg-parchment/30 p-5 text-left transition hover:border-[var(--brand-accent)] disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2 font-display text-lg text-ink"><Save size={17} /> Save Draft</span>
                    <span className="text-xs text-muted">Keep working on it later. Not visible to families.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep(7)}
                    className="flex flex-col items-start gap-1 rounded-lg border border-parchment-dark bg-white p-5 text-left transition hover:border-[var(--brand-accent)]"
                  >
                    <span className="flex items-center gap-2 font-display text-lg text-ink"><Eye size={17} /> Preview</span>
                    <span className="text-xs text-muted">See what families will see on the page.</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={saving}
                    className="flex flex-col items-start gap-1 rounded-lg bg-[var(--brand-accent)] p-5 text-left text-white shadow-lg shadow-[var(--brand-accent)]/30 transition hover:opacity-90 disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2 font-display text-lg"><Rocket size={17} /> Publish</span>
                    <span className="text-xs text-white/85">Make the page publicly available to families.</span>
                  </button>
                </div>

                <label className="flex items-center gap-3 rounded-lg bg-parchment/40 px-4 py-3 text-sm font-semibold text-ink">
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-[var(--brand-accent)]" />
                  Feature this package at the top of your services page
                </label>

                <details className="group rounded-lg border border-parchment-dark bg-white">
                  <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 text-sm font-semibold text-ink">
                    <Sparkles size={16} className="text-[var(--brand-accent)]" /> Advanced settings (SEO)
                  </summary>
                  <div className="grid gap-4 border-t border-parchment-dark px-5 py-4 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">SEO Title</span>
                      <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Auto-generated from the package name" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">SEO Description</span>
                      <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} placeholder="Auto-generated from the short description" className="w-full resize-y rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                    </label>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer nav ── */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={stepIndex === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-parchment-dark bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-[var(--brand-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft size={15} /> Back
          </button>

          <div className="flex items-center gap-3">
            {stepIndex < STEPS.length - 1 && (
              <>
                <button type="button" onClick={() => save(false)} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-parchment-dark bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-[var(--brand-accent)] disabled:opacity-50">
                  <Save size={15} /> {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={saving}
                  className="brand-button inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  Next <ArrowRight size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
