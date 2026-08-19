import { useEffect, useState } from "react";
import { useAuth } from "./auth/store";
import { Sidebar, Topbar } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Connect } from "./pages/Connect";
import { Generator } from "./pages/Generator";
import { CalendarPage } from "./pages/CalendarPage";
import { Content } from "./pages/Content";
import { Analytics } from "./pages/Analytics";
import { Leads } from "./pages/Leads";
import { Settings } from "./pages/Settings";
import { Auth } from "./pages/Auth";

const TITLES: Record<string, { title: string; sub?: string }> = {
  "/dashboard": { title: "Command deck", sub: "Everything your marketing did today — automatically." },
  "/connect": { title: "Connected accounts", sub: "Link your business once. SmartReach publishes everywhere." },
  "/generator": { title: "AI Generator", sub: "Feed it your business. It writes today's content." },
  "/calendar": { title: "Content calendar", sub: "Scheduled posts across every platform." },
  "/content": { title: "Content library", sub: "Drafts, approved posts and published work." },
  "/analytics": { title: "Marketing Brain", sub: "It watches the numbers, learns, and adjusts." },
  "/leads": { title: "Leads", sub: "Interested people, captured automatically." },
  "/settings": { title: "Business & brand", sub: "Who you are. What you sound like." },
};

export function App() {
  const { session, loading, logout } = useAuth();
  const [route, setRoute] = useState(window.location.hash.replace("#", "") || "/dashboard");

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace("#", "") || "/dashboard");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (loading) {
    return (
      <div className="grain flex h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-ink-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-600 border-t-amber-400" />
          <span className="text-sm font-semibold">Warming up SmartReach…</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="grain">
        <Auth />
      </div>
    );
  }

  const meta = TITLES[route] ?? TITLES["/dashboard"];

  return (
    <div className="grain flex h-screen overflow-hidden">
      <Sidebar
        active={route}
        tenantName={session.tenant?.name ?? ""}
        userEmail={session.user.email}
        onLogout={logout}
      />
      <main className="flex-1 overflow-y-auto">
        <Topbar title={meta.title} sub={meta.sub} />
        <div className="px-8 pb-12">
          {route === "/dashboard" && <Dashboard />}
          {route === "/connect" && <Connect />}
          {route === "/generator" && <Generator />}
          {route === "/calendar" && <CalendarPage />}
          {route === "/content" && <Content />}
          {route === "/analytics" && <Analytics />}
          {route === "/leads" && <Leads />}
          {route === "/settings" && <Settings />}
        </div>
      </main>
    </div>
  );
}
