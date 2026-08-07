import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronLeft,
  Clock3,
  Download,
  FileText,
  Globe,
  Headset,
  HeartHandshake,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Phone,
  ShieldCheck,
  X,
} from 'lucide-react';
import { marketingApi, photoUrl } from '../lib/api';
import { brandCssVariables, brandFromFuneralHome } from '../lib/brand';

const HIGHLIGHTS: { icon: LucideIcon; label: string }[] = [
  { icon: ShieldCheck, label: 'Professional Service' },
  { icon: HeartHandshake, label: 'Compassionate Care' },
  { icon: BadgeCheck, label: 'Dignified & Trusted' },
  { icon: Headset, label: '24/7 Support' },
];

function parseIncludedItems(description: string): string[] {
  const lines = description.split('\n').map((l) => l.trim());

  const bullets = lines
    .filter((l) => /^[-•*✓✔]/u.test(l))
    .map((l) => l.replace(/^[-•*✓✔]\s*/u, '').trim())
    .filter(Boolean);
  if (bullets.length > 0) return bullets;

  const includes = description.match(/[Ii]ncludes?:?\s*([A-Za-z0-9][^.\n]*)/);
  if (includes) {
    return includes[1]
      .split(/[,;]|\band\b/i)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parsePrice(description: string): string | null {
  const match = description.match(/(?:R\s?|R\$\s?|ZAR\s?|R\$|\$)\s?[\d][\d\s.,]*/i);
  return match ? match[0].trim() : null;
}

function displayPrice(value?: string | null): string {
  const p = (value || '').trim();
  if (!p) return '';
  return /^(R|R\$|ZAR|\$|£|€)\s?/i.test(p) ? p : `R ${p}`;
}

export default function BrochurePage() {
  const { fhSlug: routeFhSlug, slug } = useParams<{ fhSlug?: string; slug: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof marketingApi.getBrochure>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ fullName: '', phoneNumber: '', emailAddress: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  const [menuOpen, setMenuOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [activeSection, setActiveSection] = useState('overview');
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');
    if (routeFhSlug) {
      marketingApi.getBrochure(routeFhSlug, slug)
        .then((result) => {
          setData(result);
          marketingApi.trackAnalytics({
            eventType: 'page_view',
            brochureId: result.brochure.id,
            visitorId: window.localStorage.getItem('mc_visitor_id') || undefined,
          }).catch(() => {});
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load page'))
        .finally(() => setLoading(false));
    } else {
      // Legacy /services/{slug} link: resolve to the canonical tenant URL.
      marketingApi.resolveLegacyBrochure(slug)
        .then(({ canonicalPath }) => navigate(canonicalPath, { replace: true }))
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load page');
          setLoading(false);
        });
    }
  }, [routeFhSlug, slug, navigate]);

  const handleEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.fullName.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!slug || !routeFhSlug) return;
    setSubmitting(true);
    try {
      await marketingApi.submitEnquiry(routeFhSlug, slug, formData);
      setSubmitted(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const trackClick = (eventType: string) => {
    if (!data) return;
    marketingApi.trackAnalytics({ eventType, brochureId: data.brochure.id }).catch(() => {});
  };

  // Focus & keyboard control for the lightbox.
  useEffect(() => {
    if (!lightboxOpen) return;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') moveLightbox(1);
      if (e.key === 'ArrowLeft') moveLightbox(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, data]);

  // Scrollspy for the sidebar. Runs before any early return so hook order stays stable.
  useEffect(() => {
    if (!data) return;
    const includedIds = data.brochure.description ? parseIncludedItems(data.brochure.description) : [];
    const ids = [
      'overview',
      ...(includedIds.length > 0 ? ['includes'] : []),
      'gallery',
      'pricing',
      'contact',
    ];
    const sections = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [data]);

  const moveLightbox = (dir: number) => {
    if (!galleryItems.length) return;
    setLightboxIndex((i) => (i + dir + galleryItems.length) % galleryItems.length);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--brand-background)]">
        <div className="text-center animate-fade-up">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-accent)] border-t-transparent" />
          <p className="text-[var(--brand-text)]/70 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--brand-background)] px-6">
        <div className="text-center">
          <p className="font-display text-xl mb-2">Brochure not found</p>
          <p className="text-[var(--brand-text)]/65 text-sm">{error || 'This brochure does not exist or is not published.'}</p>
          <Link to="/" className="mt-4 inline-flex items-center gap-2 text-[var(--brand-accent)] text-sm">Return home</Link>
        </div>
      </div>
    );
  }

  const { brochure, funeralHome: fh, contact } = data;
  const brand = fh?.brand || (fh ? brandFromFuneralHome(fh as any) : null);
  const brandVars = brand ? (brandCssVariables(brand) as React.CSSProperties) : {};
  const fhName = contact?.businessName || fh?.tradingName || fh?.name || '';
  const fhSlug = fh?.slug || '';
  const logoUrl = contact?.logoUrl || fh?.logoUrl || null;

  const pageTitle = brochure.seoTitle || `${brochure.title} - ${fhName} | Memory Connect`;
  const pageDesc = brochure.seoDescription || brochure.description?.slice(0, 160) || `Learn more about ${brochure.title} from ${fhName}.`;

  const images = brochure.gallery || [];
  const galleryItems = [
    ...(brochure.coverImageUrl
      ? [{ key: 'cover', src: brochure.coverImageUrl, alt: `${brochure.title} cover`, caption: 'Cover' as const }]
      : []),
    ...images.map((img) => ({
      key: img.id,
      src: img.url,
      alt: img.caption || 'Brochure page',
      caption: img.caption || ('' as const),
    })),
  ];

  const description = brochure.description || '';
  const included = Array.isArray(brochure.includedItems) && brochure.includedItems.length > 0
    ? brochure.includedItems
    : parseIncludedItems(description);
  const price = displayPrice(brochure.price) || parsePrice(description);
  const overviewText = description.trim() || '';

  const pricingOptions: string[] = [];
  if (brochure.depositRequired) pricingOptions.push('Deposit required');
  if (brochure.monthlyPaymentAvailable) pricingOptions.push('Monthly payments available');
  if (brochure.financeAvailable) pricingOptions.push('Finance available');

  const cta = (() => {
    if (brochure.ctaEnabled === false) return null;
    switch (brochure.ctaType) {
      case 'call':
        return brochure.phoneNumber
          ? { label: 'Call Us', href: `tel:${brochure.phoneNumber.replace(/[^+\d]/g, '')}`, track: 'phone_click' }
          : { label: 'Call Us', href: '#contact', track: 'phone_click' };
      case 'whatsapp':
        return brochure.whatsappNumber
          ? { label: 'WhatsApp Us', href: `https://wa.me/${brochure.whatsappNumber.replace(/\D/g, '')}`, track: 'whatsapp_click' }
          : { label: 'WhatsApp Us', href: '#contact', track: 'whatsapp_click' };
      case 'email':
        return brochure.emailAddress
          ? { label: 'Send Email', href: `mailto:${brochure.emailAddress}`, track: 'cta_click' }
          : { label: 'Send Email', href: '#contact', track: 'cta_click' };
      case 'branch':
        return { label: 'Visit a Branch', href: '#contact', track: 'cta_click' };
      case 'custom':
        return brochure.ctaText
          ? { label: brochure.ctaText, href: brochure.ctaUrl || '#contact', track: 'cta_click' }
          : null;
      default:
        return { label: 'Send Enquiry', href: '#contact', track: 'cta_click' };
    }
  })();

  const homeHref = '/';
  const servicesHref = fhSlug ? `/fh/${fhSlug}` : '/';
  const hasPricing = Boolean(price);

  const navItems = [
    { label: 'Home', href: homeHref, active: false },
    { label: 'Our Services', href: servicesHref, active: false },
    { label: 'Funeral Packages', href: '#top', active: true },
    ...(images.length > 0 ? [{ label: 'Gallery', href: '#gallery', active: false }] : []),
    { label: 'Contact Us', href: '#contact', active: false },
  ];

  const sidebarItems = [
    { id: 'overview', label: 'Overview' },
    ...(included.length > 0 ? [{ id: 'includes', label: "What's Included" }] : []),
    { id: 'gallery', label: 'Gallery' },
    { id: 'pricing', label: 'Package Pricing' },
    { id: 'contact', label: 'Contact Us' },
  ];

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        {brochure.coverImageUrl && <meta property="og:image" content={photoUrl(brochure.coverImageUrl)} />}
      </Helmet>

      <div className="marketing-page min-h-screen bg-[var(--brand-background)] text-[var(--brand-text)]" style={brandVars}>
        {/* ───────────────────────── Top navigation ───────────────────────── */}
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--brand-primary)]/95 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8" aria-label="Main navigation">
            <Link to="/" className="flex min-w-0 items-center gap-3">
              {logoUrl ? (
                <img src={photoUrl(logoUrl)} alt={`${fhName} logo`} className="h-10 w-10 shrink-0 rounded-lg bg-white/95 object-contain p-1 ring-1 ring-white/15" />
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 text-[var(--brand-accent)]"><Building2 size={20} /></span>
              )}
              <span className="truncate font-display text-lg text-[var(--brand-text)]">{fhName || 'Funeral Home'}</span>
            </Link>

            <div className="hidden items-center gap-7 text-sm text-[var(--brand-text)]/75 lg:flex">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  className={`transition hover:text-[var(--brand-text)] ${item.active ? 'font-semibold text-[var(--brand-accent)]' : ''}`}
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="hidden lg:block">
              {brochure.pdfUrl ? (
                <a
                  href={photoUrl(brochure.pdfUrl)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackClick('pdf_download')}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-[var(--brand-primary)] transition hover:opacity-90"
                >
                  <Download size={15} /> Brochure
                </a>
              ) : (
                <a href="#contact" className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/40 px-4 py-2 text-sm font-semibold text-[var(--brand-accent)] transition hover:bg-[var(--brand-accent)]/10">
                  Enquire
                </a>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm lg:hidden"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
              <span className="hidden sm:inline">{menuOpen ? 'Close' : 'Menu'}</span>
            </button>
          </nav>

          {menuOpen && (
            <div className="border-t border-white/10 bg-[var(--brand-primary)] lg:hidden">
              <div className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
                {navItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={item.active ? 'page' : undefined}
                    className={`block rounded-lg px-3 py-2.5 text-sm transition hover:bg-white/5 ${item.active ? 'font-semibold text-[var(--brand-accent)]' : 'text-[var(--brand-text)]/85'}`}
                  >
                    {item.label}
                  </a>
                ))}
                {brochure.pdfUrl && (
                  <a
                    href={photoUrl(brochure.pdfUrl)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackClick('pdf_download')}
                    className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-primary)]"
                  >
                    <Download size={15} /> Download Brochure
                  </a>
                )}
              </div>
            </div>
          )}
        </header>

        <main id="top">
          {/* ───────────────────────── Hero ───────────────────────── */}
          <section className="relative overflow-hidden border-b border-white/10">
            <div className="hero-glow absolute inset-0" />
            <div className="hero-grain absolute inset-0 opacity-30" />
            <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:px-8 lg:py-20">
              {/* Left: copy */}
              <div className="animate-fade-up">
                <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--brand-accent)]">
                  <span className="h-px w-10 bg-[var(--brand-accent)]" />
                  {brochure.category?.name || 'Funeral Packages'}
                </p>
                <h1 className="mt-5 font-display text-[clamp(2.6rem,6vw,4.6rem)] font-semibold leading-[0.98] tracking-tight">
                  {brochure.title}
                </h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-[var(--brand-text)]/70 sm:text-lg">
                  {pageDesc}
                </p>

                <ul className="mt-8 grid grid-cols-2 gap-3 sm:max-w-xl" aria-label="Package highlights">
                  {HIGHLIGHTS.map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]">
                        <Icon size={18} strokeWidth={1.5} />
                      </span>
                      <span className="text-sm text-[var(--brand-text)]/85">{label}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                  {brochure.pdfUrl && (
                    <a
                      href={photoUrl(brochure.pdfUrl)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackClick('pdf_download')}
                      className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] px-7 py-3.5 font-semibold text-[var(--brand-primary)] transition hover:opacity-90"
                    >
                      <Download size={17} /> Download Brochure
                    </a>
                  )}
                  <a
                    href={cta ? cta.href : '#contact'}
                    onClick={() => trackClick(cta ? cta.track : 'cta_click')}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-7 py-3.5 font-medium text-[var(--brand-text)] transition hover:border-[var(--brand-accent)]/60 hover:bg-white/5"
                  >
                    {cta ? cta.label : 'Enquire Now'} <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                  </a>
                </div>

                <div className="mt-6 flex items-center gap-6 text-xs text-[var(--brand-text)]/40">
                  {contact?.telephone && (
                    <a href={`tel:${contact.telephone}`} onClick={() => trackClick('phone_click')} className="inline-flex items-center gap-1.5 transition hover:text-[var(--brand-text)]">
                      <Phone size={13} /> {contact.telephone}
                    </a>
                  )}
                  {contact?.whatsapp && (
                    <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" onClick={() => trackClick('whatsapp_click')} className="inline-flex items-center gap-1.5 transition hover:text-[var(--brand-text)]">
                      <MessageSquare size={13} /> WhatsApp
                    </a>
                  )}
                </div>
              </div>

              {/* Right: branded brochure visual */}
              <div className="animate-fade-up animate-fade-up-delay-2 relative mx-auto w-full max-w-sm lg:ml-auto">
                <div className="absolute -inset-4 rounded-[2rem] border border-[var(--brand-accent)]/20" />
                <figure className="relative overflow-hidden rounded-[1.6rem] border border-white/12 bg-ink-light/70 shadow-2xl shadow-black/30">
                  {brochure.coverImageUrl ? (
                    <>
                      <div className="aspect-[4/5] overflow-hidden">
                        <img src={photoUrl(brochure.coverImageUrl)} alt={`${brochure.title} cover`} className="h-full w-full object-cover" />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-[var(--brand-primary)]/95 via-[var(--brand-primary)]/60 to-transparent p-5">
                        <div className="min-w-0">
                          {logoUrl ? (
                            <img src={photoUrl(logoUrl)} alt={`${fhName} logo`} className="mb-2 max-h-10 max-w-28 rounded-md bg-white/95 object-contain p-1" />
                          ) : (
                            <p className="mb-1 font-display text-sm text-[var(--brand-text)]/90">{fhName}</p>
                          )}
                          <p className="truncate text-[11px] uppercase tracking-[0.2em] text-[var(--brand-text)]/60">{brochure.title}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center">
                      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]">
                        <FileText size={28} strokeWidth={1.5} />
                      </span>
                      <p className="mt-5 font-display text-2xl">{brochure.title}</p>
                      <p className="mt-2 text-sm text-[var(--brand-text)]/50">{fhName}</p>
                    </div>
                  )}
                </figure>
              </div>
            </div>
          </section>

          {/* ───────────────────────── Content: sidebar + main ───────────────────────── */}
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="lg:grid lg:grid-cols-[250px_1fr] lg:gap-14">
              {/* Sidebar */}
              <aside className="hidden lg:block" aria-label="Page sections">
                <div className="sticky top-24 space-y-6">
                  <nav className="space-y-1" aria-label="On this page">
                    <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-text)]/45">On this page</p>
                    {sidebarItems.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        aria-current={activeSection === item.id ? 'true' : undefined}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                          activeSection === item.id
                            ? 'bg-[var(--brand-accent)]/12 font-semibold text-[var(--brand-accent)]'
                            : 'text-[var(--brand-text)]/70 hover:bg-white/5 hover:text-[var(--brand-text)]'
                        }`}
                      >
                        {item.label}
                      </a>
                    ))}
                  </nav>

                  {brochure.pdfUrl && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <p className="font-display text-lg">Download Brochure</p>
                      <p className="mt-1 text-xs text-[var(--brand-text)]/55">Save a full copy of this package to share with family.</p>
                      <a
                        href={photoUrl(brochure.pdfUrl)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => trackClick('pdf_download')}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-primary)] transition hover:opacity-90"
                      >
                        <Download size={15} /> Download PDF
                      </a>
                    </div>
                  )}
                </div>
              </aside>

              {/* Main content */}
              <div className="min-w-0 space-y-14">
                {/* Overview */}
                <section id="overview" className="scroll-mt-24">
                  <div className="flex items-center gap-3">
                    <span className="h-px w-8 bg-[var(--brand-accent)]" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-accent)]">Overview</p>
                  </div>
                  <h2 className="mt-4 font-display text-3xl sm:text-4xl">{brochure.title}</h2>
                  {overviewText ? (
                    <div className="mt-6 max-w-prose whitespace-pre-line text-base leading-7 text-[var(--brand-text)]/80">
                      {overviewText}
                    </div>
                  ) : (
                    <p className="mt-6 max-w-prose text-base leading-7 text-[var(--brand-text)]/70">
                      {fhName} offers {brochure.title} with dignity and care. Please get in touch to learn more about what is included.
                    </p>
                  )}
                  {fhSlug && (
                    <Link to={`/fh/${fhSlug}`} className="mt-6 inline-flex items-center gap-1 text-sm text-[var(--brand-accent)] hover:underline">
                      <ChevronLeft size={14} /> View all services from {fhName}
                    </Link>
                  )}
                </section>

                {/* What's Included */}
                {included.length > 0 && (
                  <section id="includes" className="scroll-mt-24">
                    <div className="flex items-center gap-3">
                      <span className="h-px w-8 bg-[var(--brand-accent)]" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-accent)]">What's Included</p>
                    </div>
                    <h2 className="mt-4 font-display text-3xl sm:text-4xl">Everything you need, handled with care</h2>
                    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                      {included.map((item) => (
                        <li key={item} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5">
                          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]">
                            <Check size={14} />
                          </span>
                          <span className="text-sm text-[var(--brand-text)]/85">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Gallery */}
                <section id="gallery" className="scroll-mt-24">
                  <div className="flex items-center gap-3">
                    <span className="h-px w-8 bg-[var(--brand-accent)]" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-accent)]">Gallery</p>
                  </div>
                  <h2 className="mt-4 font-display text-3xl sm:text-4xl">A closer look</h2>
                  {galleryItems.length > 0 ? (
                    <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {galleryItems.map((item, idx) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                          className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-[var(--brand-accent)]/40 hover:shadow-xl"
                          aria-label={`Open ${item.alt}`}
                        >
                          <div className="aspect-[3/4] overflow-hidden">
                            <img src={photoUrl(item.src)} alt={item.alt} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                          </div>
                          {item.caption && <p className="truncate px-3 py-2 text-xs text-[var(--brand-text)]/60">{item.caption}</p>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-6 max-w-prose text-[var(--brand-text)]/70">
                      {brochure.pdfUrl ? 'Open the brochure to view the full pages.' : 'Gallery coming soon.'}
                    </p>
                  )}
                </section>

                {/* Pricing */}
                <section id="pricing" className="scroll-mt-24">
                  <div className="flex items-center gap-3">
                    <span className="h-px w-8 bg-[var(--brand-accent)]" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-accent)]">Pricing</p>
                  </div>
                  <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-light/80 to-[var(--brand-primary)] p-6 shadow-xl sm:p-8">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-accent)]">{brochure.title}</p>
                        {hasPricing ? (
                          <p className="mt-4 font-display text-5xl font-semibold tracking-tight">{price}</p>
                        ) : (
                          <p className="mt-4 font-display text-4xl font-semibold tracking-tight">Pricing on request</p>
                        )}
                        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--brand-text)]/60">
                          {hasPricing
                            ? 'A transparent, all-inclusive price for the full service package.'
                            : 'Contact us and we will gladly share a clear, personalised quote for this package.'}
                        </p>
                        {pricingOptions.length > 0 && (
                          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Payment options">
                            {pricingOptions.map((opt) => (
                              <li key={opt} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--brand-accent)]">
                                <Check size={12} /> {opt}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <a
                        href="#contact"
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] px-7 py-3 text-sm font-semibold text-[var(--brand-primary)] transition hover:opacity-90"
                      >
                        Request a Quote <ArrowRight size={16} />
                      </a>
                    </div>
                  </div>
                </section>

                {/* Contact */}
                <section id="contact" className="scroll-mt-24">
                  <div className="flex items-center gap-3">
                    <span className="h-px w-8 bg-[var(--brand-accent)]" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-accent)]">Contact Us</p>
                  </div>
                  <h2 className="mt-4 font-display text-3xl sm:text-4xl">Talk to a caring specialist</h2>

                  <div className="mt-8 grid gap-8 lg:grid-cols-2">
                    {/* Details */}
                    <div className="space-y-5">
                      {brochure.contactPerson && (
                        <div className="flex gap-3">
                          <HeartHandshake size={19} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
                          <div>
                            <p className="text-sm font-medium">Contact Person</p>
                            <p className="text-sm text-[var(--brand-text)]/70">{brochure.contactPerson}</p>
                          </div>
                        </div>
                      )}
                      {brochure.branchName && (
                        <div className="flex gap-3">
                          <Building2 size={19} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
                          <div>
                            <p className="text-sm font-medium">Branch</p>
                            <p className="text-sm text-[var(--brand-text)]/70">{brochure.branchName}</p>
                          </div>
                        </div>
                      )}
                      {contact?.address && (
                        <div className="flex gap-3">
                          <MapPin size={19} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
                          <div>
                            <p className="text-sm font-medium">Address</p>
                            <p className="text-sm text-[var(--brand-text)]/70">{contact.address}</p>
                          </div>
                        </div>
                      )}
                      {(contact?.telephone || contact?.mobile) && (
                        <div className="flex gap-3">
                          <Phone size={19} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
                          <div>
                            <p className="text-sm font-medium">Phone</p>
                            <p className="text-sm text-[var(--brand-text)]/70">{contact?.telephone || contact?.mobile}</p>
                          </div>
                        </div>
                      )}
                      {contact?.whatsapp && (
                        <div className="flex gap-3">
                          <MessageSquare size={19} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
                          <div>
                            <p className="text-sm font-medium">WhatsApp</p>
                            <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-sm text-[var(--brand-accent)]">{contact.whatsapp}</a>
                          </div>
                        </div>
                      )}
                      {(contact?.email || brochure.emailAddress || contact?.website) && (
                        <div className="flex gap-3">
                          <Mail size={19} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
                          <div>
                            <p className="text-sm font-medium">Email / Website</p>
                            <p className="text-sm text-[var(--brand-text)]/70">
                              {contact?.email || brochure.emailAddress}
                              {(contact?.website || brochure.websiteUrl) && (
                                <span> · <a href={(contact?.website || brochure.websiteUrl) || undefined} target="_blank" rel="noreferrer" className="text-[var(--brand-accent)]">{contact?.website || brochure.websiteUrl}</a></span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                      {contact?.businessHours && (
                        <div className="flex gap-3">
                          <Clock3 size={19} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
                          <div>
                            <p className="text-sm font-medium">Business Hours</p>
                            <p className="text-sm text-[var(--brand-text)]/70 whitespace-pre-line">{contact.businessHours}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Enquiry form */}
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
                      {!submitted ? (
                        <>
                          <h3 className="font-display text-2xl">Send an enquiry</h3>
                          <p className="mt-1 text-sm text-[var(--brand-text)]/55">Tell us a little about the package you need and we'll get back to you.</p>
                          {formError && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{formError}</p>}
                          <form onSubmit={handleEnquiry} className="mt-6 space-y-4">
                            <input
                              type="text"
                              value={formData.fullName}
                              onChange={(e) => setFormData((f) => ({ ...f, fullName: e.target.value }))}
                              placeholder="Full Name *"
                              required
                              aria-required="true"
                              className="w-full rounded-lg border border-white/10 bg-[var(--brand-primary)]/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
                            />
                            <input
                              type="tel"
                              value={formData.phoneNumber}
                              onChange={(e) => setFormData((f) => ({ ...f, phoneNumber: e.target.value }))}
                              placeholder="Phone Number"
                              className="w-full rounded-lg border border-white/10 bg-[var(--brand-primary)]/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
                            />
                            <input
                              type="email"
                              value={formData.emailAddress}
                              onChange={(e) => setFormData((f) => ({ ...f, emailAddress: e.target.value }))}
                              placeholder="Email Address"
                              className="w-full rounded-lg border border-white/10 bg-[var(--brand-primary)]/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
                            />
                            <textarea
                              value={formData.message}
                              onChange={(e) => setFormData((f) => ({ ...f, message: e.target.value }))}
                              placeholder="Your message..."
                              rows={4}
                              className="w-full resize-y rounded-lg border border-white/10 bg-[var(--brand-primary)]/40 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
                            />
                            <button
                              type="submit"
                              disabled={submitting}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] py-3 text-sm font-semibold text-[var(--brand-primary)] transition hover:opacity-90 disabled:opacity-50"
                            >
                              {submitting ? 'Sending...' : 'Send Enquiry'} <ArrowRight size={16} />
                            </button>
                          </form>
                        </>
                      ) : (
                        <div className="py-8 text-center">
                          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"><Check size={28} /></span>
                          <h3 className="mt-5 font-display text-2xl">Thank You</h3>
                          <p className="mt-2 text-sm text-[var(--brand-text)]/70">Your enquiry has been submitted. We will get back to you shortly.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </section>
        </main>

        {/* ───────────────────────── Footer ───────────────────────── */}
        <footer className="border-t border-white/10 bg-[var(--brand-primary)] px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={photoUrl(logoUrl)} alt={`${fhName} logo`} className="h-12 w-12 rounded-lg bg-white/95 object-contain p-1" />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-lg bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]"><Building2 size={22} /></span>
                  )}
                  <p className="font-display text-xl">{fhName}</p>
                </div>
                {contact?.description && <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--brand-text)]/60">{contact.description}</p>}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-text)]/45">Contact</p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {(contact?.telephone || contact?.mobile) && (
                    <li><a href={`tel:${contact?.telephone || contact?.mobile}`} onClick={() => trackClick('phone_click')} className="inline-flex items-center gap-2 text-[var(--brand-text)]/80 transition hover:text-[var(--brand-text)]"><Phone size={15} /> {contact?.telephone || contact?.mobile}</a></li>
                  )}
                  {contact?.whatsapp && (
                    <li><a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" onClick={() => trackClick('whatsapp_click')} className="inline-flex items-center gap-2 text-[var(--brand-text)]/80 transition hover:text-[var(--brand-text)]"><MessageSquare size={15} /> WhatsApp</a></li>
                  )}
                  {(contact?.email || brochure.emailAddress) && (
                    <li><a href={`mailto:${contact?.email || brochure.emailAddress}`} className="inline-flex items-center gap-2 text-[var(--brand-text)]/80 transition hover:text-[var(--brand-text)]"><Mail size={15} /> {contact?.email || brochure.emailAddress}</a></li>
                  )}
                  {contact?.website && (
                    <li><a href={contact.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[var(--brand-text)]/80 transition hover:text-[var(--brand-text)]"><Globe size={15} /> {contact.website}</a></li>
                  )}
                  {contact?.address && (
                    <li className="inline-flex items-start gap-2 text-[var(--brand-text)]/80"><MapPin size={15} className="mt-0.5 shrink-0" /> {contact.address}</li>
                  )}
                </ul>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-text)]/45">Quick Links</p>
                <nav className="mt-4 space-y-2.5 text-sm" aria-label="Footer">
                  <a href="/" className="block text-[var(--brand-text)]/80 transition hover:text-[var(--brand-text)]">Home</a>
                  <a href={servicesHref} className="block text-[var(--brand-text)]/80 transition hover:text-[var(--brand-text)]">Our Services</a>
                  <a href="#top" className="block text-[var(--brand-text)]/80 transition hover:text-[var(--brand-text)]">Funeral Packages</a>
                  <a href="#contact" className="block text-[var(--brand-text)]/80 transition hover:text-[var(--brand-text)]">Contact Us</a>
                </nav>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-[var(--brand-text)]/40 sm:flex-row sm:items-center">
              <p>© {new Date().getFullYear()} {fhName}. All rights reserved.</p>
              {fhSlug && (
                <Link to={`/fh/${fhSlug}`} className="inline-flex items-center gap-1 text-[var(--brand-accent)]">
                  <ChevronLeft size={14} /> All services
                </Link>
              )}
              {(!brand || !brand.whiteLabelEnabled) && <p>Powered by Memory Connect</p>}
            </div>
          </div>
        </footer>

        {/* ───────────────────────── Lightbox ───────────────────────── */}
        {lightboxOpen && galleryItems.length > 0 && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Brochure gallery"
            onClick={() => setLightboxOpen(false)}
          >
            <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setLightboxOpen(false)}
                aria-label="Close gallery"
                className="absolute -top-12 right-0 rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <X size={20} />
              </button>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
                <img src={photoUrl(galleryItems[lightboxIndex]?.src || '')} alt={galleryItems[lightboxIndex]?.alt || 'Brochure page'} className="mx-auto max-h-[80vh] w-auto object-contain" />
              </div>
              {galleryItems[lightboxIndex]?.caption && (
                <p className="mt-4 text-center text-sm text-white/70">{galleryItems[lightboxIndex]?.caption}</p>
              )}

              <div className="mt-5 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => moveLightbox(-1)}
                  className="rounded-full bg-white/10 px-5 py-2 text-sm text-white transition hover:bg-white/20"
                  aria-label="Previous page"
                >
                  <span className="inline-block rotate-180">{"\u2039"}</span>
                </button>
                <span className="text-xs text-white/50">{lightboxIndex + 1} / {images.length}</span>
                <button
                  type="button"
                  onClick={() => moveLightbox(1)}
                  className="rounded-full bg-white/10 px-5 py-2 text-sm text-white transition hover:bg-white/20"
                  aria-label="Next page"
                >
                  {"\u203a"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}