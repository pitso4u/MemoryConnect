import { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { api, PublicMemorial, photoUrl } from '../lib/api';
import { brandCssVariables, brandFromFuneralHome } from '../lib/brand';
import {
  BookOpen, MapPin, Image, MessageSquare, Heart, Navigation, ArrowRight, Star, Download,
} from 'lucide-react';
import { getAdminUrl, getPublicUrl } from '../lib/config';
import PhotoLightbox from '../components/gallery/PhotoLightbox';
import { initQA, isQAMode } from '../lib/qa';
import AdminQAPanel from '../components/qa/AdminQAPanel';
import ServiceCountdown from '../components/ServiceCountdown';

const sections = [
  { key: 'programme', label: 'Programme', icon: BookOpen },
  { key: 'obituary', label: 'Obituary', icon: BookOpen },
  { key: 'gallery', label: 'Gallery', icon: Image },
  { key: 'directions', label: 'Directions', icon: MapPin },
  { key: 'tributes', label: 'Tributes', icon: MessageSquare },
  { key: 'feedback', label: 'Funeral Feedback', icon: Star },
  { key: 'services', label: 'Funeral Home Services', icon: Navigation },
] as const;

type Section = typeof sections[number]['key'];

const locationTypeLabels = {
  HOME: 'Family Home',
  CHURCH: 'Church',
  CEMETERY: 'Cemetery',
  RECEPTION: 'Reception / After-tears',
  OTHER: 'Other location',
} as const;

const VISITOR_ID_KEY = 'memory_connect_visitor_id';

function getVisitorId() {
  const existing = window.localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(VISITOR_ID_KEY, id);
  return id;
}

export function getDirectionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export default function MemorialPage() {
  const { slug } = useParams<{ slug: string }>();
  const [memorial, setMemorial] = useState<PublicMemorial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<Section>('programme');
  const previewToken = new URLSearchParams(window.location.search).get('preview') || undefined;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const nextPhoto = useCallback(() => {
    setLightboxIndex((prev) => (prev + 1) % memorial!.photos.length);
  }, [memorial]);

  const previousPhoto = useCallback(() => {
    setLightboxIndex((prev) => (prev - 1 + memorial!.photos.length) % memorial!.photos.length);
  }, [memorial]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    let inFlight = false;
    let isFirstLoad = true;

    const fetchMemorial = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await api.getMemorial(slug, previewToken);
        if (active) {
          setMemorial(data);
          setError('');
        }
      } catch (err) {
        if (active && isFirstLoad) {
          setError(err instanceof Error ? err.message : 'Failed to load memorial');
        }
      } finally {
        inFlight = false;
        if (active && isFirstLoad) {
          setLoading(false);
          isFirstLoad = false;
        }
      }
    };

    void fetchMemorial();
    const interval = window.setInterval(() => void fetchMemorial(), 4000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [slug, previewToken]);

  useEffect(() => {
    if (!slug || previewToken || memorial?.isPreview) return;
    try {
      void api.recordMemorialView(slug, getVisitorId()).then((result) => {
        const viewCount = result.viewCount;
        if (typeof viewCount === 'number') {
          setMemorial((current) => current ? { ...current, viewCount } : current);
        }
      });
    } catch {
      // View counting must never block the memorial experience.
    }
  }, [slug, previewToken, memorial?.id, memorial?.isPreview]);

  useEffect(() => {
    void initQA();
  }, []);

  const qaMode = isQAMode();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-up">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-accent)] border-t-transparent" />
          <p className="text-[var(--brand-text)]/70 text-sm">Loading memorial...</p>
        </div>
      </div>
    );
  }

  if (error || !memorial) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <Heart size={32} className="mx-auto mb-4 text-[var(--brand-accent)]/60" />
          <p className="font-display text-xl mb-2">{error === 'This memorial viewing period has ended.' ? 'Viewing period ended' : 'Memorial not found'}</p>
          <p className="text-[var(--brand-text)]/65 text-sm">{error || 'This memorial may not be published yet.'}</p>
        </div>
      </div>
    );
  }

  const currentItem = memorial.programme[memorial.currentProgrammeIndex];
  const nextItem = memorial.programme[memorial.currentProgrammeIndex + 1];
  const activeAnnouncements = memorial.announcements.filter((a) => a.active);
  const visibleSections = memorial.settings.showTributeWall === false
    ? sections.filter((section) => section.key !== 'tributes')
    : sections;
  const brand = memorial.funeralHome.brand || brandFromFuneralHome(memorial.funeralHome);
  const brandVars = brandCssVariables(brand) as React.CSSProperties;
  const displayName = brand.tradingName || brand.companyName || memorial.funeralHome.name;
  const heroImage = brand.memorialHeroUrl || memorial.deceasedPhotoUrl;
  const registerUrl = getAdminUrl('/register');
  const publicHomeUrl = getPublicUrl('/');
  const biography = memorial.biography as unknown as {
    sections?: Array<{ heading?: string; body?: string }>;
    timeline?: Array<{ id?: string; year?: string; title?: string; description?: string }>;
  } | undefined;
  const biographySections = Array.isArray(biography?.sections) ? biography.sections : [];
  const biographyTimeline = Array.isArray(biography?.timeline) ? biography.timeline : [];

  const memorialUrl = `https://memoryconnect.co.za/${slug}`;
  const memorialTitle = `${memorial.deceasedName} - Memorial | Memory Connect South Africa`;
  const memorialDescription = `In loving memory of ${memorial.deceasedName}. View the funeral programme, obituary, photo gallery, service directions and leave a tribute.`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Memory Connect', item: 'https://memoryconnect.co.za/' },
      { '@type': 'ListItem', position: 2, name: 'Memorials', item: 'https://memoryconnect.co.za/memorials' },
      { '@type': 'ListItem', position: 3, name: memorial.deceasedName, item: memorialUrl },
    ],
  };

  const funeralServiceJsonLd = memorial.serviceDate ? {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `Funeral Service of ${memorial.deceasedName}`,
    description: memorial.obituary ? memorial.obituary.slice(0, 200) : `Funeral service for ${memorial.deceasedName}`,
    startDate: memorial.serviceDate,
    location: memorial.serviceVenue ? {
      '@type': 'Place',
      name: memorial.serviceVenue,
    } : undefined,
    performer: displayName,
  } : null;

  return (
    <>
      <Helmet>
        <title>{memorialTitle}</title>
        <meta name="description" content={memorialDescription} />
        <link rel="canonical" href={memorialUrl} />
        <meta property="og:title" content={memorialTitle} />
        <meta property="og:description" content={memorialDescription} />
        <meta property="og:url" content={memorialUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content={memorialTitle} />
        <meta name="twitter:description" content={memorialDescription} />
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
        {funeralServiceJsonLd && <script type="application/ld+json">{JSON.stringify(funeralServiceJsonLd)}</script>}
      </Helmet>
      <div
        className="min-h-screen bg-[var(--brand-background)] pb-20 text-[var(--brand-text)]"
        style={brandVars}
      >
      {memorial.isPreview && (
        <div className="sticky top-0 z-50 bg-[var(--brand-accent)] px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary)] shadow-lg">
          Private preview · This memorial is not public
        </div>
      )}
      {memorial.isDemo && (
        <div className="sticky top-0 z-50 border-b border-[var(--brand-accent)]/25 bg-[var(--brand-primary)]/95 px-4 py-3 text-[var(--brand-secondary)] shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-semibold text-[var(--brand-accent)]">Memory Connect demonstration.</span>{' '}
              Sample content, sanitized locations and demo contact details.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <a href={registerUrl} className="rounded-full bg-[var(--brand-accent)] px-4 py-2 text-[var(--brand-primary)]">Create Funeral Home Account</a>
              <a href="mailto:care@example.co.za?subject=Memory%20Connect%20demo" className="rounded-full border border-white/20 px-4 py-2">Book a Demo</a>
              <a href={publicHomeUrl} className="rounded-full border border-white/20 px-4 py-2">Return to Memory Connect</a>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--brand-primary)] to-[var(--brand-background)]" />
        {heroImage && <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${photoUrl(heroImage)})` }} />}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, var(--brand-accent) 0%, transparent 70%)' }}
        />
        <div className="relative px-6 pt-16 pb-10 text-center animate-fade-up [text-shadow:0_2px_18px_rgba(0,0,0,0.45)]">
          {brand.logoUrl && <img src={photoUrl(brand.logoUrl)} alt={`${displayName} logo`} className="mx-auto mb-4 max-h-16 max-w-48 object-contain" />}
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand-accent)] mb-2">Presented by</p>
          <p className="mb-3 font-display text-2xl text-[var(--brand-text)]">{displayName}</p>
          {memorial.qrPosterUrl && (
            <a
              href={photoUrl(memorial.qrPosterUrl)}
              download
              className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-accent)]/40 px-4 py-1.5 text-xs font-semibold text-[var(--brand-accent)] transition hover:bg-[var(--brand-accent)]/10"
            >
              <Download size={13} /> Download QR Poster
            </a>
          )}
          <div className="mx-auto mb-7 h-44 w-44 overflow-hidden rounded-full border-2 border-[var(--brand-accent)]/40 bg-white/5 shadow-2xl shadow-black/30 sm:h-52 sm:w-52">
            {memorial.deceasedPhotoUrl ? (
              <img src={photoUrl(memorial.deceasedPhotoUrl)} alt={`Portrait of ${memorial.deceasedName}`} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-white/10 to-transparent" aria-label="Portrait placeholder">
                <Heart size={52} strokeWidth={1} className="text-[var(--brand-accent)]/45" />
              </div>
            )}
          </div>
          <p className="mb-2 text-xs uppercase tracking-[0.32em] text-[var(--brand-accent)]">In Loving Memory</p>
          <h1 className="font-display text-4xl md:text-5xl text-[var(--brand-text)] mb-3">
            {memorial.deceasedName}
          </h1>
          {(memorial.dateOfBirth || memorial.dateOfDeath) && (
            <p className="text-[var(--brand-text)]/70 text-sm">
              {memorial.dateOfBirth && new Date(memorial.dateOfBirth).getFullYear()}
              {memorial.dateOfBirth && memorial.dateOfDeath && ' — '}
              {memorial.dateOfDeath && new Date(memorial.dateOfDeath).getFullYear()}
            </p>
          )}
        </div>
      </header>

      {memorial.serviceDate && (
        <ServiceCountdown
          serviceDate={memorial.serviceDate}
          serviceEndTime={memorial.serviceEndTime}
          serviceVenue={memorial.serviceVenue}
          timezone={memorial.timezone}
          livestreamUrl={memorial.settings?.livestreamUrl}
        />
      )}

      {/* Announcements */}
      {activeAnnouncements.length > 0 && (
        <div className="mx-4 -mt-2 mb-4 animate-fade-up animate-fade-up-delay-1">
          {activeAnnouncements.map((a) => (
            <div key={a.id} className="rounded-lg border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10 px-4 py-3 text-sm text-[var(--brand-accent)] mb-2">
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Live Progress */}
      {currentItem && (
        <div className="mx-4 mb-6 rounded-xl border border-white/10 bg-white/5 p-5 animate-fade-up animate-fade-up-delay-1">
          <p className="text-xs uppercase tracking-widest text-[var(--brand-accent)] mb-2">Now Speaking</p>
          <p className="font-display text-2xl text-[var(--brand-text)]">
            {currentItem.speaker || currentItem.title}
          </p>
          {nextItem && (
            <p className="text-sm text-[var(--brand-text)]/55 mt-1">
              Next: {nextItem.speaker || nextItem.title}
            </p>
          )}
          {memorial.programme.length > 0 && (
            <div className="mt-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--brand-accent)] transition-all duration-700"
                style={{ width: `${((memorial.currentProgrammeIndex + 1) / memorial.programme.length) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Section Navigation */}
      <nav className="flex gap-1 px-4 mb-6 overflow-x-auto animate-fade-up animate-fade-up-delay-2">
        {visibleSections.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${
              activeSection === key
                ? 'bg-[var(--brand-accent)] text-[var(--brand-primary)] font-medium'
                : 'bg-white/5 text-[var(--brand-text)]/60 hover:bg-white/10'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="px-4 animate-fade-up animate-fade-up-delay-3">
        {activeSection === 'programme' && (
          <div className="space-y-2">
            {memorial.programme.length === 0 ? (
              <p className="text-center text-[var(--brand-text)]/45 py-8 text-sm">Programme will be available soon</p>
            ) : (
              memorial.programme.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-4 rounded-lg transition ${
                    idx === memorial.currentProgrammeIndex
                      ? 'bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/30'
                      : 'bg-white/5'
                  }`}
                >
                  <span className="text-xs text-[var(--brand-text)]/45 w-5">{idx + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.speaker && <p className="text-xs text-[var(--brand-text)]/65">{item.speaker}</p>}
                  </div>
                  {idx === memorial.currentProgrammeIndex && (
                    <span className="text-[10px] uppercase tracking-wider text-[var(--brand-accent)] font-medium">Live</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeSection === 'obituary' && (
          <div className="bg-white/5 rounded-xl p-6">
            {memorial.obituary ? (
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-[var(--brand-text)]/85">
                {memorial.obituary}
              </div>
            ) : (
              <p className="text-center text-[var(--brand-text)]/45 py-8 text-sm">Obituary not yet available</p>
            )}
            {biographySections.length > 0 && (
              <div className="mt-8 space-y-5">
                {biographySections.map((section) => (
                  <section key={section.heading} className="rounded-lg border border-white/5 bg-white/[0.03] p-5">
                    {section.heading && <h2 className="font-display text-2xl text-[var(--brand-accent)]">{section.heading}</h2>}
                    {section.body && <p className="mt-2 text-sm leading-7 text-[var(--brand-text)]/78">{section.body}</p>}
                  </section>
                ))}
              </div>
            )}
            {biographyTimeline.length > 0 && (
              <div className="mt-8 border-l border-[var(--brand-accent)]/30 pl-5">
                {biographyTimeline.map((item) => (
                  <article key={item.id || `${item.year}-${item.title}`} className="relative mb-5">
                    <span className="absolute -left-[1.72rem] top-1 h-3 w-3 rounded-full bg-[var(--brand-accent)]" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-accent)]">{item.year}</p>
                    <h3 className="mt-1 font-display text-xl">{item.title}</h3>
                    {item.description && <p className="mt-1 text-sm leading-6 text-[var(--brand-text)]/65">{item.description}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'gallery' && (
          <div>
            {memorial.photos.length === 0 ? (
              <p className="text-center text-[var(--brand-text)]/45 py-8 text-sm">No photos yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {memorial.photos.map((photo, idx) => (
                  <figure
                    key={photo.id}
                    className="overflow-hidden rounded-lg bg-white/5 cursor-pointer transition hover:ring-2 hover:ring-[var(--brand-accent)]/40"
                    onClick={() => openLightbox(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openLightbox(idx); }}
                    aria-label={photo.caption || `View photo of ${memorial.deceasedName}`}
                  >
                    <div className="aspect-square">
                      <img src={photoUrl(photo.url)} alt={photo.caption || `Memorial photograph for ${memorial.deceasedName}`} className="w-full h-full object-cover" />
                    </div>
                    {photo.caption && <figcaption className="px-3 py-2 text-xs leading-5 text-[var(--brand-text)]/60">{photo.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
            <PhotoLightbox
              images={memorial.photos.map((p) => ({ url: p.url, caption: p.caption }))}
              currentIndex={lightboxIndex}
              open={lightboxOpen}
              onClose={closeLightbox}
              onNext={nextPhoto}
              onPrevious={previousPhoto}
            />
          </div>
        )}

        {activeSection === 'directions' && (
          <div className="space-y-3">
            {memorial.locations?.length > 0 ? (
              memorial.locations.map((location, index) => (
                <article key={location.id} className="overflow-hidden rounded-xl border border-white/5 bg-white/5">
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]">
                        <MapPin size={20} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--brand-accent)]">
                            {locationTypeLabels[location.type]}
                          </p>
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[var(--brand-text)]/55">Stop {index + 1}</span>
                        </div>
                        <h2 className="mt-1 font-display text-2xl text-[var(--brand-text)]">{location.name}</h2>
                        {location.addressText && <p className="mt-1 text-sm text-[var(--brand-text)]/70">{location.addressText}</p>}
                        {location.notes && (
                          <p className="mt-3 rounded-lg border border-[var(--brand-accent)]/15 bg-[var(--brand-accent)]/5 px-3 py-2.5 text-sm leading-6 text-[var(--brand-text)]/70">
                            {location.notes}
                          </p>
                        )}
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--brand-text)]/55">
                          <Navigation size={12} aria-hidden="true" /> Exact GPS pin saved
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-white/5 p-3">
                    <a
                      href={getDirectionsUrl(location.latitude, location.longitude)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-accent)] px-4 py-3 text-sm font-medium text-[var(--brand-primary)] transition"
                    >
                      <Navigation size={16} aria-hidden="true" />
                      Open Directions
                    </a>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-white/5 bg-white/5 px-6 py-10 text-center">
                <MapPin size={28} className="mx-auto mb-3 text-[var(--brand-accent)]/35" aria-hidden="true" />
                <p className="font-display text-xl text-[var(--brand-text)]">Exact directions are coming soon</p>
                {memorial.serviceVenue && <p className="mt-2 text-sm text-[var(--brand-text)]/70">Venue: {memorial.serviceVenue}</p>}
                <p className="mt-2 text-xs leading-5 text-[var(--brand-text)]/55">The funeral home has not saved a verified GPS pin yet.</p>
              </div>
            )}
          </div>
        )}

        {activeSection === 'tributes' && memorial.settings.showTributeWall !== false && (
          <TributeSection slug={memorial.slug} tributes={memorial.tributes} />
        )}

        {activeSection === 'feedback' && (
          <FuneralFeedbackSection slug={memorial.slug} />
        )}

        {activeSection === 'services' && memorial.funeralHome?.slug && (
          <ServicesSection
            funeralHomeSlug={memorial.funeralHome.slug}
            funeralHomeName={displayName}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 px-4 text-center text-xs text-[var(--brand-text)]/35 pb-8">
        {brand.logoUrl && <img src={photoUrl(brand.logoUrl)} alt={`${displayName} logo`} className="mx-auto mb-4 max-h-14 max-w-40 object-contain" />}
        <p className="text-sm text-[var(--brand-text)]/65">Arranged by {displayName}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {brand.companyPhone && <a href={`tel:${brand.companyPhone}`} className="hover:text-[var(--brand-accent)]">{brand.companyPhone}</a>}
          {brand.whatsapp && <a href={`https://wa.me/${brand.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="hover:text-[var(--brand-accent)]">WhatsApp</a>}
          {brand.companyEmail && <a href={`mailto:${brand.companyEmail}`} className="hover:text-[var(--brand-accent)]">{brand.companyEmail}</a>}
          {brand.websiteUrl && <a href={brand.websiteUrl} target="_blank" rel="noreferrer" className="hover:text-[var(--brand-accent)]">Website</a>}
          {brand.facebookUrl && <a href={brand.facebookUrl} target="_blank" rel="noreferrer" className="hover:text-[var(--brand-accent)]">Facebook</a>}
        </div>
        {brand.physicalAddress && <p className="mt-2">{brand.physicalAddress}</p>}
        {brand.footerText && <p className="mt-2">{brand.footerText}</p>}
        {brand.copyrightText && <p className="mt-1">{brand.copyrightText}</p>}
        <p className="mt-1">Powered by Memory Connect</p>
      </footer>
      {memorial.isDemo && (
        <aside className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl rounded-2xl border border-[var(--brand-accent)]/30 bg-[var(--brand-primary)]/95 p-3 text-[var(--brand-secondary)] shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm"><span className="font-semibold text-[var(--brand-accent)]">R299.99</span> per published funeral</p>
            <div className="flex gap-2">
              <a href={registerUrl} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] px-4 py-2 text-xs font-semibold text-[var(--brand-primary)] sm:flex-none">
                Create Account <ArrowRight size={14} />
              </a>
              <Link to="/" className="inline-flex flex-1 items-center justify-center rounded-full border border-white/15 px-4 py-2 text-xs font-semibold sm:flex-none">
                Landing Page
              </Link>
            </div>
          </div>
        </aside>
      )}

      {qaMode && memorial && (
        <AdminQAPanel
          sections={[
            { key: 'cover', label: 'Cover image', present: Boolean(memorial.deceasedPhotoUrl || memorial.funeralHome.brand?.memorialHeroUrl) },
            { key: 'gallery', label: 'Gallery', present: memorial.photos.length > 0 },
            { key: 'programme', label: 'Programme', present: memorial.programme.length > 0 },
            { key: 'gps', label: 'GPS', present: memorial.locations && memorial.locations.length > 0 },
            { key: 'livestream', label: 'Livestream', present: Boolean(memorial.settings?.livestreamUrl) },
            { key: 'obituary', label: 'Obituary', present: Boolean(memorial.obituary) },
            { key: 'timeline', label: 'Timeline', present: Boolean(memorial.biography?.timeline && memorial.biography.timeline.length > 0) },
            { key: 'contacts', label: 'Contacts', present: Boolean(memorial.funeralHome.phone || memorial.funeralHome.email) },
          ]}
          memorialId={memorial.id}
          status={memorial.status}
        />
      )}
    </div>
    </>
  );
}

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-[var(--brand-text)] mb-2">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`p-1 transition ${
              star <= value ? 'text-[var(--brand-accent)]' : 'text-white/20'
            }`}
          >
            <Star size={24} fill={star <= value ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
    </div>
  );
}

function FuneralFeedbackSection({ slug }: { slug: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [overallRating, setOverallRating] = useState(0);
  const [staffRating, setStaffRating] = useState(0);
  const [organisationRating, setOrganisationRating] = useState(0);
  const [venueRating, setVenueRating] = useState(0);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [useAgain, setUseAgain] = useState<boolean | null>(null);
  const [comments, setComments] = useState('');
  const [allowContact, setAllowContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (overallRating === 0) {
      setError('Please rate your overall experience');
      return;
    }
    try {
      await api.submitFeedback(slug, {
        overallRating,
        staffRating: staffRating || null,
        organisationRating: organisationRating || null,
        venueRating: venueRating || null,
        recommend,
        useAgain,
        comments: comments || null,
        allowContact,
        name: allowContact ? contactName : null,
        phone: allowContact ? contactPhone : null,
        email: allowContact ? contactEmail || null : null,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    }
  };

  if (submitted) {
    return (
      <div className="bg-white/5 rounded-xl p-8 text-center">
        <Star size={40} className="mx-auto mb-4 text-[var(--brand-accent)]" />
        <h2 className="font-display text-2xl text-[var(--brand-text)] mb-2">Thank You</h2>
        <p className="text-[var(--brand-text)]/70 text-sm">
          Your feedback has been submitted. We appreciate your time and input.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white/5 rounded-xl p-6">
      <div>
        <h2 className="font-display text-2xl text-[var(--brand-text)] mb-1">Funeral Feedback</h2>
        <p className="text-sm text-[var(--brand-text)]/60">Help us improve our services by sharing your experience.</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <StarRating value={overallRating} onChange={setOverallRating} label="Overall Experience" />
      <StarRating value={staffRating} onChange={setStaffRating} label="Staff Professionalism" />
      <StarRating value={organisationRating} onChange={setOrganisationRating} label="Organisation" />
      <StarRating value={venueRating} onChange={setVenueRating} label="Venue" />

      <div>
        <p className="text-sm font-medium text-[var(--brand-text)] mb-2">Would you recommend this funeral home?</p>
        <div className="flex gap-3">
          {[{ value: true, label: 'Yes' }, { value: null, label: 'Maybe' }, { value: false, label: 'No' }].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setRecommend(option.value)}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                recommend === option.value
                  ? 'bg-[var(--brand-accent)] text-[var(--brand-primary)]'
                  : 'bg-white/5 text-[var(--brand-text)]/60 hover:bg-white/10'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-[var(--brand-text)] mb-2">Would you use this funeral home again?</p>
        <div className="flex gap-3">
          {[{ value: true, label: 'Yes' }, { value: null, label: 'Maybe' }, { value: false, label: 'No' }].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setUseAgain(option.value)}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                useAgain === option.value
                  ? 'bg-[var(--brand-accent)] text-[var(--brand-primary)]'
                  : 'bg-white/5 text-[var(--brand-text)]/60 hover:bg-white/10'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-[var(--brand-text)] block mb-2">Comments</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Share your thoughts about the funeral service..."
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm min-h-24 resize-y focus:outline-none focus:border-[var(--brand-accent)]"
          maxLength={2000}
        />
        <p className="text-xs text-[var(--brand-text)]/40 mt-1">{comments.length}/2000</p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={allowContact}
          onChange={(e) => setAllowContact(e.target.checked)}
          className="mt-1 accent-[var(--brand-accent)]"
        />
        <span className="text-sm text-[var(--brand-text)]/80">May the funeral home contact me?</span>
      </label>

      {allowContact && (
        <div className="space-y-3 pl-7">
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[var(--brand-accent)]"
            required
          />
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Phone number"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[var(--brand-accent)]"
            required
          />
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Email (optional)"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[var(--brand-accent)]"
          />
        </div>
      )}

      <button
        type="submit"
        className="w-full py-3 bg-[var(--brand-accent)] text-[var(--brand-primary)] rounded-lg text-sm font-medium transition"
      >
        Submit Feedback
      </button>
    </form>
  );
}

function TributeSection({ slug, tributes }: { slug: string; tributes: { id: string; authorName: string; message: string }[] }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await api.submitTribute(slug, { authorName: name, message });
      setSubmitted(true);
      if (!result.pending) {
        setName('');
        setMessage('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  return (
    <div className="space-y-4">
      {tributes.map((t) => (
        <div key={t.id} className="bg-white/5 rounded-lg p-4">
          <p className="text-sm font-medium text-[var(--brand-accent)]">{t.authorName}</p>
          <p className="text-sm text-[var(--brand-text)]/75 mt-1">{t.message}</p>
        </div>
      ))}

      {!submitted ? (
        <form onSubmit={handleSubmit} className="bg-white/5 rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium">Leave a tribute</p>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[var(--brand-accent)]"
            required
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share a memory or condolence..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm min-h-24 resize-y focus:outline-none focus:border-[var(--brand-accent)]"
            required
            minLength={10}
          />
          <button type="submit" className="w-full py-2.5 bg-[var(--brand-accent)] text-[var(--brand-primary)] rounded-lg text-sm font-medium transition">
            Submit Tribute
          </button>
        </form>
      ) : (
        <p className="text-center text-[var(--brand-accent)] text-sm py-4">
          Thank you. Your tribute has been submitted for review.
        </p>
      )}
    </div>
  );
}

function ServicesSection({ funeralHomeSlug, funeralHomeName }: { funeralHomeSlug: string; funeralHomeName: string }) {
  const fhUrl = `/fh/${funeralHomeSlug}`;
  return (
    <div className="border-t border-[var(--brand-accent)]/20 pt-8">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--brand-accent)] mb-3">━━━━━━━━━━━━━━━━━━━━━━━</p>
        <h2 className="font-display text-2xl text-[var(--brand-text)] mb-1">
          Services from {funeralHomeName}
        </h2>
        <p className="text-sm text-[var(--brand-text)]/60 mb-6">
          Explore our full range of funeral service options and packages
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={fhUrl}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent)] px-5 py-2.5 text-sm font-medium text-[var(--brand-primary)] transition hover:opacity-90"
          >
            Explore Our Packages <Navigation size={14} />
          </a>
          <a
            href={`${fhUrl}#promotions`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/30 px-5 py-2.5 text-sm font-medium text-[var(--brand-accent)] transition hover:bg-[var(--brand-accent)]/10"
          >
            Current Promotions
          </a>
          <a
            href={`${fhUrl}#contact`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/30 px-5 py-2.5 text-sm font-medium text-[var(--brand-accent)] transition hover:bg-[var(--brand-accent)]/10"
          >
            Contact Our Team
          </a>
        </div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--brand-accent)] mt-6">━━━━━━━━━━━━━━━━━━━━━━━</p>
      </div>
    </div>
  );
}
