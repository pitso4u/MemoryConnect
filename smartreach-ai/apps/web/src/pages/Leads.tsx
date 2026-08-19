import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, CardHeader, Button, Badge, Empty, Skeleton, Field } from "../components/ui";

interface LeadRow {
  id: string;
  name: string;
  email: string;
  source: string;
  status: string;
  notes?: string;
  createdAt: string;
}

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];

const STATUS_TONE: Record<string, "amber" | "blue" | "green" | "red" | "ink"> = {
  NEW: "amber",
  CONTACTED: "blue",
  QUALIFIED: "blue",
  WON: "green",
  LOST: "red",
};

export function Leads() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const leads = useQuery({
    queryKey: ["leads"],
    queryFn: () => api.get<LeadRow[]>("/leads"),
    refetchInterval: 15000,
  });

  const setStatus = useMutation({
    mutationFn: (p: { id: string; status: string }) => api.patch(`/leads/${p.id}/status`, { status: p.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/leads/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
  const create = useMutation({
    mutationFn: (p: { name: string; email: string; source: string; notes?: string }) => api.post("/leads", p),
    onSuccess: () => {
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const list = leads.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">
          A comment, a form, a WhatsApp — SmartReach captures it, drops it here, and follows up.
        </p>
        <Button onClick={() => setShowForm((s) => !s)}>Capture a lead</Button>
      </div>

      {showForm && (
        <Card className="animate-fade-up p-5">
          <LeadForm onSubmit={(v) => create.mutate(v)} busy={create.isPending} onCancel={() => setShowForm(false)} />
        </Card>
      )}

      <Card>
        <CardHeader title="Leads" sub="Simulated capture pipeline — CRM, email, reminder, follow-up." right={<Badge tone="amber">{list.length} total</Badge>} />
        {leads.isLoading ? (
          <div className="space-y-2 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : list.length === 0 ? (
          <Empty title="No leads yet" sub="Capture one manually, or connect a comment listener." />
        ) : (
          <div className="divide-y divide-ink-700/60">
            {list.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-800 font-display text-sm text-amber-300">
                  {l.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink-100">{l.name}</p>
                  <p className="text-xs text-ink-400">{l.email} · {l.source.toLowerCase()}</p>
                  {l.notes ? <p className="mt-0.5 text-xs italic text-ink-500">{l.notes}</p> : null}
                </div>
                <span className="text-[11px] font-semibold text-ink-500">{timeAgo(l.createdAt)}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={l.status}
                    onChange={(e) => setStatus.mutate({ id: l.id, status: e.target.value })}
                    className="input w-auto py-1.5 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <Badge tone={STATUS_TONE[l.status] ?? "ink"}>{l.status}</Badge>
                  <button onClick={() => remove.mutate(l.id)} className="text-ink-600 transition hover:text-rose-300">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function LeadForm({
  onSubmit,
  busy,
  onCancel,
}: {
  onSubmit: (v: { name: string; email: string; source: string; notes?: string }) => void;
  busy: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onSubmit({ name: name.trim(), email: email.trim(), source: "FORM", notes: notes.trim() || undefined });
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <div className="sm:col-span-2">
        <Field label="Notes"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Interested in a memorial" /></Field>
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button disabled={busy}>{busy ? "Saving…" : "Capture lead"}</Button>
      </div>
    </form>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
