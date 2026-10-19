import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { eventsApi } from '../lib/api';
import { useAuth } from '../lib/auth';

type Section = 'overview' | 'organisers' | 'events' | 'payments' | 'audit';
const navigation: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'organisers', label: 'Organisers' },
  { id: 'events', label: 'Events' }, { id: 'payments', label: 'Payments' }, { id: 'audit', label: 'Audit log' },
];
const money = (cents = 0) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
const date = (value?: string) => value ? new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function PlatformPage() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('overview');
  const [data, setData] = useState<any>(null);
  const [performanceSummary, setPerformanceSummary] = useState<{ trending: any[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'SUPER_ADMIN')) navigate('/dashboard', { replace: true });
  }, [loading, user, navigate]);

  async function load() {
    if (!user || user.role !== 'SUPER_ADMIN') return;
    setError('');
    try {
      if (section === 'overview') {
        const [result, perfSummary] = await Promise.all([
          eventsApi.platformOverview(),
          eventsApi.platformPerformanceSummary().catch(() => ({ trending: [] })),
        ]);
        setData(result);
        setPerformanceSummary(perfSummary);
      } else {
        const result = section === 'organisers' ? await eventsApi.platformOrganisers()
          : section === 'events' ? await eventsApi.platformEvents()
          : section === 'payments' ? await eventsApi.platformPayments()
          : await eventsApi.platformAuditLogs();
        setData(result);
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load platform data'); }
  }
  useEffect(() => { void load(); }, [section, user]);

  async function action(key: string, work: () => Promise<unknown>) {
    setBusy(key); setError('');
    try { await work(); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Action failed'); }
    finally { setBusy(''); }
  }

  if (loading || !user || user.role !== 'SUPER_ADMIN') return <div className="platform-loading">Loading platform…</div>;
  const rows: any[] = Array.isArray(data) ? data : [];
  const filtered = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase()));

  return <div className="platform-shell">
    <aside className="platform-sidebar">
      <Link to="/" className="platform-brand"><img src="/events-connect-mark.png" alt="" /><span>Events <b>Connect</b><small>PLATFORM OWNER</small></span></Link>
      <p className="platform-nav-label">MANAGEMENT</p>
      <nav aria-label="Platform owner navigation">{navigation.map((item) => <button key={item.id} onClick={() => { setSection(item.id); setQuery(''); }} className={section === item.id ? 'is-active' : ''}>{item.label}<span>›</span></button>)}</nav>
      <div className="platform-sidebar-bottom"><span>Signed in as <b>{user.name}</b></span><button onClick={() => { logout(); navigate('/'); }}>Log out</button></div>
    </aside>
    <main className="platform-main">
      <header className="platform-header"><div><p className="section-kicker">EVENTS CONNECT · PLATFORM</p><h1>{navigation.find((item) => item.id === section)?.label}</h1></div><span className="platform-owner-pill">● Owner access</span></header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {section === 'overview' ? <>
        <p className="platform-welcome">Your Events platform at a glance. This dashboard only shows data from Events Connect.</p>
        {data ? <div className="platform-stat-grid">{[
          ['Organisers', data.organisers], ['Active accounts', data.activeOrganisers], ['Events', data.events], ['Published', data.published], ['Payment revenue', money(data.revenueCents)], ['Pending payments', data.pendingPayments], ['Guest visits', data.views], ['Registered users', data.users],
        ].map(([label, value]) => <article className="platform-stat" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div> : <p className="platform-empty">Loading overview…</p>}
        <div className="platform-callout"><div><strong>Manage the whole Events service</strong><p>Review accounts, event pages, publishing payments, and owner actions.</p></div><button className="btn-primary" onClick={() => setSection('organisers')}>Manage organisers →</button></div>
        {performanceSummary?.trending.length > 0 ? (
          <div className="platform-trending">
            <h3 className="font-display text-lg font-bold mb-3 text-amber-800">Trending events (72-hour window)</h3>
            <div className="platform-table-wrap">
              <table>
                <thead><tr><th>Event</th><th>Day</th><th>Day views</th><th>72h views</th><th>Rating</th></tr></thead>
                <tbody>{performanceSummary.trending.map((e: any) => (
                  <tr key={e.id}>
                    <td><b>{e.title}</b><small>/{e.slug}</small></td>
                    <td>Day {e.day}</td>
                    <td>{e.currentDayViews}</td>
                    <td>{e.total72HourViews}</td>
                    <td><span className={`event-perf-rating event-perf-rating--${e.performanceRating}`}>{e.performanceRating}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        ) : null}
      </> : <>
        <div className="platform-list-toolbar"><p>Review and manage Events Connect records.</p><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${section}`} aria-label={`Search ${section}`} /></div>
        <div className="platform-table-wrap">
          {section === 'organisers' && <table><thead><tr><th>Organiser</th><th>Account</th><th>Users</th><th>Events</th><th>Created</th><th>Action</th></tr></thead><tbody>{filtered.map((o) => <tr key={o.id}><td><b>{o.name}</b><small>{o.email}</small></td><td><span className={`platform-status ${o.status === 'ACTIVE' ? 'good' : 'paused'}`}>{o.status}</span></td><td>{o._count.users}</td><td>{o._count.events}</td><td>{date(o.createdAt)}</td><td><button className="platform-action" disabled={busy === o.id} onClick={() => action(o.id, () => eventsApi.platformOrganiserAction(o.id, o.status === 'ACTIVE' ? 'suspend' : 'reactivate'))}>{o.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button></td></tr>)}</tbody></table>}
          {section === 'events' && <table><thead><tr><th>Event</th><th>Organiser</th><th>Status</th><th>Visits</th><th>Created</th><th>Action</th></tr></thead><tbody>{filtered.map((e) => <tr key={e.id}><td><b>{e.title}</b><small>/{e.slug}</small></td><td>{e.organiser.name}<small>{e.organiser.email}</small></td><td><span className={`status-pill status-${e.status}`}>{e.status}</span></td><td>{e.viewCount}</td><td>{date(e.createdAt)}</td><td>{['PUBLISHED', 'DRAFT'].includes(e.status) ? <button className="platform-action" disabled={busy === e.id} onClick={() => action(e.id, () => eventsApi.platformEventStatus(e.id, e.status === 'PUBLISHED' ? 'DRAFT' : 'ARCHIVED'))}>{e.status === 'PUBLISHED' ? 'Unpublish' : 'Archive'}</button> : '—'}</td></tr>)}</tbody></table>}
          {section === 'payments' && <table><thead><tr><th>Event</th><th>Organiser</th><th>Amount</th><th>Status</th><th>Reference</th><th>Created</th></tr></thead><tbody>{filtered.map((p) => <tr key={p.id}><td><b>{p.event.title}</b></td><td>{p.event.organiser.name}<small>{p.event.organiser.email}</small></td><td>{money(p.amountCents)}</td><td><span className={`platform-status ${p.status === 'SUCCESS' ? 'good' : 'paused'}`}>{p.status}</span></td><td>{p.providerRef || '—'}</td><td>{date(p.createdAt)}</td></tr>)}</tbody></table>}
          {section === 'audit' && <table><thead><tr><th>Action</th><th>Target</th><th>Actor</th><th>Organiser</th><th>When</th><th>Details</th></tr></thead><tbody>{filtered.map((log) => <tr key={log.id}><td><b>{log.action}</b></td><td>{log.targetType}<small>{log.targetId}</small></td><td>{log.actor?.name ?? 'Former user'}<small>{log.actor?.email}</small></td><td>{log.organiser?.name ?? '—'}</td><td>{date(log.createdAt)}</td><td>{log.details ?? '—'}</td></tr>)}</tbody></table>}
          {data && filtered.length === 0 && <p className="platform-empty">No records match your search.</p>}
          {!data && <p className="platform-empty">Loading {section}…</p>}
        </div>
      </>}
    </main>
  </div>;
}
