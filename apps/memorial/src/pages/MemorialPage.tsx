import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, PublicMemorial, photoUrl } from '../lib/api';
import { brandCssVariables, brandFromFuneralHome } from '../lib/brand';
import {
  BookOpen, Calendar, MapPin, Image, MessageSquare, Heart, Navigation,
} from 'lucide-react';

const sections = [
  { key: 'programme', label: 'Programme', icon: BookOpen },
  { key: 'obituary', label: 'Obituary', icon: BookOpen },
  { key: 'gallery', label: 'Gallery', icon: Image },
  { key: 'directions', label: 'Directions', icon: MapPin },
  { key: 'tributes', label: 'Tributes', icon: MessageSquare },
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

  return (
    <div
      className="min-h-screen bg-[var(--brand-background)] pb-20 text-[var(--brand-text)]"
      style={brandVars}
    >
      {memorial.isPreview && (
        <div className="sticky top-0 z-50 bg-[var(--brand-accent)] px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary)] shadow-lg">
          Private preview · This memorial is not public
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
          <p className="mb-6 font-display text-2xl text-[var(--brand-text)]">{displayName}</p>
          <div className="mx-auto mb-7 h-44 w-44 overflow-hidden rounded-full border-2 border-[var(--brand-accent)]/40 bg-white/5 shadow-2xl shadow-black/30 sm:h-52 sm:w-52">
            {memorial.deceasedPhotoUrl ? (
              <img src={photoUrl(memorial.deceasedPhotoUrl)} alt={`Portrait of ${memorial.deceasedName}`} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-white/10 to-transparent" aria-label="Portrait placeholder">
                <Heart size={52} strokeWidth={1} className="text-[var(--brand-accent)]/45" />
              </div>
            )}
          </div>
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
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-[var(--brand-text)]/70">
            {memorial.serviceDate && (
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {new Date(memorial.serviceDate).toLocaleDateString('en-ZA', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </span>
            )}
            {memorial.serviceVenue && (
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                {memorial.serviceVenue}
              </span>
            )}
          </div>
        </div>
      </header>

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
          </div>
        )}

        {activeSection === 'gallery' && (
          <div>
            {memorial.photos.length === 0 ? (
              <p className="text-center text-[var(--brand-text)]/45 py-8 text-sm">No photos yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {memorial.photos.map((photo) => (
                  <div key={photo.id} className="aspect-square bg-white/5 rounded-lg overflow-hidden">
                    <img src={photoUrl(photo.url)} alt={photo.caption || ''} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
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
    </div>
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
