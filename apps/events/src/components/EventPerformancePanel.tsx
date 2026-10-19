import type { EventPerformance } from '@memorialconnect/event-shared';

function EyeIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d="M1 12s6-7 11-7 11 7 11 7-6 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UsersIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="3" />
      <path d="M22 19.5v-1.5A2.5 2.5 0 0018 15h-1" />
    </svg>
  );
}

function QrCodeIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      <path d="M4 4h6v6H4zM11 11h6v6h-6zM17 4h3v3h-3zM4 17h3v3H4zM14 4h3v3h-3zM7 7h2v2H7z" />
    </svg>
  );
}

function ShareIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <circle cx="7" cy="12" r="3" />
      <circle cx="17" cy="6" r="3" />
      <circle cx="17" cy="18" r="3" />
      <path d="M9.5 10.5l5-3M9.5 13.5l5 3" />
    </svg>
  );
}

function BarChartIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d="M3 12h2v7H3zM8 5h2v14H8zM13 8h2v11h-2zM18 2h2v18h-2z" />
    </svg>
  );
}

function ClockIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function TrophyIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d="M5 15a7 7 0 017-7v-4l4 2" />
      <path d="M5 15a7 7 0 007 7v-4" />
      <path d="M7 7V3h10v4" />
      <path d="M5.5 15h13a2.5 2.5 0 01-2.5 2.5v1a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1A2.5 2.5 0 005.5 15z" />
    </svg>
  );
}

function TrendingUpIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d="M3 17l6-6 4 4 5-5 5 5v4H3z" />
    </svg>
  );
}

function TrendingDownIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d="M21 17l-6-6-4 4-5-5-5 5v4h10z" />
    </svg>
  );
}

function MinusIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
    </svg>
  );
}

function StarIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27z" />
    </svg>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function DayCard({ day }: { day: { day: number; label: string; views: number; uniqueVisitors: number; qrScans: number; shares: number; snapshot: boolean; rating: string } }) {
  const cells = [
    { icon: EyeIcon, label: 'Views', value: day.views },
    { icon: UsersIcon, label: 'Unique Visitors', value: day.uniqueVisitors },
    { icon: QrCodeIcon, label: 'QR Scans', value: day.qrScans },
    { icon: ShareIcon, label: 'Shares', value: day.shares },
  ];
  return (
    <div className="event-perf-daycard">
      <div className="event-perf-daycard-head">
        <p className="event-perf-daycard-label">{day.label}</p>
        {day.snapshot ? (
          <span className="event-perf-snapshot-badge">
            <ClockIcon className="h-3 w-3" /> Snapshot
          </span>
        ) : null}
      </div>
      <div className="event-perf-daycard-grid">
        {cells.map((cell) => (
          <div key={cell.label} className="event-perf-daycell">
            <p className="event-perf-daycell-label">
              <cell.icon className="h-3 w-3" /> {cell.label}
            </p>
            <p className="event-perf-daycell-value">{cell.value}</p>
          </div>
        ))}
      </div>
      <p className="event-perf-daycard-rating">
        Daily rating: <span>{day.rating}</span>
      </p>
    </div>
  );
}

