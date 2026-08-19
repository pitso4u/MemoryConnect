import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, CardHeader, Badge, Button, Skeleton, Empty } from "../components/ui";
import { PlatformMark, platformLabel } from "../lib/platforms";

interface CalendarEntry {
  id: string;
  postId: string;
  platform: string;
  status: string;
  publishAt: string;
  body: string;
  title?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarPage() {
  const qc = useQueryClient();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [daysAhead, setDaysAhead] = useState(7);

  const calendar = useQuery({
    queryKey: ["calendar"],
    queryFn: () => api.get<CalendarEntry[]>("/calendar"),
    refetchInterval: 15000,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/calendar/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });

  const days = useMemo(
    () => Array.from({ length: daysAhead }, (_, i) => new Date(today.getTime() + i * 86400000)),
    [today, daysAhead],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const c of calendar.data ?? []) {
      const key = new Date(c.publishAt).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [calendar.data]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="The calendar"
          sub="Approved posts drop onto their platform's optimal slot. SmartReach publishes them automatically."
          right={
            <div className="flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-900 p-1">
              {[7, 14].map((n) => (
                <button
                  key={n}
                  onClick={() => setDaysAhead(n)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    daysAhead === n ? "bg-amber-500 text-ink-950" : "text-ink-400"
                  }`}
                >
                  {n} days
                </button>
              ))}
            </div>
          }
        />
        {calendar.isLoading ? (
          <div className="space-y-3 p-5"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {days.map((d) => {
              const key = d.toDateString();
              const items = byDay.get(key) ?? [];
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div key={key} className={`rounded-2xl border p-4 ${isToday ? "border-amber-400/50 bg-amber-400/5" : "border-ink-700 bg-ink-900"}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-ink-100">
                      {DAYS[d.getDay()]}, {d.getDate()} {d.toLocaleString("en", { month: "short" })}
                    </p>
                    {isToday ? <Badge tone="amber">today</Badge> : null}
                  </div>
                  {items.length === 0 ? (
                    <p className="py-3 text-center text-xs text-ink-600">no posts</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((c) => (
                        <div key={c.id} className="group rounded-xl border border-ink-700/70 bg-ink-850 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <PlatformMark platform={c.platform} size={20} />
                              <span className="text-xs font-bold text-ink-200">{platformLabel(c.platform)}</span>
                            </div>
                            <span className="font-mono text-[11px] text-ink-400">
                              {new Date(c.publishAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-400">
                            {c.title ?? c.body.slice(0, 90)}
                          </p>
                          <div className="mt-2.5 flex items-center justify-between">
                            <StatusBadge status={c.status} />
                            {c.status === "SCHEDULED" && (
                              <button
                                onClick={() => cancel.mutate(c.id)}
                                className="text-[11px] font-semibold text-ink-600 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"
                              >
                                cancel
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
