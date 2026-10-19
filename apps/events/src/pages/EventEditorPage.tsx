import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { eventsApi, photoUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  EVENT_THEMES,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  presentationFor,
  type EventType,
  type EventPerformance,
} from '@memorialconnect/event-shared';
import EventPerformancePanel from '../components/EventPerformancePanel';

interface AgendaItem { id: string; title: string; startTime?: string | null }
interface EventLocation { id: string; name: string; address?: string | null }
interface EventPhoto { id: string; url: string; caption?: string | null }
interface GuestMessage { id: string; authorName: string; message: string; approved: boolean }

const THEME_BLURBS: Record<string, string> = {
  CLASSIC: 'Warm and timeless',
  MODERN: 'Bold and contemporary',
  ELEGANT: 'Soft and refined',
  CELEBRATION: 'Bright and joyful',
  CORPORATE: 'Sharp and professional',
};

const TABS = ['Details', 'Programme', 'Location', 'Photos', 'Messages', 'Appearance', 'Analytics'] as const;

export default function EventEditorPage({ isNewRoute = false }: { isNewRoute?: boolean }) {
  const { id = '' } = useParams();
  const isNew = isNewRoute || id === 'new';
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (!loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-6 text-center">
          <p>Please log in to manage events.</p>
          <Link to="/login" className="btn-primary inline-block mt-3 text-sm">Log in</Link>
        </div>
      </div>
    );
  }

  return isNew ? <CreateFlow navigate={navigate} /> : <EditView id={id} navigate={navigate} loading={loading} />;
}

// ── Creation: simple progressive flow ────────────────────────────────────────

