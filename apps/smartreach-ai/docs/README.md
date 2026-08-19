# SmartReach AI — Docs

- [README](../README.md) — overview, quick start, API reference, data model
- [Product Vision](product-vision.md) — the full product spec and roadmap
- [AI Providers](ai-providers.md) — Ollama & OpenRouter setup

## Verification checklist

After `npm run dev`, from `http://localhost:5175`:

1. Sign in as `demo@memoryconnect.co.za` / `DemoPass123!`.
2. **Dashboard** — shows 8 connected accounts, today's reach, visitors, leads, last post and upcoming schedule.
3. **AI Generator** — pick Facebook + LinkedIn, hit *Generate today's content*. Drafts appear grouped with tone tabs.
4. **Content** — Approve a draft, then *Schedule* it a minute ahead (use the datetime picker).
5. **Calendar** — the post appears in its day/time. The **worker** publishes it automatically within ~15s.
6. **Dashboard/Leads** — the published post shows up, reach ticks up, and the lead pipeline is visible.
7. **Marketing Brain** — a reach chart, per-platform bars, and best-times appear once posts have been published.
8. **Settings** — edit brand (colours, tone, audience) and add/remove content sources.

To watch the worker publish in real time:

```bash
npm run dev:worker
```

## Switching to a real AI model

By default `AI_PROVIDER=template` (no keys). For live generation:

```bash
AI_PROVIDER=ollama           # local
# or
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
```

See [ai-providers.md](ai-providers.md).