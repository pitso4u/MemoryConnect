import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, Badge, Button, Empty, Skeleton, Field } from "../components/ui";
import { PlatformMark, platformLabel } from "../lib/platforms";

interface PostRow {
  id: string;
  title?: string;
  body: string;
  platform: string;
  status: string;
  tone?: string;
  variant?: string;
  publishedAt?: string;
  scheduledAt?: string;
}

const TABS = ["ALL", "DRAFT", "APPROVED", "SCHEDULED", "PUBLISHED", "FAILED"];

export function Content() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("ALL");
  const [editing, setEditing] = useState<PostRow | null>(null);
  const [when, setWhen] = useState(nextHour());

  const posts = useQuery({
    queryKey: ["posts", tab],
    queryFn: () => api.get<PostRow[]>(`/posts${tab === "ALL" ? "" : `?status=${tab}`}`),
    refetchInterval: 10000,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/posts/${id}/approve`),
    onSuccess: () => qc.invalidateQueries(),
  });
  const schedule = useMutation({
    mutationFn: (p: { id: string; publishAt: string }) => api.post(`/posts/${p.id}/schedule`, { publishAt: p.publishAt }),
    onSuccess: () => {
      qc.invalidateQueries();
      setEditing(null);
    },
  });
  const publishNow = useMutation({
    mutationFn: (id: string) => api.post(`/posts/${id}/publish`),
    onSuccess: () => qc.invalidateQueries(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/posts/${id}`),
    onSuccess: () => qc.invalidateQueries(),
  });

  const list = posts.data ?? [];
  const counts = useCounts(list);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 rounded-2xl border border-ink-700 bg-ink-900 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
              tab === t ? "bg-amber-500 text-ink-950" : "text-ink-400 hover:text-ink-100"
            }`}
          >
            {t}
            <span className={`rounded-full px-1.5 text-[10px] ${tab === t ? "bg-ink-950/15 text-ink-950" : "bg-ink-800 text-ink-400"}`}>
              {counts[t] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {posts.isLoading ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : list.length === 0 ? (
        <Card><Empty title={`No ${tab === "ALL" ? "" : tab.toLowerCase() + " "}posts`} sub="Generate content in the AI Generator, or head to the calendar." /></Card>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <Card key={p.id} className="animate-slide-in p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <PlatformMark platform={p.platform} size={32} />
                  <div className="min-w-0">
                    {p.title ? <p className="display text-lg text-ink-100">{p.title}</p> : null}
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-400">{p.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone="amber">{platformLabel(p.platform)}</Badge>
                      {p.variant ? <Badge>{p.variant}</Badge> : null}
                      {p.scheduledAt ? (
                        <span className="text-[11px] font-semibold text-ink-500">
                          scheduled {formatWhen(p.scheduledAt)}
                        </span>
                      ) : null}
                      {p.publishedAt ? (
                        <span className="text-[11px] font-semibold text-ink-500">
                          published {formatWhen(p.publishedAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.status === "DRAFT" && (
                    <Button variant="ghost" disabled={approve.isPending} onClick={() => approve.mutate(p.id)}>
                      Approve
                    </Button>
                  )}
                  {(p.status === "DRAFT" || p.status === "APPROVED") && (
                    <Button variant="ghost" onClick={() => setEditing(p)}>
                      Schedule
                    </Button>
                  )}
                  {(p.status === "DRAFT" || p.status === "APPROVED") && (
                    <Button disabled={publishNow.isPending} onClick={() => publishNow.mutate(p.id)}>
                      Publish now
                    </Button>
                  )}
                  <button
                    onClick={() => remove.mutate(p.id)}
                    className="text-ink-600 transition hover:text-rose-300"
                    title="Delete"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md animate-fade-up p-6">
            <h3 className="display text-xl text-ink-50">Schedule this post</h3>
            <p className="mt-1 text-sm text-ink-400">
              {platformLabel(editing.platform)} · {editing.title ?? editing.body.slice(0, 60)}…
            </p>
            <div className="mt-5">
              <Field label="Publish at">
                <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button disabled={schedule.isPending} onClick={() => schedule.mutate({ id: editing.id, publishAt: when })}>
                {schedule.isPending ? "Scheduling…" : "Add to calendar"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function useCounts(list: PostRow[]) {
  const counts: Record<string, number> = { ALL: list.length };
  for (const p of list) counts[p.status] = (counts[p.status] ?? 0) + 1;
  return counts;
}

function nextHour() {
  const d = new Date(Date.now() + 3600000);
  d.setMinutes(0, 0, 0);
  return toLocal(d);
}

function toLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