function CreateFlow({ navigate }: { navigate: (path: string) => void }) {
  const [step, setStep] = useState(0);
  const [eventType, setEventType] = useState<EventType>('WEDDING');
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState('');
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [theme, setTheme] = useState('CELEBRATION');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const steps = ['Occasion', 'Details', 'Location', 'Style'];

  async function create() {
    if (title.trim().length < 2) {
      setError('Give your event a title (at least 2 characters).');
      setStep(1);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const created = (await eventsApi.createEvent({
        eventType,
        title: title.trim(),
        hostName: hostName.trim() || null,
        description: description.trim() || null,
        startDateTime: start ? new Date(start).toISOString() : null,
        theme,
      })) as { id: string };
      if (locName.trim()) {
        await eventsApi.addLocation(created.id, { name: locName.trim(), address: locAddress.trim() || null });
      }
      navigate(`/events/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create event');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="editor-shell min-h-screen max-w-3xl mx-auto px-4 py-8">
      <Link to="/dashboard" className="text-sm text-amber-800 font-semibold">← My events</Link>
      <h1 className="font-display text-3xl font-bold mt-2">Create your event</h1>
      <ol className="flex gap-1.5 mt-4 list-none p-0" aria-label="Creation progress">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <span className={`block h-1.5 rounded-full ${i <= step ? 'bg-amber-800' : 'bg-amber-100'}`} aria-hidden="true" />
            <span className={`text-xs font-semibold ${i === step ? 'text-amber-900' : 'text-gray-400'}`}>{s}</span>
          </li>
        ))}
      </ol>

      {error ? <p className="text-sm text-red-600 mt-3" role="alert">{error}</p> : null}

      {step === 0 && (
        <section className="mt-5" aria-labelledby="step-type">
          <h2 id="step-type" className="font-display text-xl font-bold">What are you celebrating?</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3" role="radiogroup" aria-label="Event type">
            {EVENT_TYPES.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={eventType === t}
                onClick={() => setEventType(t)}
                className={`${presentationFor(t).cardAccent} rounded-2xl p-4 text-left border-2 ${eventType === t ? 'border-amber-800' : 'border-transparent'}`}
              >
                <span className="font-display font-bold">{EVENT_TYPE_LABELS[t]}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="card p-5 mt-5 space-y-3" aria-labelledby="step-details">
          <h2 id="step-details" className="font-display text-xl font-bold">Tell us about your event</h2>
          <div>
            <label className="label" htmlFor="ev-title">Event title</label>
            <input id="ev-title" className="input" placeholder="e.g. Sarah & John's Wedding" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
          </div>
          <div>
            <label className="label" htmlFor="ev-host">Host / celebrant</label>
            <input id="ev-host" className="input" placeholder="e.g. Sarah & John" value={hostName} onChange={(e) => setHostName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ev-desc">Description</label>
            <textarea id="ev-desc" className="input" placeholder="What should guests know?" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div>
            <label className="label" htmlFor="ev-start">Date and time</label>
            <input id="ev-start" className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card p-5 mt-5 space-y-3" aria-labelledby="step-location">
          <h2 id="step-location" className="font-display text-xl font-bold">Where is it happening?</h2>
          <p className="text-sm text-gray-600">You can skip this and add it later.</p>
          <div>
            <label className="label" htmlFor="ev-loc">Venue name</label>
            <input id="ev-loc" className="input" placeholder="e.g. Johannesburg Country Club" value={locName} onChange={(e) => setLocName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ev-addr">Address</label>
            <input id="ev-addr" className="input" placeholder="e.g. Auckland Park, Johannesburg" value={locAddress} onChange={(e) => setLocAddress(e.target.value)} />
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mt-5" aria-labelledby="step-style">
          <h2 id="step-style" className="font-display text-xl font-bold">Choose your style</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3" role="radiogroup" aria-label="Theme">
            {EVENT_THEMES.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={theme === t}
                onClick={() => setTheme(t)}
                className={`rounded-2xl p-4 text-left border-4 theme-hero-${t.toLowerCase()} ${theme === t ? 'border-amber-800' : 'border-transparent'}`}
              >
                <span className="font-display font-bold text-sm bg-white/80 rounded px-1">{t}</span>
                <span className="block text-xs mt-1 bg-white/80 rounded px-1">{THEME_BLURBS[t]}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-2 mt-6">
        {step > 0 ? <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">Back</button> : null}
        {step < 3 ? (
          <button onClick={() => setStep(step + 1)} className="btn-primary flex-1">Continue</button>
        ) : (
          <button onClick={create} disabled={busy} className="btn-primary flex-1">{busy ? 'Creating…' : 'Create Event'}</button>
        )}
      </div>
    </div>
  );
}

// ── Editing: tabbed organiser dashboard ──────────────────────────────────────

function EditView({ id, navigate, loading }: { id: string; navigate: (p: string) => void; loading: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Details');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [startingPayment, setStartingPayment] = useState(false);
  const [form, setForm] = useState({ title: '', hostName: '', description: '', startDateTime: '', theme: 'CELEBRATION', visibility: 'PUBLIC' });
  const [agendaTitle, setAgendaTitle] = useState('');
  const [agendaTime, setAgendaTime] = useState('');
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [performance, setPerformance] = useState<EventPerformance | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  useEffect(() => {
    if (!id || id === 'undefined' || id === 'null' || id === 'new') {
      setError('This event editor has no valid event ID. Return to Your events and open the event again.');
      return;
    }
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    let cancelled = false;
    async function loadEvent() {
      try {
        const data = await eventsApi.getEvent(id);
        if (cancelled) return;
        setEvent(data);
        setForm({
          title: String(data.title ?? ''),
          hostName: String(data.hostName ?? ''),
          description: String(data.description ?? ''),
          startDateTime: data.startDateTime ? String(data.startDateTime).slice(0, 16) : '',
          theme: String(data.theme ?? 'CELEBRATION'),
          visibility: String(data.visibility ?? 'PUBLIC'),
        });
        if (reference) {
          setVerifyingPayment(true);
          const published = await eventsApi.verifyPublishPayment(id, reference);
          if (!cancelled) setEvent(published);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the event');
      } finally {
        if (!cancelled) {
          setVerifyingPayment(false);
          if (reference) {
            const next = new URLSearchParams(searchParams);
            next.delete('reference');
            next.delete('trxref');
            setSearchParams(next, { replace: true });
          }
        }
      }
    }
    void loadEvent();
    return () => { cancelled = true; };
  }, [id, searchParams, setSearchParams]);

  async function refresh() {
    setEvent(await eventsApi.getEvent(id));
  }

  async function loadPerformance() {
    setPerformanceLoading(true);
    try {
      const perf = await eventsApi.eventPerformance(id);
      setPerformance(perf);
    } catch (err) {
      // Performance data may not exist yet for unpublished events
    } finally {
      setPerformanceLoading(false);
    }
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    try {
      await eventsApi.updateEvent(id, {
        title: form.title.trim(),
        hostName: form.hostName.trim() || null,
        description: form.description.trim() || null,
        startDateTime: form.startDateTime ? new Date(form.startDateTime).toISOString() : null,
        theme: form.theme,
        visibility: form.visibility,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function publish() {
    setError('');
    setStartingPayment(true);
    try {
      const result = await eventsApi.publish(id);
      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
        return;
      }
      if (result.event) setEvent(result.event);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setStartingPayment(false);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/${String(event?.slug)}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadQr() {
    const res = await fetch(eventsApi.qrUrl(String(event?.slug)));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-qr-${String(event?.slug)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500" role="status">Loading…</div>;
  if (error && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-6 text-center">
          <p>{error}</p>
          <Link to="/dashboard" className="btn-secondary inline-block mt-3 text-sm">Back to dashboard</Link>
        </div>
      </div>
    );
  }
  if (!event) return <div className="min-h-screen flex items-center justify-center text-gray-500" role="status">Loading…</div>;

  const status = String(event.status);
  const slug = String(event.slug);
  const agenda = (event.agenda as AgendaItem[]) ?? [];
  const locations = (event.locations as EventLocation[]) ?? [];
  const photos = (event.photos as EventPhoto[]) ?? [];
  const messages = (event.messages as GuestMessage[]) ?? [];

  return (
    <div className="editor-shell min-h-screen max-w-4xl mx-auto px-4 py-8">
      <Link to="/dashboard" className="text-sm text-amber-800 font-semibold">← My events</Link>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <h1 className="font-display text-2xl font-bold flex-1 min-w-40">{String(event.title)}</h1>
        <span className={`status-pill status-${status}`} aria-label={`Status: ${status}`}>{status}</span>
      </div>
      {error ? <p className="form-error mt-2" role="alert">{error}</p> : null}
      {verifyingPayment ? <p className="payment-status" role="status">Confirming your R299.99 payment with Paystack…</p> : null}

      {status === 'PUBLISHED' ? (
        <div className="card p-5 mt-4 border-2 !border-green-300" aria-live="polite">
          <h2 className="font-display text-lg font-bold text-green-800">Your event is live!</h2>
          <p className="text-sm text-gray-600">Share it with your guests.</p>
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <button onClick={copyLink} className="btn-primary text-sm flex-1">{copied ? 'Link copied!' : 'Copy Link'}</button>
            <Link to={`/${slug}`} className="btn-secondary text-sm flex-1">Open event</Link>
            <button onClick={downloadQr} className="btn-secondary text-sm flex-1">QR Code</button>
          </div>
        </div>
      ) : (
        <div className="card p-5 mt-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <p className="text-sm text-gray-600 flex-1">Preview your page, then pay once to publish this event. <strong>R299.99</strong></p>
          <Link to={`/preview/${String(event.id)}`} className="btn-secondary text-sm">Preview</Link>
          <button onClick={publish} disabled={startingPayment} className="btn-primary text-sm">{startingPayment ? 'Opening secure checkout…' : 'Pay R299.99 &amp; publish'}</button>
        </div>
      )}

      <nav className="flex gap-1.5 mt-5 overflow-x-auto pb-1" aria-label="Event sections">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={`whitespace-nowrap text-sm font-semibold rounded-full px-4 py-2 ${tab === t ? 'bg-amber-800 text-white' : 'bg-white border border-amber-200 text-amber-800'}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'Details' && (
        <form onSubmit={saveDetails} className="card p-5 mt-3 space-y-3">
          <div>
            <label className="label" htmlFor="ed-title">Event title</label>
            <input id="ed-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={2} />
          </div>
          <div>
            <label className="label" htmlFor="ed-host">Host / celebrant</label>
            <input id="ed-host" className="input" value={form.hostName} onChange={(e) => setForm({ ...form, hostName: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="ed-desc">Description</label>
            <textarea id="ed-desc" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
          </div>
          <div>
            <label className="label" htmlFor="ed-start">Date and time</label>
            <input id="ed-start" className="input" type="datetime-local" value={form.startDateTime} onChange={(e) => setForm({ ...form, startDateTime: e.target.value })} />
          </div>
          <button className="btn-primary text-sm">Save changes</button>
        </form>
      )}

      {tab === 'Programme' && (
        <div className="card p-5 mt-3">
          <ul className="space-y-2 list-none p-0">
            {agenda.length === 0 ? <li className="text-sm text-gray-500">No programme items yet.</li> : null}
            {agenda.map((a) => (
              <li key={a.id} className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
                <span className="text-sm flex-1"><strong>{a.startTime ? `${a.startTime} — ` : ''}</strong>{a.title}</span>
                <button
                  onClick={async () => { await eventsApi.deleteAgenda(id, a.id); await refresh(); }}
                  className="text-sm text-red-600 font-semibold"
                  aria-label={`Delete programme item ${a.title}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!agendaTitle.trim()) return;
              setError('');
              try {
                await eventsApi.addAgenda(id, { title: agendaTitle.trim(), startTime: agendaTime || null });
                setAgendaTitle('');
                setAgendaTime('');
                await refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not add the programme item');
              }
            }}
            className="flex gap-2 mt-3"
          >
            <input className="input flex-1" placeholder="Item title" value={agendaTitle} onChange={(e) => setAgendaTitle(e.target.value)} aria-label="Programme item title" />
            <input className="input !w-24 shrink-0" placeholder="10:00" value={agendaTime} onChange={(e) => setAgendaTime(e.target.value)} aria-label="Start time" />
            <button className="btn-secondary text-sm whitespace-nowrap">Add</button>
          </form>
        </div>
      )}

      {tab === 'Location' && (
        <div className="card p-5 mt-3">
          <ul className="space-y-2 list-none p-0">
            {locations.length === 0 ? <li className="text-sm text-gray-500">No venue added yet.</li> : null}
            {locations.map((l) => (
              <li key={l.id} className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
                <span className="text-sm flex-1"><strong>{l.name}</strong>{l.address ? ` — ${l.address}` : ''}</span>
                <button
                  onClick={async () => { await eventsApi.deleteLocation(id, l.id); await refresh(); }}
                  className="text-sm text-red-600 font-semibold"
                  aria-label={`Delete location ${l.name}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!locName.trim()) return;
              await eventsApi.addLocation(id, { name: locName.trim(), address: locAddress.trim() || null });
              setLocName('');
              setLocAddress('');
              await refresh();
            }}
            className="flex flex-col sm:flex-row gap-2 mt-3"
          >
            <input className="input" placeholder="Venue name" value={locName} onChange={(e) => setLocName(e.target.value)} aria-label="Venue name" />
            <input className="input" placeholder="Address" value={locAddress} onChange={(e) => setLocAddress(e.target.value)} aria-label="Address" />
            <button className="btn-secondary text-sm whitespace-nowrap">Add</button>
          </form>
        </div>
      )}

      {tab === 'Photos' && (
        <div className="card p-5 mt-3">
          <label className="label" htmlFor="photo-upload">Upload photos</label>
          <input
            id="photo-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="mt-1"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                await eventsApi.uploadPhoto(id, file);
                await refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Upload failed');
              }
              e.target.value = '';
            }}
          />
          <div className="grid grid-cols-3 gap-2 mt-3">
            {photos.length === 0 ? <p className="text-sm text-gray-500 col-span-3">No photos yet.</p> : null}
            {photos.map((p) => (
              <figure key={p.id} className="rounded-xl overflow-hidden bg-amber-50 m-0">
                <img src={photoUrl(p.url)} alt={p.caption ?? 'Event photo'} className="w-full h-24 object-cover" loading="lazy" />
                <button
                  onClick={async () => { await eventsApi.deletePhoto(id, p.id); await refresh(); }}
                  className="w-full text-xs text-red-600 font-semibold py-1"
                  aria-label={`Delete photo ${p.caption ?? ''}`}
                >
                  Delete
                </button>
              </figure>
            ))}
          </div>
        </div>
      )}

      {tab === 'Messages' && (
        <div className="card p-5 mt-3">
          <h2 className="font-display text-lg font-bold">Guest Messages</h2>
          <div className="space-y-3 mt-3">
            {messages.length === 0 ? <p className="text-sm text-gray-500">No messages yet. They will appear here as guests leave them.</p> : null}
            {messages.map((m) => (
              <div key={m.id} className="bg-amber-50 rounded-xl p-3">
                <p className="font-semibold text-sm">{m.authorName} {!m.approved ? <span className="text-amber-700 font-normal">(hidden)</span> : null}</p>
                <p className="text-sm mt-0.5">“{m.message}”</p>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={async () => { await eventsApi.moderateMessage(id, m.id, !m.approved); await refresh(); }}
                    className="text-sm text-amber-800 font-semibold"
                    aria-label={`${m.approved ? 'Hide' : 'Approve'} message from ${m.authorName}`}
                  >
                    {m.approved ? 'Hide' : 'Approve'}
                  </button>
                  <button
                    onClick={async () => { await eventsApi.deleteMessage(id, m.id); await refresh(); }}
                    className="text-sm text-red-600 font-semibold"
                    aria-label={`Delete message from ${m.authorName}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Appearance' && (
        <div className="card p-5 mt-3 space-y-3">
          <h2 className="font-display text-lg font-bold">Appearance</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
            {EVENT_THEMES.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={form.theme === t}
                onClick={async () => {
                  setForm({ ...form, theme: t });
                  await eventsApi.updateEvent(id, { theme: t });
                  await refresh();
                }}
                className={`rounded-2xl p-4 text-left border-4 theme-hero-${t.toLowerCase()} ${form.theme === t ? 'border-amber-800' : 'border-transparent'}`}
              >
                <span className="font-bold text-sm bg-white/80 rounded px-1">{t}</span>
              </button>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="ed-vis">Visibility</label>
            <select
              id="ed-vis"
              className="input"
              value={form.visibility}
              onChange={async (e) => {
                setForm({ ...form, visibility: e.target.value });
                await eventsApi.updateEvent(id, { visibility: e.target.value });
                await refresh();
              }}
            >
              <option value="PUBLIC">Public — anyone with the link</option>
              <option value="UNLISTED">Unlisted — only people you share with</option>
            </select>
          </div>
          <button onClick={() => navigate(`/preview/${String(event.id)}`)} className="btn-secondary text-sm">Preview public page</button>
        </div>
      )}

      {tab === 'Analytics' && (
        <div className="mt-3">
          <div className="card p-5">
            <h2 className="font-display text-lg font-bold">Event analytics</h2>
            <p className="text-sm text-gray-500 mt-1">72-hour performance tracking activates once your event is published. Refresh to see the latest data.</p>
            {status !== 'PUBLISHED' ? (
              <p className="text-sm text-gray-500 mt-3">Performance data is collected after your event is live. Publish your event to start tracking.</p>
            ) : (
              <>
                <button
                  onClick={loadPerformance}
                  disabled={performanceLoading}
                  className="btn-primary text-sm mt-3"
                >
                  {performanceLoading ? 'Loading…' : performance ? 'Refresh analytics' : 'Load 72-hour performance'}
                </button>
                {performanceLoading ? (
                  <p className="text-sm text-gray-500 mt-3">Counting views and engagement…</p>
                ) : performance ? (
                  <EventPerformancePanel performance={performance} />
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
