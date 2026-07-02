import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Memorial } from '../lib/api';
import { Plus, Calendar, MapPin } from 'lucide-react';

export default function MemorialsPage() {
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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Memorials</h1>
          <p className="text-muted mt-1">Manage your digital funeral programmes</p>
        </div>
        <Link
          to="/create"
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition hover:bg-ink-light"
        >
          <Plus size={18} />
          New Memorial
        </Link>
      </div>
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
          <p className="text-muted mb-4">No memorials yet</p>
          <Link to="/create" className="text-gold-dark hover:text-gold font-medium">
            Create your first memorial
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleMemorials.map((m) => (
            <Link
              key={m.id}
              to={`/memorial/${m.id}`}
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
