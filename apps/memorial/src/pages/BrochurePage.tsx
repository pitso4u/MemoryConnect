import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { marketingApi, photoUrl } from '../lib/api';
import { brandCssVariables, brandFromFuneralHome } from '../lib/brand';
import {
  Phone, Mail, MessageSquare, Download, ChevronLeft, ExternalLink,
} from 'lucide-react';

export default function BrochurePage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<Awaited<ReturnType<typeof marketingApi.getBrochure>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ fullName: '', phoneNumber: '', emailAddress: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');
    marketingApi.getBrochure(slug)
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
  }, [slug]);

  const handleEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.fullName.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!slug) return;
    setSubmitting(true);
    try {
      await marketingApi.submitEnquiry(slug, formData);
      setSubmitted(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
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
  const pageTitle = brochure.seoTitle || `${brochure.title} - ${fhName} | Memory Connect`;
  const pageDesc = brochure.seoDescription || brochure.description?.slice(0, 160) || `Learn more about ${brochure.title} from ${fhName}.`;
  const images = brochure.gallery || [];

  const trackClick = (eventType: string) => {
    marketingApi.trackAnalytics({ eventType, brochureId: brochure.id }).catch(() => {});
  };

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        {brochure.coverImageUrl && <meta property="og:image" content={photoUrl(brochure.coverImageUrl)} />}
      </Helmet>
      <div className="min-h-screen bg-[var(--brand-background)] text-[var(--brand-text)]" style={brandVars}>
        {/* Header */}
        <header className="bg-[var(--brand-primary)] border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
            {contact?.logoUrl && (
              <img src={photoUrl(contact.logoUrl)} alt={fhName} className="max-h-10 max-w-28 rounded object-contain bg-white/95 p-1" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-[var(--brand-text)]/50">{fhName}</p>
              {fhSlug && (
                <Link to={`/fh/${fhSlug}`} className="text-xs text-[var(--brand-accent)] hover:underline inline-flex items-center gap-1">
                  <ChevronLeft size={12} /> All Services
                </Link>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Cover Image */}
          {brochure.coverImageUrl && (
            <div className="rounded-xl overflow-hidden mb-8 aspect-video">
              <img src={photoUrl(brochure.coverImageUrl)} alt={brochure.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Brochure Content */}
          <div className="mb-8">
            {brochure.category && (
              <span className="text-[10px] uppercase tracking-wider text-[var(--brand-accent)] font-medium">{brochure.category.name}</span>
            )}
            <h1 className="font-display text-3xl md:text-4xl mt-2 mb-4">{brochure.title}</h1>
            {brochure.description && (
              <div className="prose prose-sm max-w-none text-[var(--brand-text)]/80 leading-relaxed whitespace-pre-line">
                {brochure.description}
              </div>
            )}
          </div>

          {/* PDF Download */}
          {brochure.pdfUrl && (
            <a
              href={photoUrl(brochure.pdfUrl)}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackClick('pdf_download')}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-accent)] px-5 py-3 text-sm font-medium text-[var(--brand-primary)] transition hover:opacity-90 mb-8"
            >
              <Download size={16} /> Download Brochure (PDF)
            </a>
          )}

          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="mb-8">
              <h2 className="font-display text-xl mb-4">Gallery</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                    className="aspect-square rounded-lg overflow-hidden bg-white/5 cursor-pointer transition hover:ring-2 hover:ring-[var(--brand-accent)]/40"
                  >
                    <img src={photoUrl(img.url)} alt={img.caption || ''} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
              {lightboxOpen && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
                  <div className="max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                    <img src={photoUrl(images[lightboxIndex]?.url || '')} alt="" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
                    {images[lightboxIndex]?.caption && (
                      <p className="text-center text-white/70 text-sm mt-3">{images[lightboxIndex].caption}</p>
                    )}
                    <div className="flex justify-center gap-4 mt-4">
                      <button onClick={() => setLightboxIndex((i) => (i - 1 + images.length) % images.length)} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">Previous</button>
                      <button onClick={() => setLightboxIndex((i) => (i + 1) % images.length)} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">Next</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contact Bar */}
          <div className="flex flex-wrap gap-3 mb-8">
            {brochure.phoneNumber && (
              <a href={`tel:${brochure.phoneNumber}`} onClick={() => trackClick('phone_click')} className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent)] px-5 py-2.5 text-sm font-medium text-[var(--brand-primary)] transition hover:opacity-90">
                <Phone size={16} /> Call {brochure.phoneNumber}
              </a>
            )}
            {brochure.whatsappNumber && (
              <a href={`https://wa.me/${brochure.whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" onClick={() => trackClick('whatsapp_click')} className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/30 px-5 py-2.5 text-sm font-medium text-[var(--brand-accent)] transition hover:bg-[var(--brand-accent)]/10">
                <MessageSquare size={16} /> WhatsApp
              </a>
            )}
            {brochure.emailAddress && (
              <a href={`mailto:${brochure.emailAddress}`} className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/30 px-5 py-2.5 text-sm font-medium text-[var(--brand-accent)] transition hover:bg-[var(--brand-accent)]/10">
                <Mail size={16} /> Email
              </a>
            )}
          </div>

          {/* CTA Button */}
          {brochure.ctaEnabled && brochure.ctaUrl && (
            <a
              href={brochure.ctaUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackClick('cta_click')}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-accent)] px-6 py-3 text-base font-medium text-[var(--brand-primary)] transition hover:opacity-90 mb-8"
            >
              {brochure.ctaText || 'Enquire Now'} <ExternalLink size={16} />
            </a>
          )}

          {/* Enquiry Form */}
          {!submitted ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="font-display text-xl mb-4">Send Enquiry</h2>
              {formError && <p className="text-red-400 text-sm mb-3">{formError}</p>}
              <form onSubmit={handleEnquiry} className="space-y-4">
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="Full Name *"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
                />
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData((f) => ({ ...f, phoneNumber: e.target.value }))}
                  placeholder="Phone Number"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
                />
                <input
                  type="email"
                  value={formData.emailAddress}
                  onChange={(e) => setFormData((f) => ({ ...f, emailAddress: e.target.value }))}
                  placeholder="Email Address"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
                />
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Your message..."
                  rows={4}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)] resize-y"
                />
                <button type="submit" disabled={submitting} className="w-full rounded-lg bg-[var(--brand-accent)] py-3 text-sm font-medium text-[var(--brand-primary)] transition hover:opacity-90 disabled:opacity-50">
                  {submitting ? 'Sending...' : 'Send Enquiry'}
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--brand-accent)]/20 bg-[var(--brand-accent)]/5 p-8 text-center">
              <h2 className="font-display text-xl mb-2">Thank You</h2>
              <p className="text-[var(--brand-text)]/70 text-sm">Your enquiry has been submitted. We will get back to you shortly.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-white/5 px-4 py-6 text-center text-xs text-[var(--brand-text)]/35">
          {fhSlug && (
            <Link to={`/fh/${fhSlug}`} className="inline-flex items-center gap-1 text-[var(--brand-accent)] text-sm mb-3">
              <ChevronLeft size={14} /> Back to {fhName}
            </Link>
          )}
          {(!brand || !brand.whiteLabelEnabled) && <p className="mt-1">Powered by Memory Connect</p>}
        </footer>
      </div>
    </>
  );
}
