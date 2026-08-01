import { useEffect, useState } from 'react';
import { Download, Eye, FileText, TrendingUp, Users } from 'lucide-react';
import { api, MarketingAnalytics } from '../../lib/api';

export default function AnalyticsPage() {
  const [data, setData] = useState<MarketingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  useEffect(() => { load(); }, [days]);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      setData(await api.getMarketingAnalytics(days));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-muted">Loading analytics...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return <div className="p-8 text-muted">No analytics data available</div>;

  const stats = [
    { label: 'Total Views', value: data.totalViews, icon: Eye, color: 'text-blue-600' },
    { label: 'Unique Visitors', value: data.totalUniqueVisitors, icon: Users, color: 'text-purple-600' },
    { label: 'QR Scans', value: data.totalQrScans, icon: Eye, color: 'text-indigo-600' },
    { label: 'PDF Downloads', value: data.totalPdfDownloads, icon: Download, color: 'text-amber-600' },
    { label: 'CTA Clicks', value: data.totalCtaClicks, icon: Eye, color: 'text-cyan-600' },
    { label: 'Enquiries', value: data.totalEnquiries, icon: FileText, color: 'text-rose-600' },
    { label: 'Conversion Rate', value: `${(data.conversionRate).toFixed(1)}%`, icon: TrendingUp, color: 'text-emerald-600' },
  ];

  const maxViewCount = Math.max(...data.viewsByDay.map((d) => d.count), 1);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Marketing Hub</p>
            <h1 className="mt-3 font-display text-4xl text-ink">Analytics</h1>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-parchment-dark bg-white px-3 py-2">
            <span className="text-xs font-semibold text-muted">Period:</span>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  days === d ? 'bg-[var(--brand-accent)] text-white' : 'text-muted hover:bg-parchment'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-parchment-dark bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">{stat.label}</p>
                <stat.icon size={20} className={stat.color} />
              </div>
              <p className="mt-2 font-display text-3xl text-ink">{stat.value}</p>
            </div>
          ))}
        </div>

        {data.viewsByDay.length > 0 && (
          <section className="mt-8 rounded-lg border border-parchment-dark bg-white p-6">
            <h2 className="font-display text-xl text-ink">Views by Day</h2>
            <div className="mt-6 flex items-end gap-1" style={{ height: '120px' }}>
              {data.viewsByDay.map((day) => (
                <div
                  key={day.date}
                  className="flex-1 rounded-t bg-[var(--brand-accent)]/60 transition hover:bg-[var(--brand-accent)]/90"
                  style={{ height: `${(day.count / maxViewCount) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                  title={`${day.date}: ${day.count} views`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted">
              <span>{data.viewsByDay[0]?.date}</span>
              <span>{data.viewsByDay[data.viewsByDay.length - 1]?.date}</span>
            </div>
          </section>
        )}

        {data.brochureViews.length > 0 && (
          <section className="mt-6 overflow-x-auto rounded-lg border border-parchment-dark bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-parchment-dark bg-parchment/50 text-left text-xs font-semibold uppercase text-muted">
                  <th className="px-4 py-3">Brochure</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">Enquiries</th>
                </tr>
              </thead>
              <tbody>
                {data.brochureViews.map((bv) => (
                  <tr key={bv.id} className="border-b border-parchment-dark/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{bv.title}</td>
                    <td className="px-4 py-3 text-muted">{bv.viewCount}</td>
                    <td className="px-4 py-3 text-muted">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
