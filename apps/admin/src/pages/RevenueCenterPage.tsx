import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, TrendingUp, Wallet, CalendarDays, CheckCircle, XCircle, Clock } from 'lucide-react';
import { BarChart, Bar, LabelList, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, PlatformRevenue, PlatformRevenueTopHome } from '../lib/api';

const money = (cents = 0, currency = 'ZAR') => new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(cents / 100);
const moneyTick = (cents: number) => `ZAR ${(cents / 100).toFixed(0)}`;

const STATUS_COLORS = {
  successful: '#16a34a',
  failed: '#dc2626',
  pending: '#d97706',
};

function Stat({ title, value, note, icon: Icon }: { title: string; value: string; note?: string; icon: React.ElementType }) {
  return (
    <div className="border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
          {note && <p className="mt-1 text-xs text-muted">{note}</p>}
        </div>
        <Icon size={20} className="text-sage" />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-ink/10 bg-white p-5 lg:p-6">
      <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Loading() {
  return <div className="grid min-h-72 place-items-center text-sm text-muted"><RefreshCw className="mb-2 animate-spin" />Loading revenue data...</div>;
}

function ErrorMessage({ message }: { message: string }) {
  return <div role="alert" className="m-8 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>;
}

export default function RevenueCenterPage() {
  const [data, setData] = useState<PlatformRevenue | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.getPlatformRevenue());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const { revenueTrend, paymentsBreakdown, creditsBreakdown } = useMemo(() => {
    if (!data) return { revenueTrend: [], paymentsBreakdown: null, creditsBreakdown: null };
    return {
      revenueTrend: data.trend,
      paymentsBreakdown: data.statusBreakdown.payments,
      creditsBreakdown: data.statusBreakdown.creditPurchases,
    };
  }, [data]);

  if (loading || !data) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;

  const growth = data.summary.growthPct;
  const growthPositive = growth >= 0;
  const growthLabel = growthPositive ? `+${growth}%` : `${growth}%`;
  const totalCaptured = (paymentsBreakdown?.successful ?? 0) + (creditsBreakdown?.successful ?? 0);

  return (
    <>
      <header className="flex flex-col gap-4 border-b border-ink/10 bg-white px-5 py-6 sm:flex-row sm:items-end sm:justify-between lg:px-8">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-sage">Revenue Center</p>
          <h1 className="font-display text-3xl font-semibold text-ink">Platform Revenue</h1>
          <p className="mt-1 text-sm text-muted">Publish payments, credit purchases, and revenue trend across the last 12 months.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-parchment disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /> Refresh
        </button>
      </header>

      <div className="grid gap-3 p-5 lg:p-8 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Revenue this year" value={money(data.summary.thisYearCents)} note="Successful payments + credits" icon={Wallet} />
        <Stat title="Revenue this month" value={money(data.summary.thisMonthCents)} icon={CalendarDays} />
        <Stat
          title="Month over month"
          value={growthLabel}
          note={growthPositive ? 'Revenue increased' : 'Revenue decreased'}
          icon={TrendingUp}
        />
        <Stat title="Total captured" value={String(totalCaptured)} note="Successful payments & credits" icon={CheckCircle} />
      </div>

      <div className="grid gap-3 p-5 pt-0 lg:p-8 lg:pt-0 sm:grid-cols-3">
        <Stat title="Successful" value={String(totalCaptured)} note="Payments & credits" icon={CheckCircle} />
        <Stat title="Failed" value={String((paymentsBreakdown?.failed ?? 0) + (creditsBreakdown?.failed ?? 0))} note="Payments & credits" icon={XCircle} />
        <Stat title="Pending" value={String((paymentsBreakdown?.pending ?? 0) + (creditsBreakdown?.pending ?? 0))} note="Payments & credits" icon={Clock} />
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-2 lg:p-8">
        <Section title="Monthly revenue trend">
          <RevenueTrendChart trend={revenueTrend} />
        </Section>
        <Section title="Top funeral homes by revenue">
          <TopHomesChart homes={data.topHomes} />
        </Section>
      </div>

      <div className="grid gap-5 p-5 pt-0 lg:grid-cols-2 lg:p-8 lg:pt-0">
        <Section title="Payment status breakdown">
          <StatusPieChart title="Publish payments" breakdown={paymentsBreakdown} />
        </Section>
        <Section title="Credit purchase breakdown">
          <StatusPieChart title="Credit purchases" breakdown={creditsBreakdown} />
        </Section>
      </div>
    </>
  );
}

function RevenueTrendChart({ trend }: { trend: PlatformRevenue['trend'] }) {
  const maxY = Math.max(...trend.map((d) => d.totalCents), 0) || 1;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={trend} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis
          tickFormatter={moneyTick}
          tick={{ fontSize: 10 }}
          width={72}
          domain={[0, (max: number) => Math.ceil(max * 1.1 || maxY)]}
        />
        <Tooltip formatter={(value: any) => [moneyTick(value), '']} labelFormatter={(l: any) => `Month: ${l}`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="totalCents" name="Total" stroke="#2d6a4f" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="paymentsCents" name="Publish payments" stroke="#2563eb" dot={{ r: 3 }} />
        <Line type="monotone" dataKey="creditsCents" name="Credit purchases" stroke="#d97706" dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TopHomesChart({ homes }: { homes: PlatformRevenueTopHome[] }) {
  const data = homes.map((h) => ({ name: h.name, revenue: h.revenueCents }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ top: 16, right: 24, left: 80, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={moneyTick} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={180} />
        <Tooltip formatter={(value: any) => [money(value), 'Revenue']} />
        <Bar dataKey="revenue" name="Revenue" radius={3} fill="#2d6a4f">
          <LabelList dataKey="revenue" position="right" formatter={(v: any) => money(v)} style={{ fontSize: 10 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function StatusPieChart({ title, breakdown }: { title: string; breakdown: { successful: number; failed: number; pending: number } | null }) {
  const data = [
    { name: 'Successful', value: breakdown?.successful ?? 0, color: STATUS_COLORS.successful },
    { name: 'Failed', value: breakdown?.failed ?? 0, color: STATUS_COLORS.failed },
    { name: 'Pending', value: breakdown?.pending ?? 0, color: STATUS_COLORS.pending },
  ];
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="40%"
          innerRadius={52}
          outerRadius={84}
          paddingAngle={2}
          label={({ name, value }) => `${name}: ${value}`}
          labelLine={false}
        >
          {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
        </Pie>
        <Tooltip separator=" " formatter={(value: any) => [`${value} (${total ? Math.round((value / total) * 100) : 0}%)`, '']} />
        <Legend wrapperStyle={{ fontSize: 11 }} layout="horizontal" verticalAlign="bottom" />
        {total > 0 && <text x="50%" y="72%" textAnchor="middle" className="fill-ink text-xs font-semibold">{total} total</text>}
        {total === 0 && <text x="50%" y="72%" textAnchor="middle" className="fill-muted text-xs">{title}: no data yet</text>}
      </PieChart>
    </ResponsiveContainer>
  );
}
