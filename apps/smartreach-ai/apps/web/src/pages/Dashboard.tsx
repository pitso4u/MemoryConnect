import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, CardHeader, Stat, Skeleton, Badge, Button, Empty } from "../components/ui";
import { PlatformMark, platformLabel } from "../lib/platforms";

interface DashboardData {
  connectedCount: number;
  connectedPlatforms: string[];
  lastPost: { platform: string; publishedAt: string } | null;
  todayReach: number;
  todayVisits: number;
  todayLeads: number;
  upcomingCount: number;
  publishedCount: number;
  scheduledCount: number;
}

interface CalendarEntry {
  id: string;
  postId: string;
  platform: string;
  status: string;
  publishAt: string;
  body: string;
  title?: string;
}

export function Dashboard() {
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/dashboard"),
    refetchInterval: 20000,
  });
  const calendar = useQuery({
    queryKey: ["calendar"],
    queryFn: () => api.get<CalendarEntry[]>("/calendar"),
    refetchInterval: 20000,
  });

  const d = dash.data;
  const upcoming = (calendar.data ?? []).filter((c) => c.status === "SCHEDULED").slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dash.isLoading ? (
          <><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></>
        ) : (
          <>
            <Stat
              label="Connected accounts"
              value={d?.connectedCount ?? 0}
              icon={<PlatformMark platform={d?.connectedPlatforms[0] ?? "facebook"} size={22} />}
              delay={0}
            />
            <Stat label="Today's reach" value={(d?.todayReach ?? 0).toLocaleString()} accent delay={60} />
            <Stat label="Visitors" value={(d?.todayVisits ?? 0).toLocaleString()} delay={120} />
            <Stat label="New leads" value={d?.todayLeads ?? 0} delay={180} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="animate-fade-up p-5" delay={120}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Last post</p>
            {d?.lastPost ? <PlatformMark platform={d.lastPost.platform} size={24} /> : null}
          </div>
          {d?.lastPost ? (
            <>
              <p className="display mt-2 text-2xl text-ink-50">{platformLabel(d.lastPost.platform)}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-ink-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {relativeTime(d.lastPost.publishedAt)}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-500">Nothing published yet — generate your first post.</p>
          )}
          <p className="mt-4 text-xs text-ink-500">No manual posting. It just went out.</p>
        </Card>

        <Card className="animate-fade-up p-5" delay={180}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Published · Scheduled</p>
          <div className="mt-3 flex items-end gap-3">
            <p className="display text-4xl text-ink-50">{d?.publishedCount ?? 0}</p>
            <p className="display text-2xl text-ink-400">{d?.scheduledCount ?? 0}</p>
          </div>
          <p className="mt-1 text-xs text-ink-500">posts live · posts waiting in the calendar</p>
        </Card>

        <Card className="animate-fade-up p-5" delay={240}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Up next</p>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">Calendar is clear. Generate content, then schedule it.</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {upcoming.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <PlatformMark platform={u.platform} size={22} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-200">{platformLabel(u.platform)}</p>
                    <p className="text-[11px] text-ink-500">{formatWhen(u.publishAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Today's publishing plan"
          sub="The Brain reorders slots based on when your audience actually responds."
          right={
            <a href="#/generator">
              <Button variant="ghost">Generate today's content</Button>
            </a>
          }
        />
        {calendar.isLoading ? (
          <div className="space-y-2 p-5"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : (calendar.data ?? []).length === 0 ? (
          <Empty title="Nothing scheduled yet" sub="Generate content, then drop posts onto the calendar." />
        ) : (
          <div className="divide-y divide-ink-700/60">
            {(calendar.data ?? []).slice(0, 6).map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3.5">
                <PlatformMark platform={c.platform} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-200">{c.title ?? truncate(c.body, 80)}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                    {formatWhen(c.publishAt)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "PUBLISHED" ? "green" : status === "FAILED" ? "red" : status === "SCHEDULED" ? "amber" : "ink";
  return <Badge tone={tone as any}>{status}</Badge>;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
