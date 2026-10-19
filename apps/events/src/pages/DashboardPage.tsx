import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { eventsApi, photoUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { EVENT_TYPE_LABELS, presentationFor, type EventType } from '@memorialconnect/event-shared';

interface Row {
  id: string; slug: string; title: string; eventType: string; status: string;
  viewCount: number; startDateTime?: string | null; coverImage?: string | null;
}

function formatDate(value?: string | null): string {
  if (!value) return 'Date to be set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date to be set';
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DashboardPage() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => { if (!loading && !user) navigate('/login'); }, [loading, user, navigate]);
  useEffect(() => {
    if (user) eventsApi.listEvents().then((rows) => setEvents(rows as Row[])).catch((e: Error) => setError(e.message));
  }, [user]);

  const visibleEvents = useMemo(() => events.filter((event) =>
    (filter === 'ALL' || event.status === filter) && event.title.toLowerCase().includes(query.trim().toLowerCase()),
  ), [events, filter, query]);

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center text-gray-500" role="status">Loading…</div>;
  const liveCount = events.filter((event) => event.status === 'PUBLISHED').length;
  const totalViews = events.reduce((total, event) => total + event.viewCount, 0);

  return (
    <div className="organiser-shell min-h-screen">
      <header className="organiser-topbar">
        <Link to="/" className="brand-lockup"><img src="/events-connect-mark.png" alt="" /><span>Events <strong>Connect</strong></span></Link>
        <nav className="organiser-nav" aria-label="Organiser navigation">
          {user.role === 'SUPER_ADMIN' ? <Link to="/platform" className="organiser-nav-current">Platform owner</Link> : null}
          <span className="organiser-nav-current">Your events</span>
          <button onClick={() => { logout(); navigate('/'); }} className="quiet-button">Log out</button>
        </nav>
      </header>

      <main className="organiser-main">
        <section className="dashboard-intro">
          <div>
            <p className="section-kicker">YOUR CELEBRATIONS, IN ONE PLACE</p>
            <h1>Good to see you,<br /><em>{user.organiser.name}</em></h1>
            <p className="intro-copy">Every gathering deserves a page that feels like yours.</p>
          </div>
          <Link to="/events/new" className="btn-primary create-event-button"><span aria-hidden="true">＋</span> Create an event</Link>
        </section>

        <section className="overview-strip" aria-label="Event overview">
          <div><span className="overview-number">{events.length}</span><span className="overview-label">Total events</span></div>
          <div><span className="overview-number">{liveCount}</span><span className="overview-label">Pages live</span></div>
          <div><span className="overview-number">{totalViews.toLocaleString('en-ZA')}</span><span className="overview-label">Guest visits</span></div>
          <span className="overview-note">Made for all the moments worth gathering for.</span>
        </section>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <section className="event-library" aria-labelledby="event-library-title">
          <div className="library-heading">
            <div><p className="section-kicker">THE EVENT LIBRARY</p><h2 id="event-library-title">Your events</h2></div>
            {events.length > 0 ? <label className="event-search"><span className="sr-only">Search events</span><span aria-hidden="true">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an event" /></label> : null}
          </div>

          {events.length > 0 ? <div className="event-filters" aria-label="Filter events">
            {[['ALL', 'All events'], ['PUBLISHED', 'Live'], ['DRAFT', 'Drafts'], ['ARCHIVED', 'Archived']].map(([value, label]) => (
              <button key={value} onClick={() => setFilter(value)} className={`filter-chip ${filter === value ? 'is-active' : ''}`} aria-pressed={filter === value}>{label}<span>{value === 'ALL' ? events.length : events.filter((event) => event.status === value).length}</span></button>
            ))}
          </div> : null}

          {events.length === 0 ? (
            <div className="first-event-panel">
              <div className="first-event-art" aria-hidden="true"><span>✳</span><span>✳</span><span>✳</span></div>
              <div><p className="section-kicker">A LITTLE SPACE FOR A BIG MOMENT</p><h3>Your first event starts here.</h3><p>Bring the details, photos, programme and guest messages together in one lovely page.</p><Link to="/events/new" className="btn-primary">Create your first event <span aria-hidden="true">→</span></Link></div>
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className="empty-filter"><h3>No events match that search.</h3><p>Try another title or choose a different filter.</p><button className="text-link" onClick={() => { setQuery(''); setFilter('ALL'); }}>Show all events</button></div>
          ) : (
            <ul className="event-grid">
              {visibleEvents.map((event) => {
                const label = (EVENT_TYPE_LABELS as Record<string, string>)[event.eventType] ?? event.eventType;
                return <li key={event.id} className="event-card">
                  <Link to={`/events/${event.id}`} className="event-card-cover" aria-label={`Edit ${event.title}`}>
                    {event.coverImage ? <img src={photoUrl(event.coverImage)} alt="" loading="lazy" /> : <div className={`event-card-art ${presentationFor(event.eventType as EventType).cardAccent}`}><span className="event-card-type">{label}</span><span className="event-card-flower" aria-hidden="true">✳</span><span className="event-card-wordmark">A day to remember</span></div>}
                    <span className={`status-pill status-${event.status}`}>{event.status === 'PUBLISHED' ? 'Live' : event.status === 'DRAFT' ? 'Draft' : event.status}</span>
                  </Link>
                  <div className="event-card-content">
                    <p className="event-card-meta">{label}<span>·</span>{formatDate(event.startDateTime)}</p>
                    <h3><Link to={`/events/${event.id}`}>{event.title}</Link></h3>
                    <div className="event-card-footer"><span>{event.viewCount.toLocaleString('en-ZA')} guest {event.viewCount === 1 ? 'visit' : 'visits'}</span><Link to={event.status === 'PUBLISHED' ? `/${event.slug}` : `/events/${event.id}`} className="text-link">{event.status === 'PUBLISHED' ? 'View page ↗' : 'Continue editing →'}</Link></div>
                  </div>
                </li>;
              })}
            </ul>
          )}
        </section>
      </main>
      <footer className="organiser-footer">Made with care in South Africa <span>✳</span> MemoryConnect Events</footer>
    </div>
  );
}