function Timeline({ performance }: { performance: EventPerformance }) {
  const max = Math.max(1, ...performance.trend.map((point) => point.views));
  return (
    <div>
      <p className="event-perf-section-label">Timeline</p>
      <div className="event-perf-timeline">
        {performance.trend.map((point) => (
          <div key={point.day} className="event-perf-timeline-col">
            <div className="event-perf-timeline-bar-wrap">
              <div
                className="event-perf-timeline-bar"
                style={{ height: `${Math.max(4, (point.views / max) * 100)}%` }}
                title={`${point.views} views`}
              />
            </div>
            <p className="event-perf-timeline-value">{point.views}</p>
            <p className="event-perf-timeline-day">Day {point.day}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Trend({ performance }: { performance: EventPerformance }) {
  return (
    <div>
      <p className="event-perf-section-label">Trend</p>
      {performance.trend.slice(1).map((point) => {
        const change = point.changePercent;
        const up = change !== null && change > 0;
        const down = change !== null && change < 0;
        return (
          <div key={point.day} className="event-perf-trend-row">
            <span className="event-perf-trend-day">Day {point.day}</span>
            <span className="event-perf-trend-value">{point.views}</span>
            <span className={`event-perf-trend-change ${up ? 'up' : down ? 'down' : 'flat'}`}>
              {up ? <TrendingUpIcon className="h-4 w-4" /> : down ? <TrendingDownIcon className="h-4 w-4" /> : <MinusIcon className="h-4 w-4" />}
              {change !== null ? `${Math.abs(change)}%` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function EventPerformancePanel({ performance }: { performance: EventPerformance }) {
  const highestMilestone = performance.milestones[performance.milestones.length - 1];
  return (
    <section className="event-perf-panel">
      <div className="event-perf-panel-head">
        <div className="event-perf-panel-title">
          <BarChartIcon className="h-5 w-5" />
          <h2>72 Hour Performance</h2>
        </div>
        {performance.publishedAt ? <p className="event-perf-published">Published {formatDate(performance.publishedAt)}</p> : null}
      </div>

      <div className="event-perf-badges">
        {highestMilestone ? (
          <span className="event-perf-badge event-perf-badge--star" title={`${highestMilestone.badge} ${highestMilestone.label} reached on Day ${highestMilestone.day}`}>
            <StarIcon className="h-3 w-3" /> {highestMilestone.badge} {highestMilestone.label} (Day {highestMilestone.day})
          </span>
        ) : null}
        <span className={`event-perf-rating event-perf-rating--${performance.totals.performanceRating || 'New'}`}>
          {performance.totals.performanceRating || 'New'}
        </span>
        {performance.monitoringActive && !performance.finalized ? (
          <span className="event-perf-badge event-perf-badge--monitoring">Monitoring</span>
        ) : null}
      </div>

      {performance.days.length > 0 ? (
        <>
          <div className="event-perf-daycards">
            {performance.days.map((day) => <DayCard key={day.day} day={day} />)}
          </div>

          <div className="event-perf-trend-container">
            <Timeline performance={performance} />
            <Trend performance={performance} />
          </div>

          <div className="event-perf-snapshots">
            <p className="event-perf-section-label">Daily Summaries (cumulative)</p>
            <div className="event-perf-snapshot-grid">
              {performance.snapshots.map((snapshot) => (
                <div key={snapshot.day} className="event-perf-snapshot">
                  <p className="event-perf-snapshot-label">Day {snapshot.day} Summary</p>
                  <p className="event-perf-snapshot-views">{snapshot.views}</p>
                  <p className="event-perf-snapshot-visitors">{snapshot.visitors} visitors</p>
                </div>
              ))}
            </div>
          </div>

          {performance.milestones.length > 0 ? (
            <div className="event-perf-milestones">
              {performance.milestones.map((milestone) => (
                <span key={`${milestone.day}-${milestone.badge}`} className="event-perf-badge event-perf-badge--milestone">
                  <TrophyIcon className="h-3 w-3" /> {milestone.badge} {milestone.label} on Day {milestone.day}
                </span>
              ))}
            </div>
          ) : null}

          <div className="event-perf-totals">
            {['72 Hour Total', 'Unique Visitors', 'QR Scans', 'Shares'].map((label, i) => {
              const values = [
                `${performance.totals.views} Views`,
                String(performance.totals.uniqueVisitors),
                String(performance.totals.qrScans),
                String(performance.totals.shares),
              ];
              return (
                <div key={label} className="event-perf-total-item">
                  <p className="event-perf-total-label">{label}</p>
                  <p className="event-perf-total-value">{values[i]}</p>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="event-perf-empty">No 72-hour performance data yet. Performance tracking begins once your event is published.</p>
      )}
    </section>
  );
}
