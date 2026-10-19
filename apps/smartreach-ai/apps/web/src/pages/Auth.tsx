import { useState, FormEvent } from "react";
import { useAuth } from "../auth/store";
import { Button, Field } from "../components/ui";

export function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      if (mode === "login") {
        await login(String(fd.get("email")), String(fd.get("password")));
      } else {
        await register({
          name: String(fd.get("name")),
          email: String(fd.get("email")),
          password: String(fd.get("password")),
          tenantName: String(fd.get("tenantName")),
        });
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-ink-700/60 bg-ink-900 p-12 md:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 font-display text-2xl font-bold text-ink-950">
            S
          </div>
          <div>
            <p className="display text-xl leading-none text-ink-50">SmartReach</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-amber-400">AI</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="display text-4xl leading-tight text-ink-50">
            Connect your business once.
          </p>
          <p className="display mt-3 text-4xl leading-tight text-amber-400">
            AI creates, schedules & publishes your marketing automatically.
          </p>
          <div className="mt-8 space-y-2.5">
            {["Checks your website, blog, events & promo", "Writes posts for every platform", "Publishes at the moment your audience responds", "Captures leads and talks to them for you"].map(
              (t) => (
                <div key={t} className="flex items-center gap-3 text-sm text-ink-300">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  {t}
                </div>
              ),
            )}
          </div>
        </div>

        <p className="text-xs text-ink-500">
          First customer: MemoryConnect · Funeral Services &amp; Digital Memorials
        </p>
      </div>

      <div className="flex w-full items-center justify-center p-8 md:w-1/2">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 md:hidden">
            <p className="display text-3xl text-ink-50">SmartReach AI</p>
            <p className="mt-2 text-sm text-ink-400">Marketing that publishes itself.</p>
          </div>

          <div className="mb-6 flex rounded-xl border border-ink-700 bg-ink-900 p-1">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-bold capitalize transition ${
                  mode === m ? "bg-amber-500 text-ink-950" : "text-ink-300"
                }`}
              >
                {m === "login" ? "Sign in" : "Create workspace"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-4">
                <Field label="Your name">
                  <input className="input" name="name" required placeholder="Pitso Soetsang" />
                </Field>
                <Field label="Business / workspace name">
                  <input className="input" name="tenantName" required placeholder="MemoryConnect" />
                </Field>
              </div>
            )}
            <Field label="Email">
              <input className="input" name="email" type="email" required placeholder="you@company.com" />
            </Field>
            <Field label="Password" hint={mode === "register" ? "At least 8 characters." : undefined}>
              <input className="input" name="password" type="password" required placeholder="••••••••" />
            </Field>

            {error ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
                {error}
              </div>
            ) : null}

            <Button disabled={busy} className="w-full">
              {busy ? "Working…" : mode === "login" ? "Sign in" : "Create your workspace"}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-ink-700/70 bg-ink-900/70 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Demo account</p>
            <p className="mt-1 font-mono text-sm text-ink-200">demo@memoryconnect.co.za</p>
            <p className="font-mono text-sm text-ink-200">DemoPass123!</p>
          </div>
        </div>
      </div>
    </div>
  );
}