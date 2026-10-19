import { useEffect, useState } from 'react';
import { Building2, Eye, FileText, Megaphone, MessageSquare } from 'lucide-react';
import { api, MarketingDashboard } from '../../lib/api';

export default function MarketingDashboardPage() {
  const [data, setData] = useState<MarketingDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      setData(await api.getMarketingDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-muted">Loading dashboard...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return <div className="p-8 text-muted">No data available</div>;

  const cards = [
    { label: 'Total Brochures', value: data.totalBrochures, icon: FileText, color: 'text-blue-600' },
    { label: 'Published', value: data.publishedBrochures, icon: FileText, color: 'text-emerald-600' },
    { label: 'Promotions', value: data.totalPromotions, icon: Megaphone, color: 'text-purple-600' },
    { label: 'Active Promotions', value: data.activePromotions, icon: Megaphone, color: 'text-amber-600' },
    { label: 'Enquiries', value: data.totalEnquiries, icon: MessageSquare, color: 'text-cyan-600' },
    { label: 'Branches', value: data.totalBranches, icon: Building2, color: 'text-rose-600' },
    { label: 'Page Views', value: data.totalViews, icon: Eye, color: 'text-indigo-600' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Marketing Hub</p>
        <h1 className="mt-3 font-display text-4xl text-ink">Dashboard</h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-lg border border-parchment-dark bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">{card.label}</p>
                <card.icon size={20} className={card.color} />
              </div>
              <p className="mt-2 font-display text-3xl text-ink">{card.value}</p>
            </div>
          ))}
        </div>

        {data.recentEnquiries.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 font-display text-2xl text-ink">Recent Enquiries</h2>
            <div className="overflow-x-auto rounded-lg border border-parchment-dark bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-parchment-dark bg-parchment/50 text-left text-xs font-semibold uppercase text-muted">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Brochure</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentEnquiries.map((eq) => (
                    <tr key={eq.id} className="border-b border-parchment-dark/50 last:border-0">
                      <td className="px-4 py-3 font-medium text-ink">{eq.fullName}</td>
                      <td className="px-4 py-3 text-muted">{eq.emailAddress || '-'}</td>
                      <td className="px-4 py-3 text-muted">{eq.brochure?.title || '-'}</td>
                      <td className="px-4 py-3 text-muted">{new Date(eq.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
