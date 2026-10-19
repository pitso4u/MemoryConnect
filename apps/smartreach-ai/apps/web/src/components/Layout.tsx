import { ReactNode } from "react";

const LINKS: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: <Square path="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
  },
  {
    to: "/connect",
    label: "Connected accounts",
    icon: <Square path="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-7 7" />,
  },
  {
    to: "/generator",
    label: "AI Generator",
    icon: <Square path="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />,
  },
  {
    to: "/calendar",
    label: "Calendar",
    icon: <Square path="M3 6h18v15H3zM8 3v6M16 3v6M3 10h18" />,
  },
  {
    to: "/content",
    label: "Content",
    icon: <Square path="M4 4h16v16H4zM4 9h16M9 4v5" />,
  },
  {
    to: "/analytics",
    label: "Marketing Brain",
    icon: <Square path="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
  {
    to: "/leads",
    label: "Leads",
    icon: <Square path="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5 20a7 7 0 0 1 14 0" />,
  },
  {
    to: "/settings",
    label: "Business & brand",
    icon: <Square path="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.6l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.7 7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />,
  },
];

function Square({ path, filled = false }: { path: string; filled?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

export function Sidebar({ active, tenantName, userEmail, onLogout }: { active: string; tenantName: string; userEmail: string; onLogout: () => void }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-ink-700/60 bg-ink-900/70">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 font-display text-xl font-bold text-ink-950">
          S
        </div>
        <div>
          <p className="display text-lg leading-none text-ink-50">SmartReach</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-amber-400">AI</p>
        </div>
      </div>

      <div className="mx-4 mb-4 rounded-xl border border-ink-700/70 bg-ink-850 px-3.5 py-2.5">
        <p className="truncate text-sm font-semibold text-ink-100">{tenantName}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> connected
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {LINKS.map((l) => (
          <a
            key={l.to}
            href={`#${l.to}`}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active === l.to
                ? "bg-amber-500/10 text-amber-300"
                : "text-ink-300 hover:bg-ink-800 hover:text-ink-50"
            }`}
          >
            <span className={active === l.to ? "text-amber-400" : "text-ink-500"}>{l.icon}</span>
            {l.label}
          </a>
        ))}
      </nav>

      <div className="border-t border-ink-700/60 px-4 py-4">
        <p className="truncate text-xs font-semibold text-ink-200">{userEmail}</p>
        <button onClick={onLogout} className="mt-2 text-xs font-semibold text-ink-500 transition hover:text-rose-300">
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function Topbar({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 px-8 pt-7 pb-4">
      <div>
        <h1 className="display text-2xl text-ink-50">{title}</h1>
        {sub ? <p className="mt-1 text-sm text-ink-400">{sub}</p> : null}
      </div>
      {right}
    </header>
  );
}
