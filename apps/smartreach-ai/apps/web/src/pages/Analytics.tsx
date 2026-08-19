import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, CardHeader, Badge, Skeleton, Empty } from "../components/ui";
import { PlatformMark, platformColor, platformLabel } from "../lib/platforms";

interface Overview {
  daily: { date: string; reach: number; visits: number; clicks: number; shares: number; conversions: number }[];
  totals: { reach: number; visits: number; clicks: number; shares: number; conversions: number; followers: number };
  engagementRate: number;
}

interface PlatformPerf {
  platform: string;
  posts: number;
  reach: number;
  clicks: number;
  shares: number;
  conversions: number;
}

interface BestTimes {
  learned: boolean;
  best: { day: number; dayLabel: string; hour: number; label: string }[];
}

export function Analytics() {
  const [range, setRange] = useState(30);

  const overview = useQuery({
    queryKey: ["analytics", range],
    queryFn: () => api.get<Overview>(`/analytics/overview?days=${range}`),
  });
  const platforms = useQuery({
    queryKey: ["analytics-platforms"],
    queryFn: () => api.get<{ platforms: PlatformPerf[] }>("/analytics/platforms"),
  });
  const best = useQuery({
    queryKey: ["analytics-best"],
    queryFn: () => api.get<BestTimes>("/analytics/best-times"),
    refetchInterval: 15000,
  });

  const t = overview.data?.totals;
  const max = Math.max(1, ...(overview.data?.daily ?? []).map((d) => d.reach));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1 rounded-xl border border-ink-700 bg-ink-900 p-1">
          {[7, 30, 90].map((n) => (
            <button
              key={n}
              onClick={() => setRange(n)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                range === n ? "bg-amber-500 text-ink-950" : "text-ink-400"
              }`}
            >
              {n}d
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-500">Simulated reach from published posts.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {[
          ["Total reach", t?.reach],
          ["Visits", t?.visits],
          ["Clicks", t?.clicks],
          ["Shares", t?.shares],
          ["Conversions", t?.conversions],
        ].map(([label, value], i) => (
          <Card key={label as string} className="animate-fade-up p-4" delay={i * 50}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</p>
            <p className="display mt-1.5 text-2xl text-ink-50">{(value ?? 0).toLocaleString()}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Daily reach"
            sub={`Last ${range} days across all platforms`}
            right={<Badge tone="amber">{overview.data?.engagementRate?.toFixed(1)}% engagement</Badge>}
          />
          {overview.isLoading ? (
            <div className="p-5"><Skeleton className="h-64" /></div>
          ) : !overview.data || overview.data.daily.length === 0 ? (
            <Empty title="No data yet" sub="Publish a few posts and the Brain starts learning your audience." />
          ) : (
            <div className="p-5">
              <ReachChart points={overview.data.daily} max={max} />
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Platform performance"
            sub="Where your posts land"
            right={best.data?.learned ? <Badge tone="green">learning</Badge> : <Badge>baseline</Badge>}
          />
          {platforms.isLoading ? (
            <div className="space-y-3 p-5"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : (platforms.data?.platforms ?? []).length === 0 ? (
            <Empty title="No platforms yet" sub="Publish something first." />
          ) : (
            <div className="space-y-3 p-5">
              {(platforms.data?.platforms ?? []).slice(0, 6).map((p) => {
                const pMax = Math.max(1, ...(platforms.data?.platforms ?? []).map((x) => x.reach));
                return (
                  <div key={p.platform}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-semibold text-ink-200">
                        <PlatformMark platform={p.platform} size={16} /> {platformLabel(p.platform)}
                      </span>
                      <span className="font-mono text-ink-400">{p.reach.toLocaleString()}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-800">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(p.reach / pMax) * 100}%`, backgroundColor: platformColor(p.platform) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Marketing Brain — best times"
          sub={
            best.data?.learned
              ? "Learned from your engagement. SmartReach will switch slots automatically."
              : "Still learning. Using the default slot plan until enough posts publish."
          }
        />
        {best.isLoading ? (
          <div className="p-5"><Skeleton className="h-16" /></div>
        ) : (
          <div className="flex flex-wrap gap-2 p-5">
            {(best.data?.best ?? []).map((b) => (
              <span key={b.label} className="chip border-amber-400/40 bg-amber-400/10 text-amber-300">
                {b.label}
              </span>
            ))}
            {best.data && !best.data.learned ? (
              <span className="chip border-dashed text-ink-500">Mon 09:00 · Mon 12:00 · Mon 14:00 · Mon 17:00 · Mon 19:00</span>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

function ReachChart({ points, max }: { points: Overview["daily"]; max: number }) {
  const W = 640;
  const H = 220;
  const PAD = 8;

  const path = useMemo(() => {
    if (points.length < 2) return "";
    const stepX = (W - PAD * 2) / (points.length - 1);
    return points
      .map((p, i) => {
        const x = PAD + i * stepX;
        const y = H - PAD - (p.reach / max) * (H - PAD * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points, max]);

  const area = useMemo(
    () =>
      points.length >= 2
        ? `${path} L${W - PAD},${H - PAD} L${PAD},${H - PAD} Z`
        : "",
    [path, points],
  );

  const labels = useMemo(() => {
    const step = Math.ceil(points.length / 8);
    return points
      .map((p, i) => ({ p, i }))
      .filter((_, i) => i % step === 0 || i === points.length - 1);
  }, [points]);

  const last = points[points.length - 1];
  const lastX = PAD + (points.length - 1) * ((W - PAD * 2) / Math.max(1, points.length - 1));
  const lastY = H - PAD - (last.reach / max) * (H - PAD * 2);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8A23D" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#E8A23D" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={H * f}
            y2={H * f}
            stroke="#262E27"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
        ))}
        {area ? <path d={area} fill="url(#reachFill)" /> : null}
        <path d={path} fill="none" stroke="#E8A23D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.length >= 2 && (
          <g>
            <line x1={lastX} x2={lastX} y1={PAD} y2={H - PAD} stroke="#E8A23D" strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
            <circle cx={lastX} cy={lastY} r="5" fill="#E8A23D" />
            <circle cx={lastX} cy={lastY} r="10" fill="none" stroke="#E8A23D" strokeOpacity="0.3" strokeWidth="2" />
          </g>
        )}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] font-semibold text-ink-600">
        {labels.map(({ p, i }) => (
          <span key={i}>{fmtDate(p.date)}</span>
        ))}
      </div>
    </div>
  );
}

function fmtDate(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
