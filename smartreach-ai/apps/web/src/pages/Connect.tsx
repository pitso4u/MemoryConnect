import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, CardHeader, Button, Skeleton } from "../components/ui";
import { PLATFORM_META } from "../lib/platforms";
import { SOCIAL_PLATFORMS } from "@smartreach/common";

export function Connect() {
  const qc = useQueryClient();
  const [handle, setHandle] = useState("");
  const [pick, setPick] = useState<string>("facebook");

  const data = useQuery({
    queryKey: ["connections"],
    queryFn: () => api.get<{ available: string[]; connected: string[]; connections: any[] }>("/connections"),
  });

  const connect = useMutation({
    mutationFn: (p: { platform: string; handle: string }) => api.post("/connections/connect", p),
    onSuccess: () => {
      setHandle("");
      qc.invalidateQueries({ queryKey: ["connections"] });
    },
  });

  const disconnect = useMutation({
    mutationFn: (platform: string) => api.post("/connections/disconnect", { platform }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });

  const connected = new Set(data.data?.connected ?? []);
  const pending = (pick && handle.trim()) ? true : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Link your platforms"
          sub="One connection. SmartReach schedules and publishes to every account automatically."
        />
        <div className="p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.isLoading
              ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)
              : SOCIAL_PLATFORMS.map((p) => {
                  const meta = PLATFORM_META[p];
                  const isConnected = connected.has(p);
                  return (
                    <button
                      key={p}
                      onClick={() => setPick(p)}
                      className={`relative rounded-2xl border p-4 text-left transition ${
                        pick === p
                          ? "border-amber-400/60 bg-amber-400/5"
                          : "border-ink-700 bg-ink-900 hover:border-ink-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-lg font-display text-sm font-bold text-ink-950"
                          style={{ backgroundColor: meta.color }}
                        >
                          {meta.short}
                        </span>
                        {isConnected && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0C0F0D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-sm font-semibold text-ink-100">{meta.label}</p>
                      <p className="text-[11px] text-ink-500">
                        {isConnected ? data.data?.connections.find((c) => c.platform === p)?.handle ?? "connected" : "not connected"}
                      </p>
                    </button>
                  );
                })}
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4">
            <div className="min-w-[180px] flex-1">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-400">Platform</p>
              <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p} value={p}>{PLATFORM_META[p].label}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px] flex-1">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-400">Handle / page name</p>
              <input
                className="input"
                placeholder="yourpage"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </div>
            <Button
              disabled={!pending || connect.isPending}
              onClick={() => connect.mutate({ platform: pick, handle: handle.trim() })}
            >
              {connect.isPending ? "Connecting…" : "Connect account"}
            </Button>
            {connected.has(pick) && (
              <Button
                variant="ghost"
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate(pick)}
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="What connects automatically" sub="The pipeline that runs without you." />
        <div className="grid grid-cols-1 gap-px bg-ink-700/60 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["✓ Facebook", "Page posts"],
            ["✓ Instagram", "Feed + story sizes"],
            ["✓ LinkedIn", "Company updates"],
            ["✓ TikTok", "Short video scripts"],
            ["✓ X", "Tweet threads"],
            ["✓ Google Business", "Local posts"],
            ["✓ YouTube", "Video uploads"],
            ["✓ WhatsApp", "Broadcasts"],
          ].map(([a, b]) => (
            <div key={a} className="bg-ink-850 p-4">
              <p className="text-sm font-bold text-ink-100">{a}</p>
              <p className="mt-1 text-xs text-ink-500">{b}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
