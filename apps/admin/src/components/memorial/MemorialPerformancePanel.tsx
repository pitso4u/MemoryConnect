import { BarChart3, Eye, Users, QrCode, Share2, TrendingDown, TrendingUp, Minus, Trophy, Star, Clock } from 'lucide-react';
import type { MemorialPerformance, MemorialPerformanceDay } from '@memorialconnect/shared';

function DayCard({ day }: { day: MemorialPerformanceDay }) {
  const cells = [
    { icon: Eye, label: 'Views', value: day.views },
    { icon: Users, label: 'Unique Visitors', value: day.uniqueVisitors },
    { icon: QrCode, label: 'QR Scans', value: day.qrScans },
    { icon: Share2, label: 'Shares', value: day.shares },
  ];
  return (
    <div className="rounded-xl border border-parchment-dark bg-parchment/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink">{day.label}</p>
        {day.snapshot && (
          <span className="flex items-center gap-1 rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
            <Clock size={10} /> Snapshot
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-lg bg-white p-3">
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <cell.icon size={12} /> {cell.label}
            </p>
            <p className="mt-1 font-display text-2xl text-ink">{cell.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Daily rating: <span className="font-semibold text-ink">{day.rating}</span>
      </p>
    </div>
  );
}

function Timeline({ performance }: { performance: MemorialPerformance }) {
  const max = Math.max(1, ...performance.trend.map((point) => point.views));
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Timeline</p>
      <div className="flex h-40 items-end gap-4 rounded-lg border border-parchment-dark bg-white p-4">
        {performance.trend.map((point) => (
          <div key={point.day} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-28 w-full items-end justify-center">
              <div
                className="w-full max-w-16 rounded-t-md bg-gradient-to-t from-gold-dark to-gold transition-all"
                style={{ height: `${Math.max(4, (point.views / max) * 100)}%` }}
                title={`${point.views} views`}
              />
            </div>
            <p className="text-xs font-semibold text-ink">{point.views}</p>
            <p className="text-[10px] text-muted">Day {point.day}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Trend({ performance }: { performance: MemorialPerformance }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Trend</p>
      {performance.trend.slice(1).map((point) => {
        const change = point.changePercent;
        const up = change !== null && change > 0;
        const down = change !== null && change < 0;
        return (
          <div key={point.day} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
            <span className="text-sm text-muted">Day {point.day}</span>
            <span className="font-display text-lg text-ink">{point.views}</span>
            <span className={`flex items-center gap-1 text-sm font-semibold ${up ? 'text-emerald-600' : down ? 'text-red-600' : 'text-muted'}`}>
              {up ? <TrendingUp size={15} /> : down ? <TrendingDown size={15} /> : <Minus size={15} />}
              {change !== null ? `${Math.abs(change)}%` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function MemorialPerformancePanel({ performance }: { performance: MemorialPerformance }) {
  const highestMilestone = performance.milestones[performance.milestones.length - 1];
  return (
    <section className="mt-8 rounded-2xl border border-parchment-dark bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 size={19} className="text-gold-dark" />
            <h2 className="font-display text-2xl text-ink">72 Hour Performance</h2>
          </div>
          {performance.publishedAt && (
            <p className="mt-1 text-xs text-muted">
              Published {new Date(performance.publishedAt).toLocaleString('en-ZA')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {highestMilestone && (
            <span
              className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
              title={`${highestMilestone.badge} ${highestMilestone.label} reached on Day ${highestMilestone.day}`}
            >
              <Star size={13} /> {highestMilestone.badge} {highestMilestone.label} (Day {highestMilestone.day})
            </span>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              performance.totals.performanceRating === 'Outstanding' ? 'bg-purple-100 text-purple-800'
              : performance.totals.performanceRating === 'Excellent' ? 'bg-emerald-100 text-emerald-800'
              : performance.totals.performanceRating === 'Very Good' ? 'bg-blue-100 text-blue-800'
              : performance.totals.performanceRating === 'Good' ? 'bg-teal-100 text-teal-800'
              : performance.totals.performanceRating === 'Growing' ? 'bg-amber-100 text-amber-800'
              : 'bg-stone-100 text-stone-700'
            }`}
          >
            {performance.totals.performanceRating}
          </span>
          {performance.monitoringActive && !performance.finalized && (
            <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold-dark">
              Monitoring
            </span>
          )}
        </div>
      </div>

      {performance.days.length > 0 ? (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {performance.days.map((day) => <DayCard key={day.day} day={day} />)}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Timeline performance={performance} />
            <Trend performance={performance} />
          </div>

          <div className="mt-6 rounded-xl border border-parchment-dark bg-parchment/40 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Daily Summaries (cumulative)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {performance.snapshots.map((snapshot) => (
                <div key={snapshot.day} className="rounded-lg bg-white p-3">
                  <p className="text-xs text-muted">Day {snapshot.day} Summary</p>
                  <p className="mt-1 font-display text-2xl text-ink">{snapshot.views}</p>
                  <p className="text-xs text-muted">{snapshot.visitors} visitors</p>
                </div>
              ))}
            </div>
          </div>

          {performance.milestones.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {performance.milestones.map((milestone) => (
                <span key={`${milestone.day}-${milestone.badge}`} className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                  <Trophy size={12} /> {milestone.badge} {milestone.label} on Day {milestone.day}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-3 rounded-xl bg-ink p-5 text-parchment sm:grid-cols-4">
            {[
              ['72 Hour Total', `${performance.totals.views} Views`],
              ['Unique Visitors', String(performance.totals.uniqueVisitors)],
              ['QR Scans', String(performance.totals.qrScans)],
              ['Shares', String(performance.totals.shares)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-wide text-parchment/60">{label}</p>
                <p className="mt-1 font-display text-2xl">{value}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted">No 72-hour performance data yet.</p>
      )}
    </section>
  );
}
