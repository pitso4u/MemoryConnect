import type { ReactNode } from "react";

export function Card({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <div className={`card ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-700/60 px-5 py-4">
      <div>
        <h3 className="display text-lg text-ink-50">{title}</h3>
        {sub ? <p className="mt-0.5 text-xs text-ink-400">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  return (
    <button className={`${variant === "primary" ? "btn-primary" : "btn-ghost"} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Badge({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "amber" | "green" | "red" | "blue" }) {
  const tones: Record<string, string> = {
    ink: "border-ink-700 bg-ink-900 text-ink-300",
    amber: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    red: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    blue: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-400">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function Stat({
  label,
  value,
  accent = false,
  icon,
  delay = 0,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  icon?: ReactNode;
  delay?: number;
}) {
  return (
    <Card className="animate-fade-up p-5" delay={delay}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
        {icon}
      </div>
      <p className={`display mt-2 text-3xl ${accent ? "text-amber-400" : "text-ink-50"}`}>{value}</p>
    </Card>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-ink-700/60 ${className}`} />;
}

export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="display text-ink-200">{title}</p>
      {sub ? <p className="max-w-sm text-sm text-ink-400">{sub}</p> : null}
    </div>
  );
}
