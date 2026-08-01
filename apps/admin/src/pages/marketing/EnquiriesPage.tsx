import { useEffect, useState } from 'react';
import { MessageSquare, Search, Trash2, X } from 'lucide-react';
import { api, Enquiry } from '../../lib/api';

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      setEnquiries(await api.getMarketingEnquiries());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enquiries');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this enquiry?')) return;
    try {
      await api.deleteMarketingEnquiry(id);
      setEnquiries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const filtered = enquiries.filter((eq) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      eq.fullName.toLowerCase().includes(q) ||
      (eq.emailAddress ?? '').toLowerCase().includes(q) ||
      (eq.brochure?.title || '').toLowerCase().includes(q) ||
      (eq.message || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <div className="p-8 text-muted">Loading enquiries...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Marketing Hub</p>
        <h1 className="mt-3 font-display text-4xl text-ink">Enquiries</h1>

        {error && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 flex items-center gap-3 rounded-lg border border-parchment-dark bg-white px-4 py-2.5">
          <Search size={16} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, brochure or message..."
            className="min-w-0 flex-1 text-sm outline-none"
          />
          {search && <button onClick={() => setSearch('')} className="text-muted hover:text-ink"><X size={14} /></button>}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-12 text-center">
            <MessageSquare size={48} className="mx-auto text-parchment-dark/40" />
            <p className="mt-4 text-lg font-semibold text-ink">{search ? 'No matching enquiries' : 'No enquiries yet'}</p>
            <p className="mt-1 text-sm text-muted">
              {search ? 'Try a different search term.' : 'Enquiries from the public marketing site will appear here.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {filtered.map((eq) => (
              <div key={eq.id} className="rounded-lg border border-parchment-dark bg-white">
                <button
                  onClick={() => setExpandedId(expandedId === eq.id ? null : eq.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="font-semibold text-ink">{eq.fullName}</span>
                      <span className="text-sm text-muted">{eq.emailAddress}</span>
                      {eq.brochure?.title && <span className="rounded bg-parchment/70 px-2 py-0.5 text-xs text-muted">{eq.brochure.title}</span>}
                    </div>
                    {eq.message && !expandedId && (
                      <p className="mt-1 truncate text-sm text-muted">{eq.message}</p>
                    )}
                    <p className="mt-1 text-xs text-muted/60">{new Date(eq.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    {eq.phoneNumber && <span className="hidden text-xs text-muted sm:block">{eq.phoneNumber}</span>}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(eq.id); }}
                      className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </button>
                {expandedId === eq.id && eq.message && (
                  <div className="border-t border-parchment-dark/50 px-5 py-4">
                    <p className="text-sm text-ink whitespace-pre-wrap">{eq.message}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
