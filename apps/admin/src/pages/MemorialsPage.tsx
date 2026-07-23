import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Memorial, FuneralContactEnquiry } from '../lib/api';
import { Plus, Calendar, MapPin, Phone, Mail, User, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function isFamilyRole(role?: string) {
  return role === 'FAMILY_MANAGER' || role === 'FAMILY_CONTRIBUTOR';
}

function isFuneralHomeAdmin(role?: string) {
  return role === 'SUPER_ADMIN' || role === 'FUNERAL_HOME_ADMIN';
}

function ContactEnquiriesWidget() {
  const [enquiries, setEnquiries] = useState<FuneralContactEnquiry[]>([]);
  const [summary, setSummary] = useState<{ NEW: number; CONTACTED: number; CLOSED: number; total: number; thisMonth: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.getContactEnquiries()
      .then((data) => {
        setEnquiries(data.enquiries);
        setSummary(data.summary);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!summary || summary.total === 0) return null;

  return (
    <section className="mb-8 rounded-xl border border-parchment-dark bg-white p-5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-gold-dark" />
          <h2 className="font-display text-xl text-ink">Customer Enquiries</h2>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800 font-medium">{summary.NEW} new</span>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-blue-800 font-medium">{summary.CONTACTED} contacted</span>
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-green-800 font-medium">{summary.CLOSED} closed</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-parchment p-3 text-center">
              <p className="text-xs text-muted">Total Enquiries</p>
              <p className="font-display text-2xl text-ink">{summary.total}</p>
            </div>
            <div className="rounded-lg bg-parchment p-3 text-center">
              <p className="text-xs text-muted">This Month</p>
              <p className="font-display text-2xl text-ink">{summary.thisMonth}</p>
            </div>
            <div className="rounded-lg bg-parchment p-3 text-center">
              <p className="text-xs text-muted">Conversion Rate</p>
              <p className="font-display text-2xl text-ink">
                {summary.total > 0 ? Math.round((summary.CLOSED / summary.total) * 100) : 0}%
              </p>
            </div>
          </div>

          {enquiries.slice(0, 5).map((e) => (
            <div key={e.id} className="rounded-lg border border-parchment-dark p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-muted" />
                  <span className="text-sm font-medium text-ink">{e.name}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  e.contactStatus === 'NEW' ? 'bg-amber-100 text-amber-800' :
                  e.contactStatus === 'CONTACTED' ? 'bg-blue-100 text-blue-800' :
                  'bg-green-100 text-green-800'
                }`}>{e.contactStatus}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                <span className="flex items-center gap-1"><Phone size={12} />{e.phone}</span>
                {e.email && <span className="flex items-center gap-1"><Mail size={12} />{e.email}</span>}
              </div>
              <p className="mt-1 text-xs text-muted">
                Memorial: {e.memorial.deceasedName} — {new Date(e.createdAt).toLocaleDateString('en-ZA')}
              </p>
            </div>
          ))}

          {enquiries.length > 5 && (
            <p className="text-center text-xs text-muted">+{enquiries.length - 5} more enquiries</p>
          )}
        </div>
      )}
    </section>
  );
}

export default function MemorialsPage() {
  const { user } = useAuth();
  const [memorials, setMemorials] = useState<Memorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'DRAFT' | 'PAID_PENDING' | 'PUBLISHED' | 'LOCKED' | 'EXPIRED'>('ALL');

  useEffect(() => {
    api.getMemorials()
      .then(setMemorials)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load memorials'))
      .finally(() => setLoading(false));
  }, []);

  const statusColor: Record<string, string> = {
    DRAFT: 'bg-amber-100 text-amber-800',
    PAID_PENDING: 'bg-blue-100 text-blue-800',
    PUBLISHED: 'bg-green-100 text-green-800',
    LOCKED: 'bg-stone-200 text-stone-700',
    EXPIRED: 'bg-red-100 text-red-700',
  };

  const visibleMemorials = filter === 'ALL' ? memorials : memorials.filter((m) => m.status === filter);
  const familyUser = isFamilyRole(user?.role);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">{familyUser ? 'Family memorials' : 'Memorials'}</h1>
          <p className="text-muted mt-1">{familyUser ? 'View and contribute to assigned memorials' : 'Manage your digital funeral programmes'}</p>
        </div>
        {!familyUser && <Link
          to="/create"
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition hover:bg-ink-light"
        >
          <Plus size={18} />
          New Memorial
        </Link>}
      </div>
      {!familyUser && isFuneralHomeAdmin(user?.role) && <ContactEnquiriesWidget />}
      <div className="mb-6 flex flex-wrap gap-2">
        {(['ALL', 'DRAFT', 'PAID_PENDING', 'PUBLISHED', 'LOCKED', 'EXPIRED'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
              filter === item ? 'bg-ink text-parchment' : 'bg-white text-muted hover:text-ink'
            }`}
          >
            {item.replace('_', ' ').toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted">Loading memorials...</div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-gold-dark hover:text-gold font-medium"
          >
            Try again
          </button>
        </div>
      ) : visibleMemorials.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-parchment-dark rounded-xl">
          <p className="text-muted mb-4">{familyUser ? 'No assigned memorials yet' : 'No memorials yet'}</p>
          {!familyUser && <Link to="/create" className="text-gold-dark hover:text-gold font-medium">
            Create your first memorial
          </Link>}
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleMemorials.map((m) => (
            <Link
              key={m.id}
              to={familyUser ? `/family/memorials/${m.id}` : `/memorial/${m.id}`}
              className="group block rounded-xl border border-parchment-dark bg-white p-4 transition hover:border-gold/30 hover:shadow-md sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-xl text-ink group-hover:text-gold-dark transition">
                    {m.deceasedName}
                  </h2>
                  <div className="mt-2 flex flex-col gap-1 text-sm text-muted sm:flex-row sm:flex-wrap sm:gap-4">
                    {m.serviceDate && (
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(m.serviceDate).toLocaleDateString('en-ZA', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                    {m.serviceVenue && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {m.serviceVenue}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColor[m.status] || ''}`}>
                  {m.status.replace('_', ' ')}
                </span>
              </div>
              <p className="mt-3 break-words text-xs text-muted">
                memoryconnect.co.za/{m.slug}
                {m.publicExpiresAt && ['PUBLISHED', 'LOCKED'].includes(m.status) && (
                  <span className="ml-3">Viewing ends {new Date(m.publicExpiresAt).toLocaleDateString('en-ZA')}</span>
                )}
                <span className="ml-3">{m.viewCount || 0} views</span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
