import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, CardHeader, Button, Badge, Empty, Skeleton, Field } from "../components/ui";
import { PlatformMark, platformLabel } from "../lib/platforms";
import { GENERATOR_PLATFORMS } from "@smartreach/common";

interface GeneratedPost {
  id: string;
  title?: string;
  body: string;
  platform: string;
  status: string;
  tone?: string;
  variant?: string;
}

const VARIANT_ORDER = ["Friendly", "Professional", "Luxury", "Modern"];

export function Generator() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([...GENERATOR_PLATFORMS.slice(0, 4)]);
  const [topics, setTopics] = useState("");

  const business = useQuery({
    queryKey: ["business"],
    queryFn: () => api.get<any>("/business"),
  });

  const posts = useQuery({
    queryKey: ["posts", "DRAFT"],
    queryFn: () => api.get<GeneratedPost[]>("/posts?status=DRAFT"),
    refetchInterval: 5000,
  });

  const generate = useMutation({
    mutationFn: () => api.post<GeneratedPost[]>("/posts/generate", { platforms: selected }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts", "DRAFT"] }),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/posts/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts", "DRAFT"] });
      qc.invalidateQueries({ queryKey: ["posts", "APPROVED"] });
    },
  });

  const toggle = (p: string) =>
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  const grouped = useMemo(() => {
    const map = new Map<string, GeneratedPost[]>();
    for (const p of posts.data ?? []) {
      if (!map.has(p.platform)) map.set(p.platform, []);
      map.get(p.platform)!.push(p);
    }
    return map;
  }, [posts.data]);

  const ready = business.data && (business.data.name && business.data.industry) ? true : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="What the AI reads"
          sub="Instead of writing posts manually, SmartReach pulls from your business's real sources."
          right={<Badge tone="amber">{business.data?.sources?.length ?? 0} sources</Badge>}
        />
        {business.isLoading ? (
          <div className="space-y-2 p-5"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
        ) : !ready ? (
          <Empty title="Finish your business profile first" sub="Add your industry, website and keywords in Business & brand, then come back." />
        ) : (
          <div className="flex flex-wrap gap-2 p-5">
            {(business.data?.sources ?? []).map((s: any) => (
              <span key={s.id} className="chip">
                <span className="text-amber-400">{s.type}</span> · {s.label}
              </span>
            ))}
            <span className="chip border-dashed text-ink-500">
              + website · blog · events · memorials · promotions
            </span>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="AI Generator" sub="Pick platforms, hit generate. Drafts land in your library." />
        <div className="p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Platforms</p>
          <div className="flex flex-wrap gap-2">
            {GENERATOR_PLATFORMS.map((p) => {
              const on = selected.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => toggle(p)}
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                    on ? "border-amber-400/60 bg-amber-400/10 text-amber-300" : "border-ink-700 bg-ink-900 text-ink-400 hover:border-ink-600"
                  }`}
                >
                  <PlatformMark platform={p} size={18} />
                  {platformLabel(p)}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <Field label="Focus topic (optional)" hint={`e.g. "new online memorials" — leave blank to let the AI choose from your sources.`}>
              <input className="input" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="e.g. how families can honour loved ones online" />
            </Field>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button
              disabled={selected.length === 0 || generate.isPending || !ready}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
                  Generating…
                </>
              ) : (
                "Generate today's content"
              )}
            </Button>
            <p className="text-xs text-ink-500">
              Writes {selected.length} platform{selected.length === 1 ? "" : "s"} × 3 tone variants.
            </p>
          </div>
        </div>
      </Card>

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">Generated drafts</p>
        {posts.isLoading ? (
          <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        ) : grouped.size === 0 ? (
          <Card><Empty title="No drafts yet" sub="Hit generate above and the AI will write today's posts for every platform you selected." /></Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[...grouped.entries()].map(([platform, list]) => (
              <PlatformCard
                key={platform}
                platform={platform}
                list={list}
                approving={approve.isPending}
                onApprove={(id) => approve.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlatformCard({
  platform,
  list,
  approving,
  onApprove,
}: {
  platform: string;
  list: GeneratedPost[];
  approving: boolean;
  onApprove: (id: string) => void;
}) {
  const [view, setView] = useState<string | null>(null);
  const variants = [...new Set(list.map((p) => p.variant ?? "Modern"))].sort(
    (a, b) => VARIANT_ORDER.indexOf(a) - VARIANT_ORDER.indexOf(b),
  );
  const activeVariant = variants[0] ?? "Modern";
  const current = list.find((p) => (view ?? activeVariant) === p.variant) ?? list[0];
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b border-ink-700/60 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <PlatformMark platform={platform} size={26} />
          <span className="display text-ink-50">{platformLabel(platform)}</span>
        </div>
        <div className="flex gap-1">
          {variants.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition ${
                (view ?? activeVariant) === v ? "bg-amber-500 text-ink-950" : "text-ink-400 hover:text-ink-100"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 px-5 py-4">
        {current?.title ? <p className="display mb-2 text-lg text-ink-100">{current.title}</p> : null}
        <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-300">{current?.body}</pre>
      </div>
      <div className="flex items-center justify-between border-t border-ink-700/60 px-5 py-3.5">
        <Badge tone={current?.status === "DRAFT" ? "ink" : "blue"}>{current?.status}</Badge>
        <Button
          variant="ghost"
          disabled={approving || current?.status !== "DRAFT"}
          onClick={() => onApprove(current.id)}
        >
          Approve → schedule
        </Button>
      </div>
    </Card>
  );
}
