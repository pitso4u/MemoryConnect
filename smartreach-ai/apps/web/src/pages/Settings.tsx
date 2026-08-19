import { useEffect, useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, CardHeader, Button, Badge, Field, Skeleton, Empty } from "../components/ui";
import { CONTENT_SOURCE_TYPES } from "@smartreach/common";

interface Business {
  id: string;
  name: string;
  industry: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  primaryColor: string;
  secondaryColor: string;
  fonts: string;
  tone: string;
  audience: string;
  keywords: string[];
  sources: { id: string; type: string; label: string; url?: string; content?: string; enabled: boolean }[];
}

const TONES = ["Friendly", "Professional", "Luxury", "Modern"];
const AUDIENCES = ["South Africa", "UK", "USA", "Australia"];

export function Settings() {
  const qc = useQueryClient();
  const { data: business, isLoading } = useQuery({
    queryKey: ["business"],
    queryFn: () => api.get<Business>("/business"),
  });

  const [form, setForm] = useState<Partial<Business>>({});
  const [keywordsText, setKeywordsText] = useState("");

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name,
        industry: business.industry,
        website: business.website ?? "",
        description: business.description ?? "",
        primaryColor: business.primaryColor,
        secondaryColor: business.secondaryColor,
        fonts: business.fonts,
        tone: business.tone,
        audience: business.audience,
      });
      setKeywordsText(business.keywords.join(", "));
    }
  }, [business]);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put("/business", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business"] }),
  });

  const addSource = useMutation({
    mutationFn: (s: { businessId: string; type: string; label: string; url?: string; content?: string }) =>
      api.post("/content-sources", s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business"] }),
  });
  const removeSource = useMutation({
    mutationFn: (id: string) => api.del(`/content-sources/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business"] }),
  });

  const [newType, setNewType] = useState<string>(CONTENT_SOURCE_TYPES[0]);
  const [newLabel, setNewLabel] = useState("");
  const [newContent, setNewContent] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({
      ...form,
      keywords: keywordsText.split(",").map((k) => k.trim()).filter(Boolean),
    });
  };

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (!business) return <Empty title="No business profile" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Business profile" sub="Who you are. The AI uses this to sound like you." />
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Field label="Business name"><input className="input" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Industry"><input className="input" value={form.industry ?? ""} onChange={(e) => set("industry", e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Website"><input className="input" value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" hint="The AI reads this to understand your offer.">
              <textarea className="input min-h-24" value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Keywords" hint="Comma-separated. Drives hashtags + SEO.">
              <input className="input" value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder="memorials, funeral services, remembrance" />
            </Field>
          </div>
          <div className="flex items-end justify-end sm:col-span-2">
            <Button disabled={save.isPending}>{save.isPending ? "Saving…" : "Save profile"}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Brand" sub="Colours, fonts and voice." />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Swatch label="Primary colour" value={form.primaryColor ?? "#7c3aed"} onChange={(v) => set("primaryColor", v)} />
          <Swatch label="Secondary colour" value={form.secondaryColor ?? "#f59e0b"} onChange={(v) => set("secondaryColor", v)} />
          <Field label="Font family">
            <select className="input" value={form.fonts ?? "Modern"} onChange={(e) => set("fonts", e.target.value)}>
              {["Modern", "Classic", "Serif", "Humanist"].map((f) => <option key={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Audience">
            <select className="input" value={form.audience ?? "South Africa"} onChange={(e) => set("audience", e.target.value)}>
              {AUDIENCES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Tone">
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("tone", t)}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                      form.tone === t ? "border-amber-400/60 bg-amber-400/10 text-amber-300" : "border-ink-700 bg-ink-900 text-ink-400"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="flex items-center justify-between sm:col-span-2 lg:col-span-4">
            <div className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-lg" style={{ background: form.primaryColor }} />
              <span className="h-8 w-8 rounded-lg" style={{ background: form.secondaryColor }} />
              <Badge>{form.tone} · {form.audience}</Badge>
            </div>
            <Button disabled={save.isPending} onClick={() => {
              save.mutate({
                ...form,
                primaryColor: form.primaryColor,
                secondaryColor: form.secondaryColor,
                fonts: form.fonts,
                tone: form.tone,
                audience: form.audience,
              });
            }}>
              {save.isPending ? "Saving…" : "Save brand"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Content sources" sub="What the AI reads to create your marketing." right={<Badge tone="amber">{business.sources.length}</Badge>} />
        <div className="p-5">
          {business.sources.length === 0 ? (
            <Empty title="No sources yet" sub="Add your website, blog or promotions so the AI has something to write about." />
          ) : (
            <div className="mb-4 space-y-2">
              {business.sources.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
                  <span className="chip"><span className="text-amber-400">{s.type}</span></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-100">{s.label}</p>
                    {s.url ? <p className="truncate text-[11px] text-ink-500">{s.url}</p> : null}
                  </div>
                  {s.content ? <Badge tone="green">has content</Badge> : null}
                  <button onClick={() => removeSource.mutate(s.id)} className="text-ink-600 transition hover:text-rose-300">✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-dashed border-ink-700 p-4 sm:grid-cols-3">
            <Field label="Type">
              <select className="input" value={newType} onChange={(e) => setNewType(e.target.value)}>
                {CONTENT_SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Label / name">
              <input className="input" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="memoryconnect.co.za" />
            </Field>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!newLabel.trim() || addSource.isPending}
                onClick={() => {
                  addSource.mutate({ businessId: business.id, type: newType, label: newLabel.trim(), content: newContent.trim() || undefined });
                  setNewLabel("");
                  setNewContent("");
                }}
              >
                {addSource.isPending ? "Adding…" : "Add source"}
              </Button>
            </div>
            <div className="sm:col-span-3">
              <Field label="Sample content the AI can reference (optional)">
                <textarea
                  className="input min-h-16"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="e.g. Families can now honour loved ones with a beautiful online memorial…"
                />
              </Field>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border border-ink-700 bg-ink-900" />
        <input className="input font-mono" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}