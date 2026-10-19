import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, X } from 'lucide-react';
import { api, PlatformNotification, PlatformSearchResults } from '../../lib/api';

interface Props {
  onSearchPick?: () => void;
}

export default function OwnerTopbar({ onSearchPick }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlatformSearchResults | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifyRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<number | null>(null);

  const fetchResults = async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      setResults(await api.searchPlatform(q));
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const onChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchResults(value), 300);
  };

  useEffect(() => {
    api.getPlatformNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
    const interval = window.setInterval(() => {
      api.getPlatformNotifications().then(setNotifications).catch(() => {});
    }, 60000);
    return () => { clearInterval(interval); if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setResultsOpen(false);
      if (notifyRef.current && !notifyRef.current.contains(e.target as Node)) setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const openResult = (link: string) => {
    navigate(link);
    setResultsOpen(false);
    setQuery('');
    setResults(null);
    onSearchPick?.();
  };

  const statusDot = (severity: PlatformNotification['severity']) =>
    ({ critical: 'bg-red-500', warning: 'bg-amber-400', info: 'bg-sage' }[severity] || 'bg-sage');

  return (
    <div className="flex items-center gap-2 border-b border-ink/10 bg-white px-4 py-3 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:pl-4">
      {/* Search */}
      <div ref={searchRef} className="relative flex-1">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setResultsOpen(true)}
            placeholder="Search homes, users, memorials, payments, features..."
            className="w-full rounded-lg border border-ink/15 bg-ink/3 py-2 pl-10 pr-3 text-sm focus:border-sage focus:outline-none"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults(null); setResultsOpen(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {resultsOpen && (results || loading) && (
          <div className="absolute z-20 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border border-ink/15 bg-white shadow-lg">
            {loading && <div className="p-3 text-xs text-muted">Searching…</div>}
            {results && !loading && (
              <SearchResultsList results={results} onSelect={openResult} />
            )}
            {!loading && !results && <div className="p-3 text-xs text-muted">No results</div>}
          </div>
        )}
      </div>

      {/* Notifications */}
      <div ref={notifyRef} className="relative">
        <button
          onClick={() => setNotificationsOpen((o) => !o)}
          className="relative inline-flex size-9 items-center justify-center rounded-lg border border-ink/15 bg-white text-muted hover:bg-ink/5"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {notifications.length}
            </span>
          )}
        </button>
        {notificationsOpen && (
          <div className="absolute right-0 z-20 mt-1 w-80 max-w-sm rounded-lg border border-ink/15 bg-white shadow-lg">
            <div className="border-b border-ink/10 px-3 py-2 text-xs font-semibold uppercase text-muted">
              {notifications.length} notification{notifications.length === 1 ? '' : 's'}
            </div>
            <ul className="max-h-96 overflow-y-auto py-1">
              {notifications.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-muted">All clear</li>
              ) : (
                notifications.map((n) => (
                  <li key={n.id} className="border-b border-ink/8 last:border-0">
                    <button
                      onClick={() => { if (n.link) { navigate(n.link); } setNotificationsOpen(false); }}
                      className="block w-full text-left"
                    >
                      <div className="flex items-start gap-2 px-3 py-2.5">
                        <span className={`mt-0.5 block size-2 rounded-full ${statusDot(n.severity)}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-muted">{n.detail}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchResultsList({ results, onSelect }: { results: PlatformSearchResults; onSelect: (link: string) => void }) {
  const groups: Array<{ label: string; items: Array<{ label: string; sub?: string; link: string }> }> = [];
  if (results.funeralHomes.length) groups.push({ label: 'Funeral Homes', items: results.funeralHomes.map((h) => ({ label: h.name, sub: h.email, link: `/admin-owner/funeral-homes/${h.id}` })) });
  if (results.users.length) groups.push({ label: 'Users', items: results.users.map((u) => ({ label: u.name, sub: u.email, link: `/admin-owner/users` })) });
  if (results.memorials.length)
    groups.push({ label: 'Memorials', items: results.memorials.map((m) => ({ label: m.deceasedName, sub: m.funeralHome?.name, link: `/admin-owner/funeral-homes/${m.funeralHome?.id || ''}` })) });
  if (results.qrCodes.length)
    groups.push({ label: 'QR Codes', items: results.qrCodes.map((q) => ({ label: q.url, sub: `${q.scanCount} scans`, link: `/admin-owner/analytics` })) });
  if (results.payments.length) groups.push({ label: 'Payments', items: results.payments.map((p) => ({ label: p.paystackReference, sub: p.funeralHome?.name, link: `/admin-owner/payments` })) });
  if (results.features.length) groups.push({ label: 'Features', items: results.features.map((f) => ({ label: f.name, sub: f.key, link: `/admin-owner/features` })) });
  if (results.enquiries.length)
    groups.push({ label: 'Support tickets', items: results.enquiries.map((e) => ({ label: e.fullName, sub: e.createdAt, link: `/marketing/enquiries` })) });
  if (results.auditLogs.length)
    groups.push({ label: 'Audit logs', items: results.auditLogs.map((a) => ({ label: a.action, sub: a.targetId, link: `/admin-owner/audit-logs` })) });

  if (groups.length === 0) return <div className="p-3 text-xs text-muted">No results for "{results.query}"</div>;

  return (
    <div>
      {groups.map((group) => (
        <div key={group.label} className="border-b border-ink/8 last:border-0">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-muted">{group.label}</div>
          {group.items.map((item, i) => (
            <button
              key={`${group.label}-${i}`}
              onClick={() => onSelect(item.link)}
              className="block w-full text-left px-3 py-1.5 hover:bg-ink/3"
            >
              <p className="text-sm font-medium text-ink">{item.label}</p>
              {item.sub && <p className="text-xs text-muted truncate">{item.sub}</p>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
