import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { eventsApi, getVisitorId, photoUrl, ApiError } from '../lib/api';
import {
  EVENT_SECTION_META,
  EVENT_TYPE_LABELS,
  presentationFor,
  sectionsFor,
  type EventType,
} from '@memorialconnect/event-shared';

interface Photo { id: string; url: string; caption?: string | null }
interface GuestMessage { id: string; authorName: string; message: string }
interface Location { id: string; name: string; address?: string | null; latitude?: number | null; longitude?: number | null; notes?: string | null }
interface AgendaItem { id: string; title: string; description?: string | null; startTime?: string | null; endTime?: string | null; location?: string | null }

const THEME_HERO: Record<string, { hero: string; dark: boolean }> = {
  ELEGANT: { hero: 'theme-hero-elegant', dark: false },
  CELEBRATION: { hero: 'theme-hero-celebration', dark: true },
  MODERN: { hero: 'theme-hero-modern', dark: true },
  CLASSIC: { hero: 'theme-hero-classic', dark: false },
  CORPORATE: { hero: 'theme-hero-corporate', dark: true },
};

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

function mapLink(loc: Location): string {
  if (loc.latitude != null && loc.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.name} ${loc.address ?? ''}`)}`;
}

export default function PublicEventPage() {
  const { slug = '', id = '' } = useParams();
  const previewMode = Boolean(id);
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');

  useEffect(() => {
    (previewMode ? eventsApi.getEvent(id) : eventsApi.publicEvent(slug))
      .then((data) => {
        setEvent(data);
        if (!previewMode) eventsApi.recordView(slug, getVisitorId()).catch(() => undefined);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && (err.status === 410 || err.code === 'EVENT_EXPIRED')) {
          setExpired(true);
        } else {
          setError('This event page could not be found. It may be unpublished.');
        }
      });
  }, [slug, id, previewMode]);

  async function share() {
    if (previewMode) return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: String(event?.title ?? 'Event'), url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      eventsApi.recordShare(slug).catch(() => undefined);
    } catch {
      // user cancelled the share sheet
    }
  }

  async function downloadQr() {
    if (previewMode) return;
    const res = await fetch(eventsApi.qrUrl(slug));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-qr-${slug}.png`;
    a.click();
    URL.revokeObjectURL(url);
    eventsApi.recordQrScan(slug).catch(() => undefined);
  }

  async function submitMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !message.trim()) return;
    setSending(true);
    try {
      await eventsApi.postMessage(slug, { authorName: authorName.trim(), message: message.trim() });
      setEvent(await eventsApi.publicEvent(slug));
      setAuthorName('');
      setMessage('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  }

  if (error || expired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 text-center max-w-md">
          <h1 className="font-display text-2xl font-bold">{expired ? 'This celebration has ended' : 'Event not found'}</h1>
          <p className="text-gray-600 mt-2">{expired ? 'Thank you for celebrating with us. This event page is no longer available.' : error}</p>
          <Link to="/" className="btn-primary inline-block mt-4 text-sm">Back home</Link>
        </div>
      </div>
    );
  }
  if (!event) return <div className="min-h-screen flex items-center justify-center text-gray-500" role="status">Loading celebration…</div>;

  // Everything below is driven by the shared catalogue: sections, headings,
  // and per-type presentation come from event-shared, never from branches.
  const type = String(event.eventType) as EventType;
  const sections = sectionsFor(type);
  const presentation = presentationFor(type);
  const titleOf = (key: string) => (key === 'story' || key === 'about' ? presentation.storyTitle : EVENT_SECTION_META[key]?.title ?? key);
  const topics = [
    ...(sections.includes('story') || sections.includes('about') ? [{ key: 'about', title: titleOf(sections.includes('story') ? 'story' : 'about') }] : []),
    ...(sections.includes('agenda') ? [{ key: 'agenda', title: EVENT_SECTION_META.agenda.title }] : []),
    ...(sections.includes('venue') ? [{ key: 'venue', title: EVENT_SECTION_META.venue.title }] : []),
    ...(sections.includes('photos') ? [{ key: 'photos', title: EVENT_SECTION_META.photos.title }] : []),
    ...(sections.includes('messages') ? [{ key: 'messages', title: EVENT_SECTION_META.messages.title }] : []),
  ];
  const activeTopic = topics.some((topic) => topic.key === selectedTopic) ? selectedTopic : topics[0]?.key;
  const photos = (event.photos as Photo[]) ?? [];
  const messages = (event.messages as GuestMessage[]) ?? [];
  const locations = (event.locations as Location[]) ?? [];
  const agenda = (event.agenda as AgendaItem[]) ?? [];
  const theme = THEME_HERO[String(event.theme)] ?? THEME_HERO.CELEBRATION;
  const isDemo = event.isDemo === true;
  const dateLine = [formatDate(event.startDateTime as string | null), formatTime(event.startDateTime as string | null)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="public-event-page min-h-screen pb-16">
      {previewMode ? <div className="event-preview-banner"><span><strong>Preview mode</strong> · Only you can see this draft.</span><Link to={`/events/${id}`}>Back to editing</Link></div> : null}
      <header className={`public-event-hero ${theme.hero} ${theme.dark ? 'text-white' : 'text-gray-900'}`} style={event.coverImage ? { backgroundImage: `linear-gradient(90deg, rgba(22,15,31,.75), rgba(22,15,31,.2)), url("${photoUrl(String(event.coverImage))}")` } : undefined}>
        <div className="public-event-hero-inner max-w-3xl mx-auto px-4 py-14 md:py-24 animate-fade-up">
          <p className="eyebrow opacity-80">{EVENT_TYPE_LABELS[type] ?? type}<span className="event-hero-rule" /></p>
          <h1 className="font-display text-4xl md:text-6xl font-bold mt-4 leading-tight">{String(event.title)}</h1>
          <p className="mt-3 text-lg opacity-95">{presentation.kicker}</p>
          {event.hostName ? <p className="mt-1 text-xl font-semibold">Hosted by {String(event.hostName)}</p> : null}
          <div className="event-facts">
            {dateLine ? <p><span aria-hidden="true">◷</span>{dateLine}</p> : null}
            {locations[0] ? <p><span aria-hidden="true">⌖</span>{locations[0].name}</p> : null}
          </div>
          <div className="mt-7 flex flex-col sm:flex-row gap-2">
            {sections.includes('agenda') && agenda.length > 0 ? (
              <button onClick={() => setSelectedTopic('agenda')} className={theme.dark ? 'bg-white text-amber-800 font-semibold rounded-xl px-6 py-2.5' : 'btn-primary'}>View Programme</button>
            ) : null}
            <button onClick={share} className={theme.dark ? 'border border-white/70 rounded-xl px-6 py-2.5 font-semibold' : 'btn-secondary'} aria-label="Share this event">Share</button>
          </div>
        </div>
      </header>

      <main className="public-event-content max-w-3xl mx-auto px-4 pt-5">
        <div className="public-topic-tabs" role="tablist" aria-label="Event details">
          {topics.map((topic, index) => <button key={topic.key} id={`tab-${topic.key}`} role="tab" aria-selected={activeTopic === topic.key} aria-controls={`panel-${topic.key}`} tabIndex={activeTopic === topic.key ? 0 : -1} className={`public-topic-tab ${activeTopic === topic.key ? 'is-active' : ''}`} onClick={() => setSelectedTopic(topic.key)} onKeyDown={(e) => {
            if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            const nextIndex = e.key === 'Home' ? 0 : e.key === 'End' ? topics.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : topics.length - 1)) % topics.length;
            const nextTopic = topics[nextIndex];
            setSelectedTopic(nextTopic.key);
            document.getElementById(`tab-${nextTopic.key}`)?.focus();
          }}>{topic.title}</button>)}
        </div>

        <section id="panel-about" role="tabpanel" aria-labelledby="tab-about" hidden={activeTopic !== 'about'} className="card p-5 md:p-7">
          <p className="section-kicker">THE STORY</p>
          <h2 className="font-display text-2xl font-bold mt-2">{titleOf(sections.includes('story') ? 'story' : 'about')}</h2>
          <p className="mt-3 text-gray-700 leading-relaxed whitespace-pre-line">{event.description ? String(event.description) : EVENT_SECTION_META[sections.includes('story') ? 'story' : 'about']?.emptyHint}</p>
        </section>

        <section id="panel-agenda" role="tabpanel" aria-labelledby="tab-agenda" hidden={activeTopic !== 'agenda'} className="card p-5 md:p-7">
          <p className="section-kicker">THE DAY, AT A GLANCE</p><h2 className="font-display text-2xl font-bold mt-2">{EVENT_SECTION_META.agenda.title}</h2>
          {agenda.length ? <ol className="event-agenda-list mt-5 list-none p-0">{agenda.map((a) => <li key={a.id} className="event-agenda-item"><span className="event-agenda-time">{[a.startTime, a.endTime].filter(Boolean).join(' – ') || '•'}</span><div><p className="font-semibold">{a.title}</p>{a.description ? <p className="text-sm text-gray-600 mt-1">{a.description}</p> : null}{a.location ? <p className="text-xs text-gray-500 mt-1">{a.location}</p> : null}</div></li>)}</ol> : <p className="mt-3 text-gray-600">{EVENT_SECTION_META.agenda.emptyHint}</p>}
        </section>

        <section id="panel-venue" role="tabpanel" aria-labelledby="tab-venue" hidden={activeTopic !== 'venue'} className="card p-5 md:p-7">
          <p className="section-kicker">JOIN US HERE</p><h2 className="font-display text-2xl font-bold mt-2">{EVENT_SECTION_META.venue.title}</h2>
          {locations.length ? <div className="mt-5 space-y-5">{locations.map((l) => <div key={l.id} className="event-venue-item"><div><p className="font-semibold text-lg">{l.name}</p>{l.address ? <p className="text-sm text-gray-600 mt-1">{l.address}</p> : null}{l.notes ? <p className="text-sm text-gray-500 mt-2">{l.notes}</p> : null}</div><a href={mapLink(l)} target="_blank" rel="noreferrer" className="btn-secondary text-sm" aria-label={`Get directions to ${l.name}`}>Get directions ↗</a></div>)}</div> : <p className="mt-3 text-gray-600">{EVENT_SECTION_META.venue.emptyHint}</p>}
        </section>

        <section id="panel-photos" role="tabpanel" aria-labelledby="tab-photos" hidden={activeTopic !== 'photos'} className="card p-5 md:p-7">
          <p className="section-kicker">MOMENTS TO KEEP</p><h2 className="font-display text-2xl font-bold mt-2">{EVENT_SECTION_META.photos.title}</h2>
          {photos.length ? <div className="event-photo-grid mt-5">{photos.map((p) => <figure key={p.id} className="event-photo"><img src={photoUrl(p.url)} alt={p.caption ?? `Photo from ${String(event.title)}`} loading="lazy" />{p.caption ? <figcaption>{p.caption}</figcaption> : null}</figure>)}</div> : <p className="mt-3 text-gray-600">{EVENT_SECTION_META.photos.emptyHint}</p>}
        </section>

        {sections.includes('messages') && <section id="panel-messages" role="tabpanel" aria-labelledby="tab-messages" hidden={activeTopic !== 'messages'} className="card p-5 md:p-7">
          <p className="section-kicker">KIND WORDS, KEPT CLOSE</p>
            <h2 id="messages-heading" className="font-display text-xl font-bold">{EVENT_SECTION_META.messages.title}</h2>
            {previewMode ? (
              <p className="mt-3 text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-xl p-3" role="note">Guest messages are shown here as they will appear after publishing. Guests cannot post messages in preview mode.</p>
            ) : isDemo ? (
              <p className="mt-3 text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-xl p-3" role="note">
                Messages are disabled on example pages — create your own event to collect guest messages.
              </p>
            ) : (
            <form onSubmit={submitMessage} className="mt-3 space-y-2" aria-label="Leave a message">
              <div>
                <label className="label" htmlFor="msg-name">Your name</label>
                <input id="msg-name" className="input" placeholder="e.g. Aunt Maria" value={authorName} onChange={(e) => setAuthorName(e.target.value)} maxLength={120} required />
              </div>
              <div>
                <label className="label" htmlFor="msg-text">Your message</label>
                <textarea id="msg-text" className="input" placeholder="Share your wishes…" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} required />
              </div>
              <button className="btn-primary text-sm" disabled={sending}>{sending ? 'Sending…' : 'Leave a message'}</button>
            </form>
            )}
            <div className="event-message-list mt-5">
              {messages.length === 0 ? <p className="text-sm text-gray-500">{EVENT_SECTION_META.messages.emptyHint}</p> : null}
              {messages.map((m) => (
                <blockquote key={m.id} className="bg-amber-50 rounded-xl p-3 m-0">
                  <p className="text-sm">“{m.message}”</p>
                  <footer className="font-semibold text-sm mt-1">— {m.authorName}</footer>
                </blockquote>
              ))}
            </div>
        </section>}

        {!previewMode ? <section className="card p-5 md:p-6 text-center" aria-labelledby="share-heading">
          <h2 id="share-heading" className="font-display text-xl font-bold">Share this event</h2>
          <p className="text-sm text-gray-600 mt-1">One link for WhatsApp, SMS, Facebook and Instagram.</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={share} className="btn-primary text-sm" aria-label="Share this event">{copied ? 'Link copied!' : 'Share'}</button>
            <button onClick={downloadQr} className="btn-secondary text-sm" aria-label="Download QR code">Download QR</button>
          </div>
        </section> : null}
      </main>

      <footer className="public-event-footer"><img src="/events-connect-mark.png" alt="" /><span><strong>Events Connect</strong><small>by MemoryConnect</small></span></footer>
    </div>
  );
}
