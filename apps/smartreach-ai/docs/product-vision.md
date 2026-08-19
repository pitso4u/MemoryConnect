# SmartReach AI — Product Vision

**Vision statement**
> "Connect your business once. AI creates, schedules, and publishes your marketing automatically."

SmartReach AI is a general AI marketing automation platform, built with MemoryConnect as its first customer — and later sellable to driving schools, restaurants, churches, plumbers, and real estate agents.

## What the product becomes

### Logging in shows the command deck
- Connected accounts: Facebook · Instagram · LinkedIn · TikTok · X · Google Business · YouTube · WhatsApp Business
- Last post (minutes ago), Today's reach, Visitors, New leads
- **No manual posting.**

### Phase 1 — MVP (built)
- Authentication (JWT + refresh tokens, RBAC)
- Multi-tenancy (Company → Users → Projects → Campaigns)
- Business & brand profiles (colours, fonts, tone, audience, keywords)
- Content sources the AI reads: website · blog · products · events · memorials · announcements · promotions
- AI Generator → per-platform content: Facebook / LinkedIn / Instagram / TikTok (30s script) / YouTube (2min script) / Blog (1000 words) / Newsletter
- Scheduler & content calendar
- Manual publishing

### Phase 2 — Real integrations + analytics
Facebook, LinkedIn, Google Business, X publishing via official APIs; analytics dashboard with real engagement.

### Phase 3 — Rich media
Instagram publishing, TikTok + YouTube, AI image generation (square/portrait/landscape/story), AI video (image → voice → music → subtitles → video).

### Phase 4 — Revenue engine
CRM, lead scoring, email campaigns, WhatsApp automation, marketing insights, A/B testing.

## Marketing Brain

Keeps statistics: posts, reach, clicks, shares, conversions, followers, top content, best time, best platform. Then it *learns* — instead of "post at 9am" it says "your audience responds better at 18:30. We'll switch automatically."

## Lead Generator

Someone comments "Interested" → auto-reply with a link. Someone fills a form → CRM → email → reminder → follow-up. Automatic.

## Multi-tenancy

```
Company → Users → Projects → Campaigns
```

MemoryConnect is one tenant. A driving school is another. A restaurant another.

## MemoryConnect integration

MemoryConnect plugs into SmartReach through an API — publishing a memorial fires a "new memorial published" event, and SmartReach generates marketing assets, schedules posts, tracks engagement, and follows up. The same platform powers marketing for future products without duplicating code.

```
MemoryConnect
        │
        ▼
   SmartReach API
        │
        ├── AI Content
        ├── Image Generation
        ├── Scheduling
        ├── Social Publishing
        ├── Email Campaigns
        ├── Analytics
        └── CRM
```

## Suggested tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS · TanStack Query · React Router |
| Backend | Node 22 · Express · PostgreSQL · Prisma ORM · BullMQ (background jobs) · Redis |
| AI | OpenAI / DeepSeek / Gemini (optional) · local LLM via Ollama · OpenRouter |
| Storage | S3-compatible object storage (Cloudflare R2 / MinIO) |
| Auth | JWT · refresh tokens · RBAC |

## Naming

Working names: **SmartReach AI** (primary) · AutoReach · MarketPilot · SmartPromote · ContentFlow AI · Growth Engine
