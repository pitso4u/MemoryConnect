import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity, ArrowLeft, Building2, Check, CheckCircle2, Clock3, CreditCard, Copy, ExternalLink, Eye,
  FileText, FileClock, Flag, HardDrive, LayoutDashboard, Mail, Plus, QrCode, RefreshCw, Save,
  Server, Settings, ShieldAlert, Smartphone, Trash2, Truck, Users, WalletCards,
  BarChart3, Database, Sparkles, MapPin, ListChecks, HandHelping, CalendarDays,
  BadgeCheck, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  api, PlatformActivity, PlatformAnalytics, PlatformAuditLog, PlatformDashboard, PlatformFuneralHome,
  PlatformFuneralHomeDetail, PlatformHomeHealth, PlatformNotification, PlatformPayment,
  PlatformSummary, PlatformSupport, PlatformUser,
} from '../lib/api';
import type { PlatformCommercialSettings, MemorialCreditPurchase } from '@memorialconnect/shared';
import QRPreviewModal from '../components/memorial/QRPreviewModal';

const money = (cents = 0, currency = 'ZAR') => new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(cents / 100);
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Never';
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const timeAgo = (value?: string | null) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date(value);
};

const SERVICE_ICONS: Record<string, React.ElementType> = {
  api: Server,
  database: Database,
  storage: HardDrive,
  payments: CreditCard,
  email: Mail,
  qr: Activity,
  whatsapp: Smartphone,
};

const STATUS_DOT: Record<PlatformDashboard['health'][string]['status'], string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-400',
  critical: 'bg-red-500',
};

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-ink/10 bg-white px-5 py-6 sm:flex-row sm:items-end sm:justify-between lg:px-8">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-sage">Platform operations</p>
        <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      {action}
    </header>
  );
}

