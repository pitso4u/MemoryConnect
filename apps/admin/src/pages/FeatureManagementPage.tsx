import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Building2, Check, Copy, Eye, Flag, GitBranch, History, Link2, RefreshCw,
  Search, ShoppingCart, SlidersHorizontal, ToggleLeft, Users,
} from 'lucide-react';
import {
  featureApi, FeatureWithOverrides, ResolvedFeature, FeatureAuditLogEntry,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  RELEASE_CHANNELS, ROLLOUT_PERCENTS,
} from '@memorialconnect/shared';

const date = (value?: string | null) => value
  ? new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Never';
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

interface HomeRow {
  id: string;
  name: string;
  plan: string;
  edition: string;
  status: string;
  featureOverrides: Array<{ id: string; featureKey: string; enabled: boolean; releaseChannelOverride: string | null; enabledAt: string }>;
}

interface ResolveRow {
  funeralHomeId: string;
  name: string;
  features: ResolvedFeature[];
}

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

function Stat({ label: statLabel, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{statLabel}</p>
        <Icon size={18} className="text-sage" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function Loading() {
  return <div className="grid min-h-64 place-items-center text-sm text-muted"><RefreshCw className="mb-2 animate-spin" />Loading feature data...</div>;
}

function ErrorMessage({ message }: { message: string }) {
  return <div role="alert" className="m-8 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>;
}

function ChannelBadge({ channel }: { channel: string }) {
  const color: Record<string, string> = {
    GENERAL_AVAILABILITY: 'bg-emerald-50 text-emerald-700',
    BETA: 'bg-sky-50 text-sky-700',
    EARLY_ACCESS: 'bg-violet-50 text-violet-700',
    QA: 'bg-amber-50 text-amber-700',
    INTERNAL: 'bg-slate-100 text-slate-600',
    DEPRECATED: 'bg-orange-50 text-orange-700',
    ARCHIVED: 'bg-fuchsia-50 text-fuchsia-700',
    DISABLED: 'bg-red-50 text-red-700',
  };
  return <span className={`inline-flex px-2 py-1 text-xs font-semibold ${color[channel] ?? 'bg-slate-100 text-slate-600'}`}>{label(channel)}</span>;
}

function VisibilityBadge({ visibility }: { visibility: ResolvedFeature['visibility'] }) {
  const color: Record<ResolvedFeature['visibility'], string> = {
    ENABLED: 'bg-emerald-50 text-emerald-700',
    COMING_SOON: 'bg-amber-50 text-amber-700',
    HIDDEN: 'bg-slate-100 text-slate-500',
  };
  return <span className={`inline-flex px-2 py-1 text-xs font-semibold ${color[visibility]}`}>{label(visibility)}</span>;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  MEMORIALS: Activity, VEHICLES: GitBranch, ASSETS: Building2, CASE_MANAGEMENT: Flag,
  MARKETING: ShoppingCart, CRM: Users, INSURANCE: SlidersHorizontal, MEMBERSHIP: ToggleLeft,
  REPORTS: Activity, STAFF: Users, PAYMENTS: ToggleLeft, API: SlidersHorizontal,
  WHITE_LABEL: Eye, GENERAL: Flag,
};

const tabs = [
  { key: 'dashboard', label: 'Feature Dashboard', icon: Flag },
  { key: 'marketplace', label: 'Feature Marketplace', icon: ShoppingCart },
  { key: 'rollout', label: 'Rollout Control', icon: SlidersHorizontal },
  { key: 'dependencies', label: 'Dependencies', icon: Link2 },
  { key: 'tester', label: 'Feature Tester', icon: Eye },
  { key: 'overrides', label: 'Funeral Home Overrides', icon: Building2 },
  { key: 'audit', label: 'Audit Log', icon: History },
] as const;

type TabKey = typeof tabs[number]['key'];

export default function FeatureManagementPage() {
  const { user, refreshFeatures } = useAuth();
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [features, setFeatures] = useState<FeatureWithOverrides[]>([]);
  const [homes, setHomes] = useState<HomeRow[]>([]);
  const [resolvedRows, setResolvedRows] = useState<ResolveRow[]>([]);
  const [auditLog, setAuditLog] = useState<FeatureAuditLogEntry[]>([]);
  const [auditCount, setAuditCount] = useState(0);
  const [featureVersion, setFeatureVersion] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [featureData, homeData] = await Promise.all([featureApi.getFeatures(), featureApi.getFuneralHomes()]);
      setFeatures(featureData.features);
      setAuditCount(featureData.auditCount);
      if (featureData.featureVersion != null) setFeatureVersion(featureData.featureVersion);
      setHomes(homeData);
      return featureData.featureVersion ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature data');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadResolved = useCallback(async () => {
    setError('');
    try {
      setResolvedRows(await featureApi.resolveAll());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve features');
    }
  }, []);

  useEffect(() => {
    if (tab === 'tester') void loadResolved();
  }, [tab, loadResolved]);

  const loadAudit = useCallback(async () => {
    setError('');
    try {
      setAuditLog(await featureApi.getAuditLog(200));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    }
  }, []);

  useEffect(() => {
    if (tab === 'audit') void loadAudit();
  }, [tab, loadAudit]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const updateFeature = async (key: string, data: Record<string, unknown>) => {
    setSaving(key);
    setError('');
    try {
      await featureApi.update(key, data);
      const version = await load();
      await refreshFeatures();
      flash(`Updated ${key}${version != null ? ` · feature version ${version}` : ''} — cache cleared, sessions pick it up on next poll/navigation`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving('');
    }
  };

  const seedAll = async () => {
    setSaving('__seed__');
    setError('');
    try {
      const result = await featureApi.seed();
      await load();
      await refreshFeatures();
      flash(`Seeded registry (${result.created} new of ${result.total})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seeding failed');
    } finally {
      setSaving('');
    }
  };

  const stats = useMemo(() => {
    const ga = features.filter((f) => f.releaseChannel === 'GENERAL_AVAILABILITY').length;
    const enabled = features.filter((f) => f.enabledGlobally).length;
    const overrides = features.reduce((sum, f) => sum + f.funeralHomeOverrides.length, 0);
    return { total: features.length, ga, enabled, overrides };
  }, [features]);

  if (loading && features.length === 0) return <Loading />;
  if (error && features.length === 0 && !homes.length) return <ErrorMessage message={error} />;

  return (
    <>
      <PageHeader
        title="Feature Management"
        description="Release channels, rollout control, subscription gating, and per-home overrides."
        action={
          <button
            type="button"
            onClick={() => void seedAll()}
            disabled={saving === '__seed__'}
            className="inline-flex items-center gap-2 border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-parchment disabled:opacity-50"
          >
            <GitBranch size={16} /> {saving === '__seed__' ? 'Seeding...' : 'Seed registry'}
          </button>
        }
      />

      {notice && <div role="status" className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800 lg:px-8">{notice}</div>}
      {error && <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 lg:px-8">{error}</div>}

      <div className="flex gap-1 overflow-x-auto border-b border-ink/10 bg-white px-5 pt-4 lg:px-8">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                active ? 'border-sage text-sage' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-8 p-5 lg:p-8">
        {tab === 'dashboard' && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Total features" value={stats.total} icon={Flag} />
              <Stat label="General availability" value={stats.ga} icon={Activity} />
              <Stat label="Globally enabled" value={stats.enabled} icon={ToggleLeft} />
              <Stat label="Funeral home overrides" value={stats.overrides} icon={Users} />
            </section>

            <section className="border border-ink/10 bg-white p-4 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Propagation status</p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="inline-flex items-center gap-1.5 text-emerald-700"><Check size={15} /> Backend updated</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-700"><Check size={15} /> Cache cleared</span>
                <span className="inline-flex items-center gap-1.5 text-muted">Feature version <span className="font-mono font-semibold text-ink">{featureVersion ?? '—'}</span></span>
                <span className="inline-flex items-center gap-1.5 text-muted">Sessions refresh on poll, navigation, focus, or online reconnect</span>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Feature registry</h2>
              <div className="overflow-x-auto border border-ink/10 bg-white">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-ink/10 bg-parchment/60 text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Feature</th>
                      <th className="px-4 py-3 font-semibold">Channel</th>
                      <th className="px-4 py-3 font-semibold">Global</th>
                      <th className="px-4 py-3 font-semibold">Edition / Plan</th>
                      <th className="px-4 py-3 font-semibold">Premium</th>
                      <th className="px-4 py-3 font-semibold">Requires</th>
                      <th className="px-4 py-3 font-semibold">Overrides</th>
                      <th className="px-4 py-3 font-semibold">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((f) => (
                      <tr key={f.key} className="hover:bg-parchment/40">
                        <td className="border-t border-ink/8 px-4 py-3">
                          <p className="font-semibold text-ink">{f.name}</p>
                          <p className="text-xs text-muted">{f.key}</p>
                          {f.description && <p className="mt-1 max-w-md text-xs text-muted">{f.description}</p>}
                        </td>
                        <td className="border-t border-ink/8 px-4 py-3"><ChannelBadge channel={f.releaseChannel} /></td>
                        <td className="border-t border-ink/8 px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold ${f.enabledGlobally ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {f.enabledGlobally ? 'ON' : 'OFF'}
                          </span>
                        </td>
                        <td className="border-t border-ink/8 px-4 py-3 text-xs">
                          <p>{f.minimumEdition ? label(f.minimumEdition) : '—'}</p>
                          <p className="text-muted">{f.minimumPlan ? label(f.minimumPlan) : 'All plans'}</p>
                        </td>
                        <td className="border-t border-ink/8 px-4 py-3">{f.premium ? 'Yes' : 'No'}</td>
                        <td className="border-t border-ink/8 px-4 py-3">
                          {f.dependencies.length ? (
                            <div className="flex flex-wrap gap-1">
                              {f.dependencies.map((dep) => <span key={dep} className="inline-flex px-1.5 py-0.5 text-xs font-semibold bg-parchment text-muted">{dep}</span>)}
                            </div>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td className="border-t border-ink/8 px-4 py-3">
                          {f.funeralHomeOverrides.length ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-sage">
                              <Users size={14} /> {f.funeralHomeOverrides.length}
                            </span>
                          ) : <span className="text-muted">None</span>}
                        </td>
                        <td className="border-t border-ink/8 px-4 py-3 text-xs text-muted">{date(f.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

         {tab === 'marketplace' && (
           <MarketplaceTab
             features={features}
             saving={saving}
             onUpdate={updateFeature}
           />
         )}

         {tab === 'rollout' && (
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase text-muted">Rollout control</h2>
            <p className="mb-4 text-sm text-muted">Set the percentage of funeral homes that receive a feature. Percentages are sampled deterministically per home.</p>
            <div className="overflow-x-auto border border-ink/10 bg-white">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-ink/10 bg-parchment/60 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Feature</th>
                    <th className="px-4 py-3 font-semibold">Channel</th>
                    <th className="px-4 py-3 font-semibold">Rollout %</th>
                    <th className="px-4 py-3 font-semibold">Apply</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((f) => (
                    <tr key={f.key} className="hover:bg-parchment/40">
                      <td className="border-t border-ink/8 px-4 py-3">
                        <p className="font-semibold text-ink">{f.name}</p>
                        <p className="text-xs text-muted">{f.key}</p>
                      </td>
                      <td className="border-t border-ink/8 px-4 py-3">
                        <select
                          value={f.releaseChannel}
                          onChange={(e) => void updateFeature(f.key, { releaseChannel: e.target.value })}
                          disabled={saving === f.key}
                          className="border border-ink/15 bg-white px-2 py-1.5 text-sm"
                        >
                          {RELEASE_CHANNELS.map((channel) => <option key={channel} value={channel}>{label(channel)}</option>)}
                        </select>
                      </td>
                      <td className="border-t border-ink/8 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-32 bg-ink/10">
                            <div className="h-1.5 bg-sage" style={{ width: `${f.rolloutPercent}%` }} />
                          </div>
                          <span className="text-sm font-semibold">{f.rolloutPercent}%</span>
                        </div>
                      </td>
                      <td className="border-t border-ink/8 px-4 py-3">
                        <div className="flex items-center gap-1">
                          {ROLLOUT_PERCENTS.map((percent) => (
                            <button
                              key={percent}
                              type="button"
                              onClick={() => void updateFeature(f.key, { rolloutPercent: percent })}
                              disabled={saving === f.key || f.rolloutPercent === percent}
                              className={`min-w-9 px-2 py-1 text-xs font-semibold transition ${
                                f.rolloutPercent === percent
                                  ? 'bg-sage text-white'
                                  : 'border border-ink/15 bg-white text-ink hover:bg-parchment'
                              }`}
                            >
                              {percent}%
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'tester' && (
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase text-muted">Feature tester</h2>
            <p className="mb-4 text-sm text-muted">Preview the resolved feature set as a logged-in user of any funeral home. You are evaluating as <span className="font-semibold">{user?.role}</span>.</p>
            <button
              type="button"
              onClick={() => void loadResolved()}
              className="mb-4 inline-flex items-center gap-2 border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-parchment"
            >
              <RefreshCw size={16} /> Re-resolve
            </button>
            <div className="space-y-6">
              {resolvedRows.map((row) => (
                <div key={row.funeralHomeId} className="border border-ink/10 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 bg-parchment/60 px-4 py-3">
                    <p className="font-semibold text-ink">{row.name}</p>
                    <p className="text-xs text-muted">
                      {row.features.filter((f) => f.enabled).length} of {row.features.length} features enabled
                    </p>
                  </div>
                  <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    {row.features.map((f) => (
                      <div key={f.key} className="flex items-start justify-between gap-2 border border-ink/8 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-ink">{f.name}</p>
                          <p className="text-xs text-muted">{f.reason}</p>
                        </div>
                        <VisibilityBadge visibility={f.visibility} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!resolvedRows.length && <p className="text-sm text-muted">No funeral homes to preview.</p>}
            </div>
          </section>
        )}

        {tab === 'overrides' && <OverridesTab homes={homes} features={features} onChanged={() => void load()} refreshFeatures={refreshFeatures} flash={flash} />}

        {tab === 'dependencies' && (
          <DependenciesTab
            features={features}
            onChanged={() => void load()}
            refreshFeatures={refreshFeatures}
            flash={flash}
          />
        )}

        {tab === 'audit' && (
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase text-muted">Feature audit log</h2>
            <p className="mb-4 text-sm text-muted">{auditCount} events recorded. Every change is attributed to an actor.</p>
            <div className="overflow-x-auto border border-ink/10 bg-white">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-ink/10 bg-parchment/60 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Actor</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Feature</th>
                    <th className="px-4 py-3 font-semibold">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => (
                    <tr key={entry.id} className="hover:bg-parchment/40">
                      <td className="border-t border-ink/8 px-4 py-3 text-xs text-muted">{date(entry.createdAt)}</td>
                      <td className="border-t border-ink/8 px-4 py-3 text-sm">{entry.actorName || entry.actorUserId || 'System'}</td>
                      <td className="border-t border-ink/8 px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold ${
                          ['DELETE', 'DISABLE'].includes(entry.action)
                            ? 'bg-red-50 text-red-700'
                            : ['CREATE', 'ENABLE'].includes(entry.action)
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}>{entry.action}</span>
                      </td>
                      <td className="border-t border-ink/8 px-4 py-3 font-mono text-xs">{entry.featureKey}</td>
                      <td className="border-t border-ink/8 px-4 py-3 text-xs text-muted">{label(entry.targetType)}{entry.targetId ? ` · ${entry.targetId.slice(0, 8)}` : ''}</td>
                    </tr>
                  ))}
                  {!auditLog.length && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">No feature events recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function MarketplaceTab({
  features,
  saving,
  onUpdate,
}: {
  features: FeatureWithOverrides[];
  saving: string;
  onUpdate: (key: string, data: Record<string, unknown>) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('ALL');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return features.filter((f) => {
      const matchesSearch = !term || f.name.toLowerCase().includes(term) || f.key.toLowerCase().includes(term) || (f.description ?? '').toLowerCase().includes(term);
      const matchesCategory = category === 'ALL' || f.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [features, search, category]);

  const categories = useMemo(
    () => ['ALL', ...new Set(features.map((f) => f.category))],
    [features],
  );

  const install = (f: FeatureWithOverrides) => {
    if (f.enabledGlobally) return;
    void onUpdate(f.key, { enabledGlobally: true });
  };

  const uninstall = (f: FeatureWithOverrides) => {
    if (!f.enabledGlobally) return;
    void onUpdate(f.key, { enabledGlobally: false });
  };

  const setLifecycle = (f: FeatureWithOverrides, next: string) => {
    if (next === f.releaseChannel) return;
    void onUpdate(f.key, { releaseChannel: next });
  };

  const setRollout = (f: FeatureWithOverrides, percent: number) => {
    if (percent === f.rolloutPercent) return;
    void onUpdate(f.key, { rolloutPercent: percent });
  };

  const lifecycleOptions = [
    { value: 'INTERNAL', label: 'Internal' },
    { value: 'QA', label: 'QA' },
    { value: 'BETA', label: 'Beta' },
    { value: 'EARLY_ACCESS', label: 'Early access' },
    { value: 'GENERAL_AVAILABILITY', label: 'General availability' },
    { value: 'DEPRECATED', label: 'Deprecated' },
    { value: 'ARCHIVED', label: 'Archived' },
    { value: 'DISABLED', label: 'Disabled' },
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="mb-1 text-sm font-semibold uppercase text-muted">Feature Marketplace</h2>
          <p className="text-sm text-muted">Publish, promote, or retire platform features from this app-store catalog. Manage staged rollouts per feature.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-semibold uppercase text-muted">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-52 border border-ink/15 bg-white px-2 py-1.5 text-sm"
            >
              {categories.map((c) => <option key={c} value={c}>{c === 'ALL' ? 'All categories' : label(c)}</option>)}
            </select>
          </div>
          <div className="relative w-64">
            <Search size={16} className="absolute left-2 top-5 text-muted" />
            <label className="text-xs font-semibold uppercase text-muted">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search features..."
              className="mt-1 block w-full border border-ink/15 bg-white pl-8 pr-2 py-1.5 text-sm"
            />
          </div>
        </div>
      </header>

      <p className="text-xs text-muted">{filtered.length} feature{filtered.length === 1 ? '' : 's'} found</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((f) => {
          const Icon = CATEGORY_ICONS[f.category] ?? Flag;
          return (
            <div key={f.key} className="border border-ink/10 bg-white">
              <div className="flex items-start justify-between gap-3 border-b border-ink/10 bg-parchment/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center border border-ink/10 bg-white"><Icon size={20} className="text-sage" /></span>
                  <div>
                    <p className="font-display text-lg font-semibold text-ink">{f.name}</p>
                    <p className="text-xs text-muted">{f.key} · {label(f.category)}</p>
                  </div>
                </div>
                <ChannelBadge channel={f.releaseChannel} />
              </div>

              <div className="p-4">
                {f.description && <p className="mb-4 text-sm text-muted">{f.description}</p>}

                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {f.premium && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-amber-50 text-amber-700">
                      <SlidersHorizontal size={12} /> Premium
                    </span>
                  )}
                  {f.minimumEdition && <span className="inline-flex px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-600">Requires {label(f.minimumEdition)}</span>}
                  {f.minimumPlan && <span className="inline-flex px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-600">Plan: {label(f.minimumPlan)}</span>}
                  {f.dependencies.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-600">
                      <Link2 size={12} /> {f.dependencies.length} req
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <label className="text-xs font-semibold uppercase text-muted">Lifecycle</label>
                  <select
                    value={f.releaseChannel}
                    onChange={(e) => setLifecycle(f, e.target.value)}
                    disabled={saving === f.key}
                    className="mt-1 block w-full border border-ink/15 bg-white px-2 py-1.5 text-sm"
                  >
                    {lifecycleOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="flex justify-between text-xs font-semibold uppercase text-muted">
                    <span>Staged rollout</span>
                    <span className="text-ink">{f.rolloutPercent}% of homes</span>
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {ROLLOUT_PERCENTS.map((percent) => (
                      <button
                        key={percent}
                        type="button"
                        onClick={() => setRollout(f, percent)}
                        disabled={saving === f.key || f.rolloutPercent === percent}
                        className={`px-2.5 py-1 text-xs font-semibold transition ${
                          f.rolloutPercent === percent
                            ? 'bg-sage text-white'
                            : 'border border-ink/15 bg-white text-ink hover:bg-parchment'
                        }`}
                      >
                        {percent}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-ink/10 pt-3">
                  {f.enabledGlobally ? (
                    <button
                      type="button"
                      onClick={() => uninstall(f)}
                      disabled={saving === f.key}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {saving === f.key ? <RefreshCw size={12} className="animate-spin" /> : <ToggleLeft size={14} />} Installed
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => install(f)}
                      disabled={saving === f.key}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-ink/15 bg-white text-ink transition hover:bg-parchment disabled:opacity-50"
                    >
                      {saving === f.key ? <RefreshCw size={12} className="animate-spin" /> : <ShoppingCart size={14} />} Install
                    </button>
                  )}
                  <span className="text-[11px] font-semibold text-muted">{f.funeralHomeOverrides.length} home override{f.funeralHomeOverrides.length === 1 ? '' : 's'}</span>
                </div>
              </div>
            </div>
          );
        })}
        {!filtered.length && (
          <p className="text-sm text-muted">No features match your filters.</p>
        )}
      </div>
    </section>
  );
}

function OverridesTab({
  homes, features, onChanged, refreshFeatures, flash,
}: {
  homes: HomeRow[];
  features: FeatureWithOverrides[];
  onChanged: () => void;
  refreshFeatures: () => Promise<void>;
  flash: (message: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<HomeRow | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return homes;
    return homes.filter((h) => h.name.toLowerCase().includes(term) || h.id.toLowerCase().includes(term));
  }, [homes, search]);

  const toggle = async (key: string) => {
    if (!selected) return;
    const existing = selected.featureOverrides.find((o) => o.featureKey === key);
    setBusy(key);
    setError('');
    try {
      if (existing) {
        await featureApi.removeFuneralHomeOverride(selected.id, key);
      } else {
        await featureApi.setFuneralHomeOverride(selected.id, key, { enabled: true, releaseChannelOverride: 'BETA' });
      }
      const refreshed = await featureApi.getFuneralHomes();
      const updated = refreshed.find((h) => h.id === selected.id) ?? null;
      if (updated) setSelected(updated);
      onChanged();
      await refreshFeatures();
      flash(existing ? `Removed ${key} override` : `Enabled ${key} for ${selected.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase text-muted">Select funeral home</h2>
        <div className="mb-3 flex items-center gap-2 border border-ink/15 bg-white px-3 py-2">
          <Search size={16} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search homes..."
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="max-h-[560px] space-y-1 overflow-y-auto border border-ink/10 bg-white p-2">
          {filtered.map((home) => (
            <button
              key={home.id}
              type="button"
              onClick={() => setSelected(home)}
              className={`flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm transition ${
                selected?.id === home.id ? 'bg-sage text-white' : 'hover:bg-parchment'
              }`}
            >
              <span className="truncate">{home.name}</span>
              <span className={`shrink-0 text-[11px] font-semibold ${selected?.id === home.id ? 'text-white/80' : 'text-muted'}`}>
                {home.featureOverrides.length} override{home.featureOverrides.length === 1 ? '' : 's'}
              </span>
            </button>
          ))}
          {!filtered.length && <p className="px-3 py-4 text-sm text-muted">No funeral homes found.</p>}
        </div>
      </div>

      <div className="border border-ink/10 bg-white">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 bg-parchment/60 px-4 py-3">
              <div>
                <p className="font-display text-lg font-semibold text-ink">{selected.name}</p>
                <p className="text-xs text-muted">{label(selected.edition)} · {label(selected.plan)} plan</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-sage"><Copy size={14} /> {selected.id}</span>
            </div>
            {error && <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
            <div className="divide-y divide-ink/8">
              {features.map((f) => {
                const existing = selected.featureOverrides.find((o) => o.featureKey === f.key);
                const overridden = Boolean(existing);
                return (
                  <div key={f.key} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-parchment/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{f.name}</p>
                      <p className="text-xs text-muted">{f.key}{existing?.releaseChannelOverride ? ` · ${label(existing.releaseChannelOverride)}` : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggle(f.key)}
                      disabled={busy === f.key}
                      className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        overridden
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border border-ink/15 bg-white text-muted hover:bg-parchment'
                      }`}
                    >
                      {busy === f.key ? <RefreshCw size={12} className="animate-spin" /> : <ToggleLeft size={14} />}
                      {overridden ? 'Override active' : 'Enable for home'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid min-h-64 place-items-center text-sm text-muted">Select a funeral home to manage overrides.</div>
        )}
      </div>
    </section>
  );
}

function DependenciesTab({
  features, onChanged, refreshFeatures, flash,
}: {
  features: FeatureWithOverrides[];
  onChanged: () => void;
  refreshFeatures: () => Promise<void>;
  flash: (message: string) => void;
}) {
  const [selected, setSelected] = useState<FeatureWithOverrides | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const selectedDeps = selected?.dependencies ?? [];
  const candidates = useMemo(
    () => features.filter((f) => f.key !== selected?.key && !selectedDeps.includes(f.key)),
    [features, selected?.key, selectedDeps],
  );

  const add = async (dependsOnFeature: string) => {
    if (!selected) return;
    setBusy(dependsOnFeature);
    setError('');
    try {
      await featureApi.addDependency(selected.key, dependsOnFeature);
      const refreshed = await featureApi.getFeatures();
      const updated = refreshed.features.find((f) => f.key === selected.key) ?? null;
      if (updated) setSelected(updated);
      onChanged();
      await refreshFeatures();
      flash(`${selected.key} now requires ${dependsOnFeature}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dependency');
    } finally {
      setBusy('');
    }
  };

  const remove = async (dependsOnFeature: string) => {
    if (!selected) return;
    setBusy(dependsOnFeature);
    setError('');
    try {
      await featureApi.removeDependency(selected.key, dependsOnFeature);
      const refreshed = await featureApi.getFeatures();
      const updated = refreshed.features.find((f) => f.key === selected.key) ?? null;
      if (updated) setSelected(updated);
      onChanged();
      await refreshFeatures();
      flash(`Removed ${selected.key} → ${dependsOnFeature}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove dependency');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase text-muted">Select feature</h2>
        <p className="mb-3 text-sm text-muted">Choose which feature&apos;s requirements to edit.</p>
        <div className="max-h-[560px] space-y-1 overflow-y-auto border border-ink/10 bg-white p-2">
          {features.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setSelected(f)}
              className={`flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm transition ${
                selected?.key === f.key ? 'bg-sage text-white' : 'hover:bg-parchment'
              }`}
            >
              <span className="truncate">{f.name}</span>
              <span className={`shrink-0 text-[11px] font-semibold ${selected?.key === f.key ? 'text-white/80' : 'text-muted'}`}>
                {f.dependencies.length} req
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border border-ink/10 bg-white">
        {selected ? (
          <>
            <div className="border-b border-ink/10 bg-parchment/60 px-4 py-3">
              <p className="font-display text-lg font-semibold text-ink">{selected.name}</p>
              <p className="text-xs text-muted">{selected.key} · activates only when all requirements are enabled</p>
            </div>
            {error && <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

            <div className="p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Required features</h3>
              {selectedDeps.length ? (
                <div className="space-y-1.5">
                  {selectedDeps.map((dep) => {
                    const depFeature = features.find((f) => f.key === dep);
                    return (
                      <div key={dep} className="flex items-center justify-between gap-3 border border-ink/8 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">{depFeature?.name ?? dep}</p>
                          <p className="text-xs text-muted">{dep}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void remove(dep)}
                          disabled={busy === dep}
                          className="inline-flex shrink-0 items-center gap-1 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {busy === dep ? <RefreshCw size={12} className="animate-spin" /> : null} Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted">No requirements. This feature can be enabled independently.</p>
              )}
            </div>

            <div className="border-t border-ink/10 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Add requirement</h3>
              {candidates.length ? (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {candidates.map((candidate) => (
                    <button
                      key={candidate.key}
                      type="button"
                      onClick={() => void add(candidate.key)}
                      disabled={busy === candidate.key}
                      className="flex items-center justify-between gap-2 border border-ink/15 bg-white px-3 py-2 text-left text-sm transition hover:bg-parchment disabled:opacity-50"
                    >
                      <span className="truncate">{candidate.name}</span>
                      <span className="shrink-0 text-[11px] font-semibold text-muted">{candidate.key}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Every other feature is already a requirement.</p>
              )}
            </div>
          </>
        ) : (
          <div className="grid min-h-64 place-items-center text-sm text-muted">Select a feature to manage its dependencies.</div>
        )}
      </div>
    </section>
  );
}
