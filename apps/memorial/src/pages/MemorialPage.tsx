import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, PublicMemorial, photoUrl } from '../lib/api';
import {
  BookOpen, Calendar, MapPin, Image, MessageSquare, Heart,
} from 'lucide-react';

const sections = [
  { key: 'programme', label: 'Programme', icon: BookOpen },
  { key: 'obituary', label: 'Obituary', icon: BookOpen },
  { key: 'gallery', label: 'Gallery', icon: Image },
  { key: 'tributes', label: 'Tributes', icon: MessageSquare },
] as const;

type Section = typeof sections[number]['key'];

export default function MemorialPage() {
  const { slug } = useParams<{ slug: string }>();
  const [memorial, setMemorial] = useState<PublicMemorial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<Section>('programme');

  useEffect(() => {
    if (!slug) return;
    api.getMemorial(slug)
      .then(setMemorial)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load memorial'))
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      api.getMemorial(slug).then(setMemorial).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-up">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-parchment/60 text-sm">Loading memorial...</p>
        </div>
      </div>
    );
  }

  if (error || !memorial) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <Heart size={32} className="mx-auto mb-4 text-gold/40" />
          <p className="font-display text-xl mb-2">Memorial not found</p>
          <p className="text-parchment/50 text-sm">{error || 'This memorial may not be published yet.'}</p>
        </div>
      </div>
    );
  }

  const currentItem = memorial.programme[memorial.currentProgrammeIndex];
  const nextItem = memorial.programme[memorial.currentProgrammeIndex + 1];
  const activeAnnouncements = memorial.announcements.filter((a) => a.active);

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-ink-light to-ink" />
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, var(--color-gold) 0%, transparent 70%)' }}
        />
        <div className="relative px-6 pt-16 pb-10 text-center animate-fade-up">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-4">In Loving Memory</p>
          <h1 className="font-display text-4xl md:text-5xl text-parchment mb-3">
            {memorial.deceasedName}
          </h1>
          {(memorial.dateOfBirth || memorial.dateOfDeath) && (
            <p className="text-parchment/60 text-sm">
              {memorial.dateOfBirth && new Date(memorial.dateOfBirth).getFullYear()}
              {memorial.dateOfBirth && memorial.dateOfDeath && ' — '}
              {memorial.dateOfDeath && new Date(memorial.dateOfDeath).getFullYear()}
            </p>
          )}
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-parchment/50">
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
            <div key={a.id} className="bg-gold/10 border border-gold/30 rounded-lg px-4 py-3 text-sm text-gold-light mb-2">
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Live Progress */}
      {currentItem && (
        <div className="mx-4 mb-6 bg-ink-light rounded-xl p-5 border border-white/5 animate-fade-up animate-fade-up-delay-1">
          <p className="text-xs uppercase tracking-widest text-gold mb-2">Now Speaking</p>
          <p className="font-display text-2xl text-parchment">
            {currentItem.speaker || currentItem.title}
          </p>
          {nextItem && (
            <p className="text-sm text-parchment/50 mt-1">
              Next: {nextItem.speaker || nextItem.title}
            </p>
          )}
          {memorial.programme.length > 0 && (
            <div className="mt-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold transition-all duration-700"
                style={{ width: `${((memorial.currentProgrammeIndex + 1) / memorial.programme.length) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Section Navigation */}
      <nav className="flex gap-1 px-4 mb-6 overflow-x-auto animate-fade-up animate-fade-up-delay-2">
        {sections.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${
              activeSection === key
                ? 'bg-gold text-ink font-medium'
                : 'bg-white/5 text-parchment/60 hover:bg-white/10'
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
              <p className="text-center text-parchment/40 py-8 text-sm">Programme will be available soon</p>
            ) : (
              memorial.programme.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-4 rounded-lg transition ${
                    idx === memorial.currentProgrammeIndex
                      ? 'bg-gold/10 border border-gold/30'
                      : 'bg-white/5'
                  }`}
                >
                  <span className="text-xs text-parchment/30 w-5">{idx + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.speaker && <p className="text-xs text-parchment/50">{item.speaker}</p>}
                  </div>
                  {idx === memorial.currentProgrammeIndex && (
                    <span className="text-[10px] uppercase tracking-wider text-gold font-medium">Live</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeSection === 'obituary' && (
          <div className="bg-white/5 rounded-xl p-6">
            {memorial.obituary ? (
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-parchment/80">
                {memorial.obituary}
              </div>
            ) : (
              <p className="text-center text-parchment/40 py-8 text-sm">Obituary not yet available</p>
            )}
          </div>
        )}

        {activeSection === 'gallery' && (
          <div>
            {memorial.photos.length === 0 ? (
              <p className="text-center text-parchment/40 py-8 text-sm">No photos yet</p>
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

        {activeSection === 'tributes' && (
          <TributeSection slug={memorial.slug} tributes={memorial.tributes} />
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 px-4 text-center text-xs text-parchment/30 pb-8">
        <p>Arranged by {memorial.funeralHome.name}</p>
        <p className="mt-1">Powered by MemorialConnect</p>
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
          <p className="text-sm font-medium text-gold-light">{t.authorName}</p>
          <p className="text-sm text-parchment/70 mt-1">{t.message}</p>
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
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-gold/50"
            required
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share a memory or condolence..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm min-h-24 resize-y focus:outline-none focus:border-gold/50"
            required
            minLength={10}
          />
          <button type="submit" className="w-full py-2.5 bg-gold text-ink rounded-lg text-sm font-medium hover:bg-gold-light transition">
            Submit Tribute
          </button>
        </form>
      ) : (
        <p className="text-center text-gold-light text-sm py-4">
          Thank you. Your tribute has been submitted for review.
        </p>
      )}
    </div>
  );
}
