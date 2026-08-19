import type { AnalyticsPoint, PlatformPerformance } from "@smartreach/common";

export interface StatRow {
  date: Date;
  platform?: string | null;
  reach: number;
  visits: number;
  clicks: number;
  shares: number;
  conversions: number;
  followers: number;
}

export function aggregateDaily(rows: StatRow[], days: number): AnalyticsPoint[] {
  const map = new Map<string, AnalyticsPoint>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { date: key, reach: 0, visits: 0, clicks: 0, shares: 0, conversions: 0, followers: 0 });
  }
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10);
    const point = map.get(key);
    if (!point) continue;
    point.reach += r.reach;
    point.visits += r.visits;
    point.clicks += r.clicks;
    point.shares += r.shares;
    point.conversions += r.conversions;
    point.followers = Math.max(point.followers, r.followers);
  }
  return [...map.values()];
}

export function sumWindow(rows: StatRow[], days: number): {
  reach: number;
  visits: number;
  clicks: number;
  shares: number;
  conversions: number;
  followers: number;
} {
  const cutoff = new Date(Date.now() - days * 86400000);
  let out = { reach: 0, visits: 0, clicks: 0, shares: 0, conversions: 0, followers: 0 };
  for (const r of rows) {
    if (r.date < cutoff) continue;
    out.reach += r.reach;
    out.visits += r.visits;
    out.clicks += r.clicks;
    out.shares += r.shares;
    out.conversions += r.conversions;
    out.followers = Math.max(out.followers, r.followers);
  }
  return out;
}

export function perPlatform(rows: StatRow[]): PlatformPerformance[] {
  const groups = new Map<
    string,
    { posts: number; reach: number; clicks: number; shares: number; conversions: number }
  >();
  for (const r of rows) {
    const p = r.platform ?? "facebook";
    const g = groups.get(p) ?? { posts: 0, reach: 0, clicks: 0, shares: 0, conversions: 0 };
    g.posts += 1;
    g.reach += r.reach;
    g.clicks += r.clicks;
    g.shares += r.shares;
    g.conversions += r.conversions;
    groups.set(p, g);
  }
  return [...groups.entries()]
    .map(([platform, v]) => ({ platform, ...v }))
    .sort((a, b) => b.reach - a.reach);
}

export function engagementRate(rows: StatRow[]): number {
  const total = sumWindow(rows, 30);
  const reach = total.reach;
  if (reach === 0) return 0;
  return ((total.clicks + total.shares + total.conversions) / reach) * 100;
}
