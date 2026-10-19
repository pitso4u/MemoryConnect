import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { marketingApi, photoUrl } from '../lib/api';
import { brandCssVariables, brandFromFuneralHome } from '../lib/brand';
import {
  Phone, Mail, MapPin, Clock, Globe, ChevronRight, ExternalLink, FileText,
  MessageSquare, Smartphone, Facebook, Instagram, Linkedin, Video,
} from 'lucide-react';

export default function FuneralHomeServicesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<Awaited<ReturnType<typeof marketingApi.getFuneralHomePage>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');
    marketingApi.getFuneralHomePage(slug)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load page'))
      .finally(() => setLoading(false));
  }, [slug]);

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
          <p className="font-display text-xl mb-2">Page not found</p>
          <p className="text-[var(--brand-text)]/65 text-sm">{error || 'This funeral home services page does not exist.'}</p>
          <Link to="/" className="mt-4 inline-flex items-center gap-2 text-[var(--brand-accent)] text-sm">Return to Memory Connect</Link>
        </div>
      </div>
    );
  }

  const { funeralHome, contact, brochures, promotions, branches } = data;
  const brand = funeralHome.brand || brandFromFuneralHome(funeralHome as any);
  const brandVars = brandCssVariables(brand) as React.CSSProperties;
  const displayName = contact?.businessName || funeralHome.tradingName || funeralHome.name;
  const pageTitle = `${displayName} - Services | Memory Connect`;
  const pageDescription = contact?.description?.slice(0, 160) || `Browse services and packages from ${displayName}.`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
      </Helmet>
      <div className="min-h-screen bg-[var(--brand-background)] text-[var(--brand-text)]" style={brandVars}>
        {/* Hero */}
        <header className="relative overflow-hidden bg-gradient-to-b from-[var(--brand-primary)] to-[var(--brand-background)]">
          {contact?.coverImageUrl && (
            <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${photoUrl(contact.coverImageUrl)})` }} />
          )}
          <div className="relative px-6 py-16 text-center animate-fade-up">
            {contact?.logoUrl && (
              <img src={photoUrl(contact.logoUrl)} alt={`${displayName} logo`} className="mx-auto mb-6 max-h-20 max-w-52 rounded-lg bg-white/95 p-2 object-contain" />
            )}
            <h1 className="font-display text-3xl md:text-5xl text-[var(--brand-text)] mb-4">{displayName}</h1>
            {contact?.description && (
              <p className="max-w-2xl mx-auto text-[var(--brand-text)]/75 leading-relaxed">{contact.description}</p>
            )}
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 pb-20 space-y-12 -mt-4 relative z-10">
          {/* Quick Contact Bar */}
          {contact && (
            <div className="flex flex-wrap gap-3 justify-center animate-fade-up">
              {contact.telephone && (
                <a href={`tel:${contact.telephone}`} className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent)] px-5 py-2.5 text-sm font-medium text-[var(--brand-primary)] transition hover:opacity-90">
                  <Phone size={16} /> Call
                </a>
              )}
              {contact.whatsapp && (
                <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/30 px-5 py-2.5 text-sm font-medium text-[var(--brand-accent)] transition hover:bg-[var(--brand-accent)]/10">
                  <MessageSquare size={16} /> WhatsApp
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/30 px-5 py-2.5 text-sm font-medium text-[var(--brand-accent)] transition hover:bg-[var(--brand-accent)]/10">
                  <Mail size={16} /> Email
                </a>
              )}
              {contact.address && (
                <a href={`https://www.google.com/maps/search/${encodeURIComponent(contact.address)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/30 px-5 py-2.5 text-sm font-medium text-[var(--brand-accent)] transition hover:bg-[var(--brand-accent)]/10">
                  <MapPin size={16} /> Get Directions
                </a>
              )}
            </div>
          )}

          {/* Digital Brochures */}
          {contact?.enableBrochures !== false && brochures.length > 0 && (
            <section className="animate-fade-up">
              <h2 className="font-display text-2xl md:text-3xl text-center mb-2">Digital Brochures</h2>
              <p className="text-center text-[var(--brand-text)]/60 text-sm mb-8">Browse our range of services and packages</p>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {brochures.map((brochure) => (
                  <Link
                    key={brochure.id}
                    to={funeralHome.slug ? `/services/${funeralHome.slug}/${brochure.slug}` : `/services/${brochure.slug}`}
                    className="group rounded-xl border border-white/10 bg-white/5 overflow-hidden transition hover:border-[var(--brand-accent)]/40 hover:bg-white/10"
                  >
                    {brochure.coverImageUrl ? (
                      <div className="aspect-video overflow-hidden">
                        <img src={photoUrl(brochure.coverImageUrl)} alt={brochure.title} className="w-full h-full object-cover transition group-hover:scale-105" loading="lazy" />
                      </div>
                    ) : (
                      <div className="aspect-video flex items-center justify-center bg-[var(--brand-accent)]/5">
                        <FileText size={40} className="text-[var(--brand-accent)]/30" />
                      </div>
                    )}
                    <div className="p-4">
                      {brochure.category && (
                        <span className="text-[10px] uppercase tracking-wider text-[var(--brand-accent)] font-medium">{brochure.category.name}</span>
                      )}
                      <h3 className="font-display text-lg mt-1 group-hover:text-[var(--brand-accent)] transition">{brochure.title}</h3>
                      <div className="flex items-center gap-2 mt-3 text-xs text-[var(--brand-text)]/50">
                        <span>Learn more</span>
                        <ChevronRight size={14} className="transition group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Promotions */}
          {contact?.enablePromotions !== false && promotions.length > 0 && (
            <section className="animate-fade-up">
              <h2 className="font-display text-2xl md:text-3xl text-center mb-2">Current Promotions</h2>
              <p className="text-center text-[var(--brand-text)]/60 text-sm mb-8">Special offers and announcements</p>
              <div className="grid gap-6 sm:grid-cols-2">
                {promotions.map((promo) => (
                  <div key={promo.id} className="rounded-xl border border-[var(--brand-accent)]/20 bg-[var(--brand-accent)]/5 overflow-hidden">
                    {promo.bannerImageUrl && (
                      <div className="aspect-[3/1] overflow-hidden">
                        <img src={photoUrl(promo.bannerImageUrl)} alt={promo.title} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-xl">{promo.title}</h3>
                        <span className="shrink-0 rounded-full bg-[var(--brand-accent)]/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--brand-accent)]">Active</span>
                      </div>
                      {promo.description && <p className="text-sm text-[var(--brand-text)]/70 mt-2">{promo.description}</p>}
                      {promo.buttonText && promo.buttonUrl && (
                        <a href={promo.buttonUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-4 rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-medium text-[var(--brand-primary)] transition hover:opacity-90">
                          {promo.buttonText} <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Branches */}
          {contact?.enableBranches !== false && branches.length > 0 && (
            <section className="animate-fade-up">
              <h2 className="font-display text-2xl md:text-3xl text-center mb-2">Our Branches</h2>
              <p className="text-center text-[var(--brand-text)]/60 text-sm mb-8">Find us at a location near you</p>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {branches.map((branch) => (
                  <div key={branch.id} className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <h3 className="font-display text-lg mb-1">{branch.name}</h3>
                    {branch.manager && <p className="text-xs text-[var(--brand-text)]/50 mb-2">Manager: {branch.manager}</p>}
                    {branch.address && <p className="text-sm text-[var(--brand-text)]/70 mb-1">{branch.address}</p>}
                    {(branch.city || branch.province) && (
                      <p className="text-sm text-[var(--brand-text)]/70 mb-3">{[branch.city, branch.province].filter(Boolean).join(', ')}</p>
                    )}
                    <div className="space-y-1.5">
                      {branch.phone && <a href={`tel:${branch.phone}`} className="flex items-center gap-2 text-sm text-[var(--brand-accent)]"><Phone size={14} />{branch.phone}</a>}
                      {branch.whatsapp && <a href={`https://wa.me/${branch.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-[var(--brand-accent)]"><MessageSquare size={14} />WhatsApp</a>}
                      {branch.email && <a href={`mailto:${branch.email}`} className="flex items-center gap-2 text-sm text-[var(--brand-accent)]"><Mail size={14} />{branch.email}</a>}
                    </div>
                    {branch.googleMapsUrl && (
                      <a href={branch.googleMapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--brand-accent)]">
                        <MapPin size={12} /> Open in Google Maps
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Contact Section */}
          {contact && (
            <section className="animate-fade-up rounded-xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="font-display text-2xl md:text-3xl text-center mb-6">Contact Us</h2>
              <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
                {contact.address && (
                  <div className="flex gap-3">
                    <MapPin size={20} className="shrink-0 mt-0.5 text-[var(--brand-accent)]" />
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <p className="text-sm text-[var(--brand-text)]/70">{contact.address}</p>
                    </div>
                  </div>
                )}
                {contact.telephone && (
                  <div className="flex gap-3">
                    <Phone size={20} className="shrink-0 mt-0.5 text-[var(--brand-accent)]" />
                    <div>
                      <p className="text-sm font-medium">Telephone</p>
                      <a href={`tel:${contact.telephone}`} className="text-sm text-[var(--brand-accent)]">{contact.telephone}</a>
                    </div>
                  </div>
                )}
                {contact.mobile && (
                  <div className="flex gap-3">
                    <Smartphone size={20} className="shrink-0 mt-0.5 text-[var(--brand-accent)]" />
                    <div>
                      <p className="text-sm font-medium">Mobile</p>
                      <a href={`tel:${contact.mobile}`} className="text-sm text-[var(--brand-accent)]">{contact.mobile}</a>
                    </div>
                  </div>
                )}
                {contact.email && (
                  <div className="flex gap-3">
                    <Mail size={20} className="shrink-0 mt-0.5 text-[var(--brand-accent)]" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <a href={`mailto:${contact.email}`} className="text-sm text-[var(--brand-accent)]">{contact.email}</a>
                    </div>
                  </div>
                )}
                {contact.website && (
                  <div className="flex gap-3">
                    <Globe size={20} className="shrink-0 mt-0.5 text-[var(--brand-accent)]" />
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <a href={contact.website} target="_blank" rel="noreferrer" className="text-sm text-[var(--brand-accent)]">{contact.website}</a>
                    </div>
                  </div>
                )}
                {contact.businessHours && (
                  <div className="flex gap-3">
                    <Clock size={20} className="shrink-0 mt-0.5 text-[var(--brand-accent)]" />
                    <div>
                      <p className="text-sm font-medium">Business Hours</p>
                      <p className="text-sm text-[var(--brand-text)]/70 whitespace-pre-line">{contact.businessHours}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Social Links */}
              <div className="flex flex-wrap justify-center gap-4 mt-8">
                {contact.facebook && (
                  <a href={contact.facebook} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5">
                    <Facebook size={16} className="text-[var(--brand-accent)]" /> Facebook
                  </a>
                )}
                {contact.instagram && (
                  <a href={contact.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5">
                    <Instagram size={16} className="text-[var(--brand-accent)]" /> Instagram
                  </a>
                )}
                {contact.tiktok && (
                  <a href={contact.tiktok} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5">
                    <Video size={16} className="text-[var(--brand-accent)]" /> TikTok
                  </a>
                )}
                {contact.linkedin && (
                  <a href={contact.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5">
                    <Linkedin size={16} className="text-[var(--brand-accent)]" /> LinkedIn
                  </a>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <footer className="px-4 py-8 text-center text-xs text-[var(--brand-text)]/35 border-t border-white/5">
          {contact?.logoUrl && (
            <img src={photoUrl(contact.logoUrl)} alt={displayName} className="mx-auto mb-4 max-h-14 max-w-40 object-contain" />
          )}
          <p className="text-sm text-[var(--brand-text)]/65">{displayName}</p>
          {(funeralHome as any)?.brand?.whiteLabelEnabled ? null : (
            <p className="mt-1">Powered by Memory Connect</p>
          )}
        </footer>
      </div>
    </>
  );
}
