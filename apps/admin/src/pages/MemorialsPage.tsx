import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Memorial } from '../lib/api';
import { Plus, Calendar, MapPin } from 'lucide-react';

export default function MemorialsPage() {
  const [memorials, setMemorials] = useState<Memorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMemorials()
      .then(setMemorials)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load memorials'))
      .finally(() => setLoading(false));
  }, []);

  const statusColor: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Memorials</h1>
          <p className="text-muted mt-1">Manage your digital funeral programmes</p>
        </div>
        <Link
          to="/create"
          className="flex items-center gap-2 px-5 py-2.5 bg-ink text-parchment rounded-lg text-sm font-medium hover:bg-ink-light transition"
        >
          <Plus size={18} />
          New Memorial
        </Link>
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
      ) : memorials.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-parchment-dark rounded-xl">
          <p className="text-muted mb-4">No memorials yet</p>
          <Link to="/create" className="text-gold-dark hover:text-gold font-medium">
            Create your first memorial
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {memorials.map((m) => (
            <Link
              key={m.id}
              to={`/memorial/${m.id}`}
              className="block bg-white rounded-xl border border-parchment-dark p-6 hover:shadow-md hover:border-gold/30 transition group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-xl text-ink group-hover:text-gold-dark transition">
                    {m.deceasedName}
                  </h2>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted">
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
                  {m.status}
                </span>
              </div>
              <p className="text-xs text-muted mt-3">
                memoryconnect.co.za/{m.slug}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