function Stat({ label: statLabel, value, note, icon: Icon }: { label: string; value: string | number; note?: string; icon: React.ElementType }) {
  return (
    <div className="border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{statLabel}</p>
        <Icon size={18} className="text-sage" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

function Status({ value }: { value: string }) {
  const good = ['ACTIVE', 'SUCCESS', 'PAID', 'PUBLISHED', 'ACCEPTED'].includes(value.toUpperCase());
  const warning = ['PENDING', 'DRAFT', 'UNPAID'].includes(value.toUpperCase());
  return <span className={`inline-flex px-2 py-1 text-xs font-semibold ${good ? 'bg-emerald-50 text-emerald-700' : warning ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{label(value)}</span>;
}

function Loading() {
  return <div className="grid min-h-64 place-items-center text-sm text-muted"><RefreshCw className="mb-2 animate-spin" />Loading platform data...</div>;
}

function ErrorMessage({ message }: { message: string }) {
  return <div role="alert" className="m-8 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>;
}

function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto border border-ink/10 bg-white"><table className="w-full min-w-[760px] text-left text-sm">{children}</table></div>;
}

function Head({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-ink/10 bg-parchment/60 text-xs uppercase text-muted"><tr>{children}</tr></thead>;
}

const Th = ({ children }: { children: React.ReactNode }) => <th className="px-4 py-3 font-semibold">{children}</th>;
const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={`border-t border-ink/8 px-4 py-3 align-top ${className || ''}`}>{children}</td>;

type GraphRange = 'today' | 'yesterday' | '7d' | '30d' | 'year';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function revenueSeries(range: GraphRange, points: PlatformDashboard['operations']['revenueGraph']): { label: string; revenueCents: number }[] {
  const day = 86400000;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (range === 'today') return points.filter((p) => p.ts === todayStart);
  if (range === 'yesterday') return points.filter((p) => p.ts === todayStart - day);
  if (range === '7d') return points.filter((p) => p.ts >= todayStart - 6 * day && p.ts <= todayStart);
  if (range === '30d') return points.filter((p) => p.ts >= todayStart - 29 * day && p.ts <= todayStart);
  const months: Record<string, { label: string; revenueCents: number; ts: number }> = {};
  for (const p of points) {
    const d = new Date(p.ts);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!months[key]) months[key] = { label: d.toLocaleString('en', { month: 'short' }), revenueCents: 0, ts: d.getTime() };
    months[key].revenueCents += p.revenueCents;
  }
  return Object.values(months).sort((a, b) => a.ts - b.ts).slice(-12);
}

const GRAPH_RANGE_LABELS: { key: GraphRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'year', label: 'Year' },
];

function PipelineChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-parchment/40 px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-muted"><span className={`block size-2.5 rounded-full ${color}`} />{label}</span>
      <strong className="text-xl text-ink">{value}</strong>
    </div>
  );
}

function FunnelBar({ label, value, drop, pct }: { label: string; value: number; drop?: boolean; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular-nums text-muted">{value.toLocaleString()}{drop ? ` (${pct}%)` : ''}</span>
      </div>
      <div className="h-3.5 overflow-hidden rounded bg-ink/8">
        <div className={`h-full ${drop ? 'bg-amber-400' : 'bg-sage'} transition-all`} style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
    </div>
  );
}

function Checklist({ data, onChange }: { data: Record<string, boolean>; onChange: (key: string, value: boolean) => void }) {
  const items = [
    'Check overnight payments and credit purchases',
    'Review today\u2019s memorial publishing schedule',
    'Contact funeral homes with unpublished drafts',
    'Verify Paystack webhooks are delivering',
    'Review failed photo / video uploads',
    'Confirm platform health services are green',
    'Work the support ticket queue',
    'Review analytics and conversion funnel',
  ];
  const done = Object.values(data).filter(Boolean).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium text-ink">Daily morning checklist</span>
        <span className="text-xs text-muted">{done}/{items.length} done · {pct}%</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded bg-ink/8">
        <div className="h-full bg-sage transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => {
          const key = `c${i}`;
          const checked = Boolean(data[key]);
          return (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={checked} onChange={(e) => onChange(key, e.target.checked)} className="mt-0.5 size-4 accent-sage" />
                <span className={checked ? 'text-muted line-through' : 'text-ink'}>{item}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function buildRecommendations(ops: PlatformDashboard['operations'] | null): { title: string; kind: 'action' | 'tip'; link?: string }[] {
  if (!ops) return [];
  const recs: { title: string; kind: 'action' | 'tip'; link?: string }[] = [];
  const drafts = ops.pipeline.draft;
  if (drafts > 0) recs.push({ title: `${drafts} memorial${drafts === 1 ? '' : 's'} sitting in draft — follow up with ${ops.upcomingServices[0]?.homeName || 'their funeral homes'} before service day.`, kind: 'action', link: '/admin-owner/funeral-homes' });
  ops.assistRequests.slice(0, 2).forEach((r) => recs.push({ title: `${r.homeName} — ${r.request}.`, kind: 'action', link: r.actionLink }));
  if (ops.todayRevenue.prevMonthCents > 0) {
    const pct = ((ops.todayRevenue.monthCents - ops.todayRevenue.prevMonthCents) / ops.todayRevenue.prevMonthCents) * 100;
    recs.push({ title: `Revenue is ${pct >= 0 ? '+' : ''}${Math.round(pct)}% vs last month.`, kind: 'tip' });
  }
  if (ops.upcomingServices.length > 0) {
    const todayCount = ops.upcomingServices.filter((s) => s.serviceDate && new Date(s.serviceDate).toDateString() === new Date().toDateString()).length;
    recs.push({ title: `${todayCount} funeral${todayCount === 1 ? '' : 's'} scheduled today across ${new Set(ops.upcomingServices.map((s) => s.homeName)).size} funeral homes.`, kind: 'tip' });
  }
  if (ops.todayMemorials.live > 0) recs.push({ title: `${ops.todayMemorials.live} memorials are live on the platform right now.`, kind: 'tip' });
  return recs.slice(0, 5);
}

export function PlatformDashboardPage() {
  const [dashboard, setDashboard] = useState<PlatformDashboard | null>(null);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [graphRange, setGraphRange] = useState<GraphRange>('30d');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const pollRef = useRef<number | null>(null);

  const load = async () => {
    try {
      const [dashboardData, summaryData, notificationData] = await Promise.all([
        api.getPlatformDashboard(),
        api.getPlatformSummary(),
        api.getPlatformNotifications(),
      ]);
      setDashboard(dashboardData);
      setSummary(summaryData);
      setNotifications(notificationData);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    pollRef.current = window.setInterval(() => {
      void load();
    }, 60000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const refresh = () => { setRefreshing(true); void load(); };

  const revenueChart = useMemo(
    () => (dashboard ? revenueSeries(graphRange, dashboard.operations.revenueGraph) : []),
    [graphRange, dashboard],
  );
  const recommendations = useMemo(
    () => buildRecommendations(dashboard ? dashboard.operations : null),
    [dashboard],
  );

  if (error) return <ErrorMessage message={error} />;
  if (loading || !dashboard || !summary) return <Loading />;

  const { health, activity, customerSuccess } = dashboard;
  const ops = dashboard.operations;
  const healthCount = Object.values(health).filter((s) => s.status === 'ok').length;
  const healthTotal = Object.values(health).length;
  const okServices = `${healthCount}/${healthTotal}`;
  const criticalAlerts = notifications.filter((n) => n.severity === 'critical').length;
  const todayWidget = [
    { label: 'Revenue', value: money(ops.todayRevenue.todayCents), note: 'today', icon: WalletCards },
    { label: 'Published', value: ops.todayMemorials.published, note: `of ${ops.todayMemorials.scheduled} scheduled today`, icon: CheckCircle2 },
    { label: 'Created', value: ops.todayMemorials.created, note: `${ops.todayMemorials.live} live total`, icon: FileText },
    { label: 'Need help', value: ops.assistRequests.length, note: 'homes requesting assistance', icon: HandHelping },
    { label: 'Failed payments', value: ops.todayRevenue.failedCount, note: money(ops.todayRevenue.failedCents), icon: AlertTriangle },
    { label: 'Platform health', value: okServices, note: 'services online', icon: ShieldAlert },
  ];

  const revenueTotal = revenueChart.reduce((s, p) => s + p.revenueCents, 0);
  const customerHealth = customerSuccess.customerHealth && customerSuccess.customerHealth.length
    ? customerSuccess.customerHealth
    : customerSuccess.atRiskHomes;

  const toggleCheck = (key: string, value: boolean) => setChecklist((c) => ({ ...c, [key]: value }));

  return (
    <>
      <PageHeader
        title="Command Center"
        description="Your daily operating picture."
        action={
          <div className="flex items-center gap-3">
            <button type="button" onClick={refresh} className="inline-flex items-center gap-2 border border-ink/15 bg-white px-3 py-2 text-sm font-semibold hover:border-sage">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <Link to="/admin-owner/funeral-homes" className="inline-flex items-center gap-2 border border-ink/15 bg-white px-3 py-2 text-sm font-semibold hover:border-sage">
              <BarChart3 size={14} /> Funeral homes
            </Link>
          </div>
        }
      />

      <div className="space-y-8 p-5 lg:p-8">
        {/* ── Good morning / date banner ── */}
        <section className="rounded-lg border border-ink/10 bg-gradient-to-r from-sage to-sage/70 px-6 py-5 text-white">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</p>
              <h2 className="mt-1 font-display text-3xl font-semibold">{greeting()}, Owner.</h2>
              <p className="mt-1 text-sm text-white/80">Here’s everything you need to run today’s operations.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
                <ShieldCheck size={16} /> {okServices} services healthy
              </div>
              {criticalAlerts > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full bg-red-500/90 px-4 py-2 text-sm font-semibold">
                  <AlertTriangle size={16} /> {criticalAlerts} critical alert{criticalAlerts === 1 ? '' : 's'}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Platform health strip ── */}
        <section>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            {Object.entries(health).map(([key, service]) => {
              const Icon = SERVICE_ICONS[key] || Activity;
              return (
                <div key={key} className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white px-4 py-3">
                  <span className={`block size-2.5 rounded-full ${STATUS_DOT[service.status]}`} />
                  <Icon size={16} className="text-muted" />
                  <div className="min-w-0">
                    <p className="font-medium">{service.label}</p>
                    {service.detail && <p className="text-xs text-muted">{service.detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Today widget (priority) ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase text-muted">Today at a glance</h2>
            <Link to="/admin-owner/funeral-homes" className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white hover:bg-ink/80">
              <HandHelping size={14} /> Assist funeral homes
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {todayWidget.map((item) => (
              <Stat key={item.label} label={item.label} value={item.value} note={item.note} icon={item.icon} />
            ))}
          </div>
        </section>

        {/* ── Today's memorials + revenue ── */}
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-lg border border-ink/10 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase text-muted">Today’s memorials</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Created" value={ops.todayMemorials.created} />
              <MiniStat label="Published" value={ops.todayMemorials.published} />
              <MiniStat label="Scheduled" value={ops.todayMemorials.scheduled} />
              <MiniStat label="Live" value={ops.todayMemorials.live} />
            </div>
            <p className="mt-3 text-xs text-muted">Scheduled = memorials whose service date falls today.</p>
          </section>

          <section className="rounded-lg border border-ink/10 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase text-muted">Today’s revenue</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MiniStat label="Today" value={money(ops.todayRevenue.todayCents)} />
              <MiniStat label="This week" value={money(ops.todayRevenue.weekCents)} />
              <MiniStat label="This month" value={money(ops.todayRevenue.monthCents)} />
              <MiniStat label="Pending" value={money(ops.todayRevenue.pendingCents)} color={ops.todayRevenue.pendingCount ? 'text-amber-600' : undefined} />
              <MiniStat label="Failed" value={money(ops.todayRevenue.failedCents)} color={ops.todayRevenue.failedCount ? 'text-red-600' : undefined} />
            </div>
            <p className="mt-3 text-xs text-muted">Payments and memorial credit purchases.</p>
          </section>
        </div>

        {/* ── Upcoming services (Wed/Thu operations) ── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Upcoming services · next 7 days</h2>
          <div className="overflow-x-auto border border-ink/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink/10 bg-parchment/60 text-xs uppercase text-muted">
                <tr>
                  <Th>When</Th>
                  <Th>Deceased</Th>
                  <Th>Funeral home</Th>
                  <Th>Venue</Th>
                  <Th>Memorial status</Th>
                </tr>
              </thead>
              <tbody>
                {ops.upcomingServices.length === 0 ? (
                  <tr><td colSpan={5} className="p-5 text-sm text-muted">No services scheduled in the next 7 days.</td></tr>
                ) : ops.upcomingServices.map((s) => (
                  <tr key={s.id}>
                    <Td><span className="inline-flex items-center gap-2"><CalendarDays size={14} className="text-sage" />{date(s.serviceDate)}</span></Td>
                    <Td><Link to={`/admin-owner/funeral-homes/${s.homeId}`} className="font-medium text-sage hover:underline">{s.deceasedName}</Link></Td>
                    <Td>{s.homeName}</Td>
                    <Td className="text-muted">{s.serviceVenue || '—'}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Status value={s.published ? 'PUBLISHED' : s.status === 'DRAFT' ? 'DRAFT' : s.status} />
                        {s.missingCover && <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><AlertTriangle size={12} />no photo</span>}
                        {s.serviceDate && !s.published && <span className="text-xs text-muted">{timeAgoClose(s.serviceDate)}</span>}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          {/* ── Funeral homes requiring attention ── */}
          <section className="rounded-lg border border-ink/10 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase text-muted">Funeral homes requiring attention</h2>
            {ops.requiringAttention.length === 0 ? (
              <p className="text-sm text-muted">No homes require attention right now.</p>
            ) : (
              <ul className="divide-y divide-ink/8">
                {ops.requiringAttention.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-3">
                    <span className={`mt-1 block size-2.5 shrink-0 rounded-full ${item.severity === 'critical' ? 'bg-red-500' : item.severity === 'warning' ? 'bg-amber-400' : 'bg-sky-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted">{item.detail} · {item.reason}</p>
                    </div>
                    {item.link && <Link to={item.link} className="shrink-0 text-xs font-semibold text-sage hover:underline">Open</Link>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Live activity feed ── */}
          <section className="rounded-lg border border-ink/10 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase text-muted">Live activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-muted">No activity in the last 12 hours.</p>
            ) : (
              <ul className="divide-y divide-ink/8">
                {activity.map((item) => <ActivityRow key={item.id} item={item} />)}
              </ul>
            )}
          </section>
        </div>

        {/* ── Revenue graph ── */}
        <section className="rounded-lg border border-ink/10 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase text-muted">Revenue</h2>
              <p className="mt-1 font-display text-3xl font-semibold text-ink">{money(revenueTotal)}</p>
            </div>
            <div className="inline-flex flex-wrap gap-1 rounded-full border border-ink/15 bg-white p-1">
              {GRAPH_RANGE_LABELS.map((r) => (
                <button key={r.key} type="button" onClick={() => setGraphRange(r.key)} className={`rounded-full px-3 py-1 text-xs font-semibold ${graphRange === r.key ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{r.label}</button>
              ))}
            </div>
          </div>
          {revenueChart.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No revenue in the selected period.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => `R${(v / 100).toFixed(0)}k`} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(value) => [money(Number(value)), 'Revenue']} />
                  <Bar dataKey="revenueCents" fill="#3f7d58" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* ── Conversion funnel ── */}
          <section className="rounded-lg border border-ink/10 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase text-muted">Conversion funnel</h2>
            <div className="space-y-4">
              <FunnelBar label="Visited website" value={ops.funnel.visitedWebsite} pct={100} />
              <FunnelBar label="Registered" value={ops.funnel.registered} drop pct={ops.funnel.visitedWebsite ? Math.round((ops.funnel.registered / ops.funnel.visitedWebsite) * 100) : 0} />
              <FunnelBar label="Started trial" value={ops.funnel.startedTrial} drop pct={ops.funnel.visitedWebsite ? Math.round((ops.funnel.startedTrial / ops.funnel.visitedWebsite) * 100) : 0} />
              <FunnelBar label="Published memorial" value={ops.funnel.publishedMemorial} drop pct={ops.funnel.visitedWebsite ? Math.round((ops.funnel.publishedMemorial / ops.funnel.visitedWebsite) * 100) : 0} />
              <FunnelBar label="Paid" value={ops.funnel.paid} drop pct={ops.funnel.visitedWebsite ? Math.round((ops.funnel.paid / ops.funnel.visitedWebsite) * 100) : 0} />
            </div>
            <p className="mt-3 text-xs text-muted">Visited website is modelled from registration volume.</p>
          </section>

          {/* ── Memorial pipeline ── */}
          <section className="rounded-lg border border-ink/10 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase text-muted">Memorial pipeline</h2>
            <div className="grid grid-cols-1 gap-2">
              <PipelineChip label="Draft" value={ops.pipeline.draft} color="bg-slate-400" />
              <PipelineChip label="Ready" value={ops.pipeline.ready} color="bg-sky-400" />
              <PipelineChip label="Scheduled" value={ops.pipeline.scheduled} color="bg-amber-400" />
              <PipelineChip label="Published" value={ops.pipeline.published} color="bg-emerald-500" />
              <PipelineChip label="Archived" value={ops.pipeline.archived} color="bg-ink/30" />
            </div>
          </section>

          {/* ── Geographic insights ── */}
          <section className="rounded-lg border border-ink/10 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase text-muted">Geographic insights</h2>
            {ops.geographic.length === 0 ? (
              <p className="text-sm text-muted">No branch locations recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {ops.geographic.slice(0, 8).map((g) => {
                  const max = Math.max(...ops.geographic.map((x) => x.homes)) || 1;
                  return (
                    <li key={g.province}>
                      <div className="mb-1 flex items-baseline justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium text-ink"><MapPin size={14} className="text-sage" />{g.province}</span>
                        <span className="tabular-nums text-muted">{g.homes} {g.homes === 1 ? 'home' : 'homes'}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-ink/8"><div className="h-full bg-sage" style={{ width: `${Math.max(4, (g.homes / max) * 100)}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* ── Customer health ── */}
        <section className="rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase text-muted">Customer health</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink/10 bg-parchment/60 text-xs uppercase text-muted">
                <tr><Th>Home</Th><Th>Score</Th><Th>Status</Th><Th>Reasons</Th></tr>
              </thead>
              <tbody>
                {(customerHealth?.length ? customerHealth : []).map((row) => (
                  <tr key={row.id}>
                    <Td><Link to={`/admin-owner/funeral-homes/${row.id}`} className="font-medium text-sage hover:underline">{row.name}</Link></Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded bg-ink/8"><div className="h-full bg-sage" style={{ width: `${row.score ?? 0}%` }} /></div>
                        <strong className="tabular-nums">{row.score ?? 0}%</strong>
                      </div>
                    </Td>
                    <Td><span className="inline-flex items-center gap-1 text-xs font-semibold"><BadgeCheck size={13} className="text-sage" />{row.segmentLabel}</span></Td>
                    <Td className="text-muted">{row.reasons.slice(0, 2).join(' · ') || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          {/* ── AI recommendations ── */}
          <section className="rounded-lg border border-ink/10 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase text-muted"><Sparkles size={14} className="text-amber-500" />Recommendations</h2>
            <ul className="space-y-2">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg bg-parchment/50 px-3 py-2.5 text-sm">
                  {rec.link ? <Link to={rec.link} className="text-sage hover:underline">{rec.title}</Link> : <span className="text-ink">{rec.title}</span>}
                </li>
              ))}
            </ul>
          </section>

          {/* ── Assist mode ── */}
          <section className="rounded-lg border border-ink/10 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase text-muted"><HandHelping size={14} className="text-sage" />Funeral homes requesting help</h2>
            {ops.assistRequests.length === 0 ? (
              <p className="text-sm text-muted">No homes requesting assistance right now.</p>
            ) : (
              <ul className="space-y-2">
                {ops.assistRequests.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-ink/10 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium">{r.homeName}</p>
                      <p className="text-sm text-muted">{r.request}{r.detail ? ` — ${r.detail}` : ''}</p>
                    </div>
                    <Link to={r.actionLink} className="shrink-0 rounded-full bg-sage px-3 py-1.5 text-xs font-semibold text-white hover:bg-sage-dark">Assist</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── Daily checklist ── */}
        <section className="rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase text-muted"><ListChecks size={14} className="text-sage" />Morning routine</h2>
          <Checklist data={checklist} onChange={toggleCheck} />
        </section>
      </div>
    </>
  );
}

function timeAgoClose(value: string): string {
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return 'today';
  const days = Math.ceil(diff / 86400000);
  return days === 1 ? 'tomorrow' : `${days}d away`;
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-ink">{value}</p>
      <p className="text-xs text-muted">{label}</p>
      {color ? <p className={color} /> : null}
    </div>
  );
}

function ActivityRow({ item }: { item: PlatformActivity }) {
  const Icon = activityIcon(item.type);
  return (
    <li className="flex items-start gap-3 p-4">
      <Icon size={16} className="mt-0.5 text-sage" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{item.title}</p>
        <p className="text-sm text-muted">{item.detail}</p>
        {item.funeralHomeName && <p className="text-xs text-muted">{item.funeralHomeName}</p>}
      </div>
      <Link to={item.link} className="shrink-0 text-xs font-semibold text-sage hover:underline">
        Open
      </Link>
      <time dateTime={item.createdAt || undefined} className="shrink-0 text-xs text-muted">
        {timeAgo(item.createdAt)}
      </time>
    </li>
  );
}

const ACTIVITY_ICONS: Record<PlatformActivity['type'], React.ElementType> = {
  memorial: FileText,
  payment: CreditCard,
  home: Building2,
  feature: Flag,
  audit: FileClock,
};
function activityIcon(type: PlatformActivity['type']) {
  return ACTIVITY_ICONS[type] || Activity;
}

export function PlatformFuneralHomesPage() {
  const [homes, setHomes] = useState<PlatformFuneralHome[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getPlatformFuneralHomes().then(setHomes).catch((err: Error) => setError(err.message)); }, []);
  if (error) return <ErrorMessage message={error} />;
  if (!homes) return <Loading />;
  return (
    <>
      <PageHeader title="Funeral Homes" description={`${homes.length} registered organisations and their platform activity.`} />
      <div className="p-5 lg:p-8"><Table><Head><Th>Funeral home</Th><Th>Contact</Th><Th>Registered</Th><Th>Memorials</Th><Th>Payments</Th><Th>Last activity</Th><Th>Status</Th><Th>Action</Th></Head>
        <tbody>{homes.map((home) => <tr key={home.id}><Td><strong>{home.name}</strong><div className="text-xs text-muted">{home.ownerName || 'No admin assigned'}</div></Td><Td>{home.email}<div className="text-xs text-muted">{home.phone || 'No phone'}</div></Td><Td>{date(home.registeredAt)}</Td><Td>{home.memorialCount}</Td><Td>{money(home.paymentsTotalCents)}</Td><Td>{date(home.lastActivityAt)}</Td><Td><Status value={home.status} /></Td><Td><Link className="font-semibold text-sage hover:underline" to={`/admin-owner/funeral-homes/${home.id}`}>View details</Link></Td></tr>)}</tbody>
      </Table></div>
    </>
  );
}

export function PlatformPaymentsPage() {
  const [payments, setPayments] = useState<PlatformPayment[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getPlatformPayments().then(setPayments).catch((err: Error) => setError(err.message)); }, []);
  const total = useMemo(() => payments?.filter((payment) => ['SUCCESS', 'PAID', 'VERIFIED'].includes(payment.status.toUpperCase())).reduce((sum, payment) => sum + payment.amountCents, 0) || 0, [payments]);
  if (error) return <ErrorMessage message={error} />;
  if (!payments) return <Loading />;
  return (
    <>
      <PageHeader title="Payments" description="Paystack references and funeral publication payment history." />
      <div className="space-y-5 p-5 lg:p-8"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Recorded payments" value={payments.length} icon={CreditCard} /><Stat label="Successful revenue" value={money(total)} icon={WalletCards} /><Stat label="Needs attention" value={payments.filter((payment) => payment.status !== 'SUCCESS').length} icon={ShieldAlert} /></div>
      <Table><Head><Th>Date</Th><Th>Funeral home</Th><Th>Memorial</Th><Th>Reference</Th><Th>Amount</Th><Th>Status</Th></Head><tbody>{payments.map((payment) => <tr key={payment.id}><Td>{date(payment.createdAt)}</Td><Td>{payment.funeralHome.name}</Td><Td>{payment.memorial.deceasedName}</Td><Td><span className="font-mono text-xs">{payment.paystackReference}</span></Td><Td>{money(payment.amountCents)}</Td><Td><Status value={payment.status} /></Td></tr>)}</tbody></Table></div>
    </>
  );
}

export function PlatformUsersPage() {
  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api.getPlatformUsers().then(setUsers).catch((err: Error) => setError(err.message)); }, []);
  const sendReset = async (user: PlatformUser) => {
    if (!confirm(`Generate a password reset link for ${user.email}?`)) return;
    try {
      const result = await api.sendPlatformPasswordReset(user.id);
      await navigator.clipboard.writeText(result.resetUrl);
      setMessage(`Reset link copied for ${result.email}`);
    } catch (err) { setError((err as Error).message); }
  };
  if (error) return <ErrorMessage message={error} />;
  if (!users) return <Loading />;
  return (
    <>
      <PageHeader title="Users" description="Account readiness, roles, and recent access across the platform." />
      <div className="space-y-4 p-5 lg:p-8">{message && <div className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}<Table><Head><Th>User</Th><Th>Role</Th><Th>Funeral home</Th><Th>Password</Th><Th>Reset requests</Th><Th>Last login</Th><Th>Action</Th></Head><tbody>{users.map((user) => <tr key={user.id}><Td><strong>{user.name}</strong><div className="text-xs text-muted">{user.email}</div></Td><Td>{label(user.role)}</Td><Td>{user.funeralHome?.name || 'Platform / family'}</Td><Td>{user.passwordSetAt ? 'Set' : 'Not set'}</Td><Td>{user.passwordResetTokens.length}</Td><Td>{date(user.lastLoginAt)}</Td><Td><button type="button" onClick={() => sendReset(user)} className="font-semibold text-sage hover:underline">Send reset link</button></Td></tr>)}</tbody></Table></div>
    </>
  );
}

export function PlatformSupportPage() {
  const [support, setSupport] = useState<PlatformSupport | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api.getPlatformSupport().then(setSupport).catch((err: Error) => setError(err.message)); }, []);
  const reset = async (id: string) => {
    try { const result = await api.sendPlatformPasswordReset(id); await navigator.clipboard.writeText(result.resetUrl); setMessage('Reset link copied'); }
    catch (err) { setError((err as Error).message); }
  };
  if (error) return <ErrorMessage message={error} />;
  if (!support) return <Loading />;
  return (
    <>
      <PageHeader title="Support" description="Signals that may need owner assistance." />
      <div className="space-y-6 p-5 lg:p-8">{message && <div className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Open reset requests" value={support.resetRequests.length} icon={ShieldAlert} /><Stat label="Recent failed logins" value={support.failedLogins.length} icon={Activity} /><Stat label="Pending invitations" value={support.pendingInvites} icon={Clock3} /><Stat label="Expired invitations" value={support.expiredInvites} icon={ShieldAlert} /></div>
      <section><h2 className="mb-3 text-lg font-semibold">Users needing help</h2><Table><Head><Th>User</Th><Th>Role</Th><Th>Funeral home</Th><Th>Action</Th></Head><tbody>{support.usersWithoutPasswords.map((user) => <tr key={user.id}><Td>{user.name}<div className="text-xs text-muted">{user.email}</div></Td><Td>{label(user.role)}</Td><Td>{user.funeralHome?.name || 'Family account'}</Td><Td><button type="button" onClick={() => reset(user.id)} className="font-semibold text-sage hover:underline">Generate reset link</button></Td></tr>)}</tbody></Table></section>
      <section><h2 className="mb-3 text-lg font-semibold">Failed login attempts</h2><Table><Head><Th>Email</Th><Th>Attempted</Th></Head><tbody>{support.failedLogins.map((attempt) => <tr key={attempt.id}><Td>{attempt.email}</Td><Td>{date(attempt.createdAt)}</Td></tr>)}</tbody></Table></section></div>
    </>
  );
}

export function PlatformAnalyticsPage() {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getPlatformAnalytics().then(setAnalytics).catch((err: Error) => setError(err.message)); }, []);
  if (error) return <ErrorMessage message={error} />;
  if (!analytics) return <Loading />;
  return (
    <>
      <PageHeader title="Analytics" description="Unique public reach, organisation performance, and 72-hour memorial growth." />
      <div className="space-y-6 p-5 lg:p-8"><div className="grid gap-3 sm:grid-cols-2"><Stat label="Total public views" value={analytics.totalViews.toLocaleString()} icon={Eye} /><Stat label="Views today" value={analytics.viewsToday.toLocaleString()} icon={Activity} /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Average first-day views" value={String(analytics.performance.averageFirstDayViews)} icon={Activity} />
        <Stat label="Average 72-hour views" value={String(analytics.performance.average72HourViews)} icon={BarChart3} />
        <Stat label="100+ view memorials" value={String(analytics.performance.memorialsOver100Views)} icon={Eye} />
        <Stat label="500+ view memorials" value={String(analytics.performance.memorialsOver500Views)} icon={Sparkles} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="border border-ink/10 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Trending Memorials</h2>
            <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold-dark">{analytics.performance.monitoringCount} in 72h window</span>
          </div>
          {analytics.performance.trendingMemorials.length === 0 ? (
            <p className="text-sm text-muted">No memorials are currently in their 72-hour monitoring window.</p>
          ) : (
            <ol className="space-y-3">
              {analytics.performance.trendingMemorials.map((item) => (
                <li key={item.id} className="flex items-center gap-3 border-b border-ink/8 pb-3 last:border-0">
                  <span className="flex items-center gap-1 shrink-0 text-base">{item.highestMilestoneAwarded || ''}</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{item.deceasedName}</strong>
                    <span className="block truncate text-xs text-muted">{item.funeralHome.name}</span>
                  </span>
                  <span className="flex items-center gap-1 text-sm font-semibold"><Eye size={13} />{item.currentDayViews}</span>
                  <span className="rounded-full bg-parchment px-2 py-0.5 text-xs font-semibold">Day {item.day}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <Ranking title="Most viewed memorials" rows={analytics.mostViewedMemorials.map((item) => ({ name: item.deceasedName, context: item.funeralHome.name, value: item.viewCount.toLocaleString() }))} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2"><Ranking title="Top by memorial count" rows={analytics.topHomesByMemorials.map((item) => ({ name: item.name, value: String(item.memorialCount) }))} /><Ranking title="Top by revenue" rows={analytics.topHomesByRevenue.map((item) => ({ name: item.name, value: money(item.revenueCents) }))} /></div></div>
    </>
  );
}

function Ranking({ title, rows }: { title: string; rows: Array<{ name: string; context?: string; value: string }> }) {
  return <section className="border border-ink/10 bg-white p-5"><h2 className="mb-4 font-semibold">{title}</h2><ol className="space-y-3">{rows.map((row, index) => <li key={`${row.name}-${index}`} className="flex items-center gap-3 border-b border-ink/8 pb-3 last:border-0"><span className="grid size-7 place-items-center bg-parchment text-xs font-bold">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{row.name}</strong>{row.context && <span className="block truncate text-xs text-muted">{row.context}</span>}</span><span className="font-semibold">{row.value}</span></li>)}</ol></section>;
}

export function PlatformAuditLogsPage() {
  const [logs, setLogs] = useState<PlatformAuditLog[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getPlatformAuditLogs().then(setLogs).catch((err: Error) => setError(err.message)); }, []);
  if (error) return <ErrorMessage message={error} />;
  if (!logs) return <Loading />;
  return <><PageHeader title="Audit Logs" description="Immutable record of platform owner activity." /><div className="p-5 lg:p-8"><Table><Head><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Funeral home</Th></Head><tbody>{logs.map((log) => <tr key={log.id}><Td>{date(log.createdAt)}</Td><Td>{log.actor.name}<div className="text-xs text-muted">{log.actor.email}</div></Td><Td>{label(log.action)}</Td><Td>{label(log.targetType)}<div className="font-mono text-xs text-muted">{log.targetId}</div></Td><Td>{log.funeralHome?.name || '-'}</Td></tr>)}</tbody></Table></div></>;
}

export function PlatformFuneralHomeDetailPage() {
  const { id = '' } = useParams();
  const [home, setHome] = useState<PlatformFuneralHomeDetail | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{ open: boolean; url: string; slug: string; deceasedName: string }>({
    open: false, url: '', slug: '', deceasedName: '',
  });
  const load = () => api.getPlatformFuneralHome(id).then(setHome).catch((err: Error) => setError(err.message));
  useEffect(() => { void load(); }, [id]);
  const [activeTab, setActiveTab] = useState('overview');
  const toggleStatus = async () => {
    if (!home) return;
    const suspend = home.status === 'ACTIVE';
    if (!confirm(`${suspend ? 'Suspend' : 'Reactivate'} ${home.name}?`)) return;
    try { suspend ? await api.suspendPlatformFuneralHome(home.id) : await api.reactivatePlatformFuneralHome(home.id); setMessage(`${home.name} ${suspend ? 'suspended' : 'reactivated'}`); load(); }
    catch (err) { setError((err as Error).message); }
  };
  const reset = async (user: PlatformUser) => {
    if (!confirm(`Generate a password reset link for ${user.email}?`)) return;
    try { const result = await api.sendPlatformPasswordReset(user.id); await navigator.clipboard.writeText(result.resetUrl); setMessage(`Reset link copied for ${user.email}`); }
    catch (err) { setError((err as Error).message); }
  };
  const resend = async (inviteId: string) => {
    if (!confirm('Resend this family invitation?')) return;
    try { const invite = await api.resendPlatformInvite(inviteId); if (invite.inviteUrl) await navigator.clipboard.writeText(invite.inviteUrl); setMessage('Fresh invitation link copied'); load(); }
    catch (err) { setError((err as Error).message); }
  };
  const verify = async (payment: PlatformPayment) => {
    if (!confirm(`Manually verify payment ${payment.paystackReference}? This action is audited.`)) return;
    try { await api.verifyPlatformPayment(payment.id); setMessage('Payment marked verified'); load(); }
    catch (err) { setError((err as Error).message); }
  };
  const removeMemorial = async (memorialId: string, deceasedName: string) => {
    if (!confirm(`Permanently delete the memorial for ${deceasedName}? This action cannot be undone and will be audited.`)) return;
    try { await api.deletePlatformMemorial(memorialId); setMessage('Memorial deleted'); load(); }
    catch (err) { setError((err as Error).message); }
  };
  if (error) return <ErrorMessage message={error} />;
  if (!home) return <Loading />;

  const totalStorage = home.memorials.reduce((sum, m) => sum + (m.storageBytes ?? 0), 0);
  const tabs: Array<{ id: string; label: string; icon: React.ElementType }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'memorials', label: 'Memorials', icon: FileText },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'invitations', label: 'Invitations', icon: Mail },
    { id: 'features', label: 'Feature Flags', icon: Flag },
    { id: 'vehicles', label: 'Operations', icon: Truck },
    { id: 'audit', label: 'Audit Logs', icon: FileClock },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <PageHeader
        title={home.name}
        description={`Registered ${date(home.createdAt)}${home.health ? ` · ${home.health.label}` : ''}`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admin-owner/funeral-homes" className="inline-flex items-center gap-2 border border-ink/15 bg-white px-4 py-2 text-sm font-semibold">
              <ArrowLeft size={16} /> Back
            </Link>
            <button
              type="button"
              onClick={toggleStatus}
              className={`px-4 py-2 text-sm font-semibold text-white ${home.status === 'ACTIVE' ? 'bg-red-700' : 'bg-emerald-700'}`}
            >
              {home.status === 'ACTIVE' ? 'Suspend home' : 'Reactivate home'}
            </button>
          </div>
        }
      />
      <div className="space-y-0 p-5 lg:p-8">
        {message && <div className="mb-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
        <nav className="-mx-5 border-b border-ink/10 bg-white px-5 lg:mx-8 lg:px-8">
          <ul className="flex flex-wrap gap-1 text-sm font-medium">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3 ${
                    activeTab === tab.id ? 'border-sage text-sage' : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  <tab.icon size={16} /> {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border border-ink/10 bg-white p-5">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {home.health && <HealthBadge health={home.health} />}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Status"><Status value={home.status} /></Detail>
                <Detail label="Email">{home.email}</Detail>
                <Detail label="Phone">{home.phone || 'Not supplied'}</Detail>
                <Detail label="Brand">{home.tradingName || home.name}</Detail>
                <Detail label="Plan / edition">{`${home.plan || 'professional'} / ${home.edition || 'MEMORIAL'}`}</Detail>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Trial">{home.trialStartsAt ? (home.trialEndsAt && new Date(home.trialEndsAt) > new Date() ? `Active · ${Math.max(0, Math.ceil((new Date(home.trialEndsAt).getTime() - Date.now()) / 86400000))} days left` : 'Expired') : 'No trial'}</Detail>
                <Detail label="Free memorials used">{home.trialMemorialsUsed ?? 0}</Detail>
                <Detail label="Credits remaining">{home.memorialCreditsRemaining ?? 0}</Detail>
                <Detail label="Credits purchased">{home.memorialCreditsPurchased ?? 0}</Detail>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Memorials">{home._count?.memorials ?? home.memorials.length}</Detail>
                <Detail label="Users">{home._count?.users ?? home.users.length}</Detail>
                <Detail label="Vehicles">{home._count?.vehicles ?? 0}</Detail>
                <Detail label="Assets">{home._count?.assets ?? 0}</Detail>
              </div>
              <section>
                <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
                <Table><Head><Th>When</Th><Th>Action</Th><Th>Target</Th><Th>By</Th></Head><tbody>
                  {(home.platformAuditLogs ?? []).slice(0, 10).map((log) => (
                    <tr key={log.id}>
                      <Td>{timeAgo(log.createdAt)}</Td><Td>{label(log.action)}</Td>
                      <Td><span className="font-mono text-xs text-muted">{label(log.targetType)} / {log.targetId}</span></Td><Td>{log.actor.name}</Td>
                    </tr>
                  ))}
                </tbody></Table></section>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-3">
              <p className="text-sm text-muted">{home.users.length} user{home.users.length === 1 ? '' : 's'}</p>
              <Table><Head><Th>Name</Th><Th>Role</Th><Th>Password</Th><Th>Last login</Th><Th>Created</Th><Th>Action</Th></Head><tbody>{home.users.map((user) => <tr key={user.id}><Td>{user.name}<div className="text-xs text-muted">{user.email}</div></Td><Td>{label(user.role)}</Td><Td>{user.passwordSetAt ? 'Set' : 'Not set'}</Td><Td>{date(user.lastLoginAt)}</Td><Td>{date(user.createdAt)}</Td><Td><button type="button" onClick={() => reset(user)} className="font-semibold text-sage hover:underline">Send reset link</button></Td></tr>)}</tbody></Table>
            </div>
          )}

          {activeTab === 'memorials' && (
            <Table>
              <Head><Th>Memorial</Th><Th>Created</Th><Th>Status</Th><Th>Payment</Th><Th>Actions</Th></Head>
              <tbody>
                {home.memorials.map((memorial) => {
                  const handlePreview = async () => {
                    try {
                      const data = await api.getMemorialPublicUrl(memorial.id);
                      window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
                    } catch {
                      window.open(`https://memoryconnect.co.za/${memorial.slug}`, '_blank', 'noopener,noreferrer');
                    }
                  };
                  const handleCopy = async () => {
                    await navigator.clipboard.writeText(`https://memoryconnect.co.za/${memorial.slug}`);
                    setCopiedId(memorial.id);
                    setTimeout(() => setCopiedId(null), 2000);
                  };
                  const handleQR = async () => {
                    try {
                      const data = await api.getMemorialPublicUrl(memorial.id);
                      setQrModal({ open: true, url: data.qrCodeUrl, slug: memorial.slug, deceasedName: memorial.deceasedName });
                    } catch {
                      setQrModal({ open: true, url: `https://memoryconnect.co.za/${memorial.slug}`, slug: memorial.slug, deceasedName: memorial.deceasedName });
                    }
                  };
                  return (
                    <tr key={memorial.id}>
                      <Td>{memorial.deceasedName}</Td><Td>{date(memorial.createdAt)}</Td>
                      <Td><Status value={memorial.deletedAt ? 'DELETED' : memorial.status} /></Td><Td>{memorial.paymentStatus}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={handlePreview} className="inline-flex items-center gap-1 text-xs font-semibold text-sage hover:underline"><ExternalLink size={12} /> Preview</button>
                          <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1 text-xs font-semibold text-sage hover:underline">{copiedId === memorial.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy URL</>}</button>
                          <button type="button" onClick={handleQR} className="inline-flex items-center gap-1 text-xs font-semibold text-sage hover:underline"><QrCode size={12} /> QR</button>
                          <button type="button" onClick={() => removeMemorial(memorial.id, memorial.deceasedName)} className="font-semibold text-red-700 hover:underline text-xs">Delete</button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-6">
              <Table>
                <Head><Th>Reference</Th><Th>Memorial</Th><Th>Amount</Th><Th>Status</Th><Th>Created</Th><Th>Action</Th></Head>
                <tbody>
                  {home.payments.map((payment) => (
                    <tr key={payment.id}>
                      <Td><span className="font-mono text-xs">{payment.paystackReference}</span></Td>
                      <Td>{payment.memorial.deceasedName}</Td><Td>{money(payment.amountCents)}</Td>
                      <Td><Status value={payment.status} /></Td><Td>{date(payment.createdAt)}</Td>
                      <Td>{payment.status !== 'SUCCESS' && <button type="button" onClick={() => verify(payment)} className="font-semibold text-sage hover:underline">Mark verified</button>}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {(home.creditPurchases ?? []).length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-muted">Credit purchases</h3>
                  <Table><Head><Th>Reference</Th><Th>Credits</Th><Th>Amount</Th><Th>Status</Th></Head><tbody>{home.creditPurchases.map((purchase) => <tr key={purchase.id}><Td><span className="font-mono text-xs">{purchase.paystackReference}</span></Td><Td>{purchase.credits}</Td><Td>{money(purchase.amountCents)}</Td><Td><Status value={purchase.status} /></Td></tr>)}</tbody></Table>
                </>
              )}
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-muted">Total storage used across this home's memorial content</p>
                <p className="text-2xl font-semibold">{bytes(home.storageBytes ?? totalStorage)}</p>
              </div>
              <Table>
                <Head><Th>Memorial</Th><Th>Created</Th><Th>Storage</Th></Head>
                <tbody>
                  {home.memorials
                    .map((m) => ({ storage: m.storageBytes ?? 0, name: m.deceasedName, created: m.createdAt }))
                    .sort((a, b) => b.storage - a.storage)
                    .slice(0, 20)
                    .map((m) => (
                      <tr key={m.name}>
                        <Td>{m.name}</Td><Td>{date(m.created)}</Td><Td>{bytes(m.storage)}</Td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </div>
          )}

          {activeTab === 'invitations' && (
            <Table><Head><Th>Invitee</Th><Th>Memorial</Th><Th>Role</Th><Th>Expires</Th><Th>Action</Th></Head><tbody>{home.familyInvitations.map((invite) => <tr key={invite.id}><Td>{invite.name}<div className="text-xs text-muted">{invite.email || invite.phone || 'No contact'}</div></Td><Td>{invite.memorial.deceasedName}</Td><Td>{label(invite.role)}</Td><Td>{date(invite.expiresAt)}</Td><Td><button type="button" onClick={() => resend(invite.id)} className="font-semibold text-sage hover:underline">Resend invite</button></Td></tr>)}</tbody></Table>
          )}

          {activeTab === 'features' && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                {home.featureOverrides.length} override{home.featureOverrides.length === 1 ? '' : 's'} for this home.{' '}
                <Link to="/admin-owner/features" className="text-sage hover:underline">Manage all feature flags</Link>
              </p>
              {home.featureOverrides.length === 0 ? (
                <p className="text-sm text-muted">No overrides — this home resolves the global feature set.</p>
              ) : (
                <Table><Head><Th>Feature</Th><Th>Key</Th><Th>Channel</Th><Th>Enabled</Th></Head><tbody>{home.featureOverrides.map((override) => (
                  <tr key={override.featureKey}>
                    <Td>{override.feature?.name || override.featureKey}</Td>
                    <Td><span className="font-mono text-xs">{override.featureKey}</span></Td>
                    <Td>{override.releaseChannelOverride || override.feature?.releaseChannel || '—'}</Td>
                    <Td>{override.enabled ? 'Yes' : 'No'}</Td>
                  </tr>
                ))}</tbody></Table>
              )}
            </div>
          )}

          {activeTab === 'vehicles' && (
            <div className="space-y-6">
              <section>
                <h2 className="mb-3 text-lg font-semibold">Vehicles ({home.vehicles.length})</h2>
                <Table><Head><Th>Name</Th><Th>Registration</Th><Th>Type</Th><Th>Status</Th></Head><tbody>{home.vehicles.map((v) => <tr key={v.id}><Td>{v.name}</Td><Td>{v.registrationNumber}</Td><Td>{v.vehicleType}</Td><Td><Status value={v.status} /></Td></tr>)}</tbody></Table>
              </section>
              <section>
                <h2 className="mb-3 text-lg font-semibold">Assets ({home.assets.length})</h2>
                <Table><Head><Th>Name</Th><Th>Category</Th><Th>Status</Th></Head><tbody>{home.assets.map((a) => <tr key={a.id}><Td>{a.name}</Td><Td>{a.category}</Td><Td><Status value={a.status} /></Td></tr>)}</tbody></Table>
              </section>
            </div>
          )}

          {activeTab === 'audit' && (
            <Table><Head><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Funeral home</Th></Head><tbody>{home.platformAuditLogs.map((log) => <tr key={log.id}><Td>{date(log.createdAt)}</Td><Td>{log.actor.name}<div className="text-xs text-muted">{log.actor.email}</div></Td><Td>{label(log.action)}</Td><Td>{label(log.targetType)}<div className="font-mono text-xs text-muted">{log.targetId}</div></Td><Td>{log.funeralHome?.name || '-'}</Td></tr>)}</tbody></Table>
          )}

          {activeTab === 'settings' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Trading name">{home.tradingName || home.name}</Detail>
              <Detail label="Email">{home.email}</Detail>
              <Detail label="Phone">{home.phone || '—'}</Detail>
              <Detail label="Address">{home.address || '—'}</Detail>
              <Detail label="Website">{home.websiteUrl || '—'}</Detail>
              <Detail label="WhatsApp">{home.whatsapp || '—'}</Detail>
              <Detail label="Plan">{home.plan || 'professional'}</Detail>
              <Detail label="Edition">{home.edition || 'MEMORIAL'}</Detail>
              <Detail label="White label">{home.whiteLabelEnabled ? 'Enabled' : 'Disabled'}</Detail>
              <Detail label="Theme template">{home.themeTemplate || 'classic'}</Detail>
            </div>
          )}
        </div>
      </div>
      <QRPreviewModal
        open={qrModal.open}
        onClose={() => setQrModal({ ...qrModal, open: false })}
        url={qrModal.url}
        slug={qrModal.slug}
        deceasedName={qrModal.deceasedName}
      />
    </>
  );
}

function HealthBadge({ health }: { health: PlatformHomeHealth }) {
  const colorClasses: Record<PlatformHomeHealth['color'], string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return (
    <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold ${colorClasses[health.color]}`}>
      <span className="block size-2 rounded-full bg-current" />
      <span>{health.label}</span>
      <span className="text-muted/80">—</span>
      <span className="max-w-md truncate">{health.reasons.join('; ')}</span>
    </div>
  );
}

function bytes(value: number) {
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
}

export function PlatformBillingPage() {
  const [settings, setSettings] = useState<PlatformCommercialSettings | null>(null);
  const [homes, setHomes] = useState<PlatformFuneralHome[] | null>(null);
  const [purchases, setPurchases] = useState<Array<MemorialCreditPurchase & { funeralHome: { id: string; name: string } }> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [settingsData, homesData, purchasesData] = await Promise.all([
        api.getPlatformCommercialSettings(),
        api.getPlatformFuneralHomes(),
        api.getPlatformCreditPurchases(),
      ]);
      setSettings(settingsData);
      setHomes(homesData);
      setPurchases(purchasesData);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  useEffect(() => { void load(); }, []);

  const update = (patch: Partial<PlatformCommercialSettings>) => {
    setSettings((current) => current ? { ...current, ...patch } : current);
  };

  const updateBundle = (index: number, patch: Partial<{ credits: number; priceCents: number }>) => {
    setSettings((current) => current ? {
      ...current,
      creditBundles: current.creditBundles.map((bundle, i) => i === index ? { ...bundle, ...patch } : bundle),
    } : current);
  };

  const addBundle = () => setSettings((current) => current
    ? { ...current, creditBundles: [...current.creditBundles, { credits: 10, priceCents: 10 * current.singleMemorialPriceCents }] }
    : current);
  const removeBundle = (index: number) => setSettings((current) => current
    ? { ...current, creditBundles: current.creditBundles.filter((_, i) => i !== index) }
    : current);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.updatePlatformCommercialSettings(settings);
      setSettings(updated);
      setMessage('Commercial settings saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const verify = async (purchase: MemorialCreditPurchase) => {
    if (!confirm(`Manually verify credit purchase ${purchase.paystackReference}? This will credit the funeral home wallet and is audited.`)) return;
    try {
      await api.verifyPlatformCreditPurchase(purchase.id);
      setMessage('Credit purchase verified and wallet credited.');
      void load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const trialDaysLeft = (home: PlatformFuneralHome) => home.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(home.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  if (error) return <ErrorMessage message={error} />;
  if (!settings || !homes || !purchases) return <Loading />;

  const input = 'rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm focus:border-sage focus:outline-none';

  return (
    <>
      <PageHeader title="Billing & Commercial Settings" description="Trial rules, per-memorial pricing, and prepaid credit bundles." action={<button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-sage px-4 py-2 text-sm font-semibold text-white hover:bg-sage-dark disabled:opacity-50"><Save size={16} />{saving ? 'Saving…' : 'Save settings'}</button>} />
      <div className="space-y-7 p-5 lg:p-8">
        {message && <div className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
        <section className="border border-ink/10 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">Trial & pricing</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.trialEnabled} onChange={(e) => update({ trialEnabled: e.target.checked })} /> New homes get a free trial</label>
            <label className="text-sm"><span className="mb-1 block text-muted">Trial days</span><input type="number" min={1} value={settings.trialDays} onChange={(e) => update({ trialDays: Number.parseInt(e.target.value, 10) || 1 })} className={input} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Free memorials per trial</span><input type="number" min={1} value={settings.freeMemorialLimit} onChange={(e) => update({ freeMemorialLimit: Number.parseInt(e.target.value, 10) || 1 })} className={input} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Single memorial price (cents)</span><input type="number" min={1} value={settings.singleMemorialPriceCents} onChange={(e) => update({ singleMemorialPriceCents: Number.parseInt(e.target.value, 10) || 1 })} className={input} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Currency</span><input value={settings.currency} onChange={(e) => update({ currency: e.target.value.toUpperCase() })} className={input} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.subscriptionsEnabled} onChange={(e) => update({ subscriptionsEnabled: e.target.checked })} /> Subscriptions enabled (Phase 2)</label>
          </div>
          <h2 className="mb-3 mt-6 text-lg font-semibold">Credit bundles</h2>
          <div className="space-y-2">
            {settings.creditBundles.map((bundle, index) => (
              <div key={index} className="flex flex-wrap items-end gap-3">
                <label className="text-sm"><span className="mb-1 block text-muted">Credits</span><input type="number" min={1} value={bundle.credits} onChange={(e) => updateBundle(index, { credits: Number.parseInt(e.target.value, 10) || 1 })} className={input} /></label>
                <label className="text-sm"><span className="mb-1 block text-muted">Price (cents)</span><input type="number" min={1} value={bundle.priceCents} onChange={(e) => updateBundle(index, { priceCents: Number.parseInt(e.target.value, 10) || 1 })} className={input} /></label>
                <p className="pb-2 text-sm text-muted">{money(bundle.priceCents, settings.currency)}</p>
                <button type="button" onClick={() => removeBundle(index)} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"><Trash2 size={12} />Remove</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addBundle} className="mt-3 inline-flex items-center gap-2 border border-ink/15 bg-white px-3 py-2 text-sm font-semibold hover:border-sage"><Plus size={15} />Add bundle</button>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Funeral home entitlements</h2>
          <Table><Head><Th>Funeral home</Th><Th>Trial</Th><Th>Days left</Th><Th>Free used</Th><Th>Credits left</Th><Th>Status</Th></Head><tbody>{homes.map((home) => <tr key={home.id}><Td><strong>{home.name}</strong></Td><Td>{home.trialStartsAt ? (home.trialEndsAt && new Date(home.trialEndsAt) > new Date() ? 'Active' : 'Expired') : '—'}</Td><Td>{home.trialEndsAt ? trialDaysLeft(home) : '—'}</Td><Td>{home.trialMemorialsUsed ?? 0}</Td><Td>{home.memorialCreditsRemaining ?? 0}</Td><Td><Status value={home.status} /></Td></tr>)}</tbody></Table>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Credit purchases</h2>
          <Table><Head><Th>Date</Th><Th>Funeral home</Th><Th>Credits</Th><Th>Amount</Th><Th>Status</Th><Th>Action</Th></Head><tbody>{purchases.map((purchase) => <tr key={purchase.id}><Td>{date(purchase.createdAt)}</Td><Td>{purchase.funeralHome.name}</Td><Td>{purchase.credits}</Td><Td>{money(purchase.amountCents)}</Td><Td><Status value={purchase.status} /></Td><Td>{purchase.status !== 'SUCCESS' && <button type="button" onClick={() => verify(purchase)} className="font-semibold text-sage hover:underline">Mark verified</button>}</Td></tr>)}</tbody></Table>
        </section>
      </div>
    </>
  );
}

function Detail({ label: detailLabel, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-semibold uppercase text-muted">{detailLabel}</p><div className="mt-1 text-sm font-medium">{children}</div></div>;
}
