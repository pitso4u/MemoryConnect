# Events Connect — Technical Review

**Scope:** `apps/events-api` · `apps/events` · `packages/event-shared` · deployment overlay
(`Dockerfile.events-api`, `Dockerfile.events-web`, `docker-compose.events.yml`,
`nginx/events.conf`, `events.env.production`).
**Date:** 2026-10-18 · **Status:** API type-checks clean, web build succeeds, isolation guard passes.

## TL;DR

A new "Events Connect" celebrations platform is being added to the monorepo
(alongside the Memorial `fix/public-tributes-production` branch work). It ships
as a standalone Express + Prisma + SQLite service with a matching React/Vite
frontend and a shared TypeScript/Zod catalogue package. **Architecture, data
model, and security posture are excellent.** Two issues block a green test run
and launch readiness; the rest are polish.

| Area | Verdict |
|---|---|
| API runtime (`src/app.ts`, `src/index.ts`, `src/lib/*`, `src/routes/*`) | ✅ Clean |
| Data model (`prisma/schema.prisma`) | ✅ Clean |
| Frontend (`apps/events/src/**`) | ✅ Clean — 2 LOW polish items |
| Shared package (`packages/event-shared`) | ✅ Clean |
| Isolation guard (`scripts/check-isolation.mjs`) | ✅ Passes |
| Tests (`src/__tests__/events.test.ts`) | ✅ 15/15 pass — all green |
| Deployment overlay | ✅ Clean — pre-launch: assets missing |

---

## Findings

### ✅ FIXED — Publish integration tests pass with Paystack mocked

**Was:** 6 of 15 tests failed with `expected 200, got 503` — the publish handler
returns 503 when `EVENTS_PAYSTACK_SECRET_KEY` is absent, and a real key triggers
live HTTP calls to `api.paystack.co`.

**Fix applied:**

1. **`vitest.config.ts`** — added a fake test-only
   `EVENTS_PAYSTACK_SECRET_KEY: 'test-paystack-key-not-real'` to the `env` block
   (same pattern as the existing fake `EVENTS_JWT_SECRET`). This passes the 503
   guard without committing a real secret.

2. **`src/__tests__/events.test.ts`** — added a `vi.mock('../lib/paystack', ...)`
   factory. `initializeEventsPayment` returns a fake `authorization_url`;
   `verifyEventsPayment` echoes back the real `reference` argument so
   `completeEventPublishPayment`'s reference-mismatch check passes.

3. **`publishEvent` helper** — the tests expected `POST /:id/publish` to make the
   event immediately public, but the handler returns a checkout URL and the event
   stays `DRAFT` until payment is verified. Added a helper that calls publish
   then immediately follows up with `GET /:id/verify-publish-payment/:reference`
   to complete the payment flow. All 6 previously-failing tests use it.

4. **`apps/events-api/.env`** — created (gitignored) with the real Paystack test
   key for local development. Tests are fully mocked and don't use it.

> **Confirmed:** `npx vitest run` → **15/15 pass** (both test files green).

---

### ✅ FIXED — Landing-page image assets were referenced but missing

**Was:** `vite build` warned that `/hero.webp`, `/phone-wedding.webp`,
`/example-wedding.webp`, `/example-birthday.webp`, `/example-graduation.webp`
referenced in `apps/events/src/index.css` didn't resolve at build time.

The `apps/events/public/` directory contained only the two logo PNGs and a
`.gitkeep`. The `index.css` hero, phone-mock, and example-card
`background-image` stacks reference five `.webp` files that weren't in the repo.

**Fix applied:** Generated 5 lightweight (~70 KB total) placeholder `.webp` files
into `apps/events/public/` via `scripts/generate-placeholder-images.py`. Each is a
gradient with soft highlight shapes matching the CSS overlay colors for its
context (hero: warm sunset; phone: lavender cream; wedding: rose gold; birthday:
amber; graduation: sky blue) — placeholders to swap for real photography before
launch.

> **Confirmed:** `npm run build -w @memorialconnect/events` → **built with 0 warnings**.

---

### 🟡 HIGH — `GET /health` doesn't probe the database

`src/app.ts:23-25` returns `{ status: 'ok', service: 'events-api' }`
unconditionally. Meanwhile `src/index.ts:6-10` catches a
`prisma.$connect()` failure, logs it, and **still calls `app.listen`** — serving
a healthy-looking app that 500s on every DB query.

In Docker the entrypoint (`prisma db push && node dist/index.js`) means the DB
is ready before boot in practice, but for orchestrator liveness/readiness
checks or a transient DB blip a shallow healthcheck is a footgun.

**Recommendation:** make `/health` run a cheap `SELECT 1` (or
`prisma.$queryRaw`) and return `503` on failure; optionally exit non-zero from
`index.ts` if the initial connect fails so the container restarts.

---

### 🟡 MEDIUM — Loose typing on `listEvents` and platform endpoints

Frontend `api.ts` types several responses as `unknown[]` / `any[]` /
`Record<string, number>`, then leans on `as` casts in `DashboardPage` and
`PlatformPage`. The shapes are well-defined in the shared package
(`EventDetails`, `EventSummary`), and the API returns them faithfully — this is
a typing-opportunity, not a runtime bug. Tightening the return generics
reduces downstream `as` usage and guards against shape drift.

### 🟡 MEDIUM — Stray `export { messageSchema }` in the events route

`routes/events.ts:377` re-exports `messageSchema`, but `routes/public.ts:7`
imports it directly from `@memorialconnect/event-shared`. The re-export is
unused noise that could mislead someone into thinking the route file owns that
schema. **Remove it.**

### 🟡 MEDIUM — Slugs always carry a random suffix

`lib/uploads.ts:24-33` `createEventSlug` unconditionally appends
`Math.random().toString(36).slice(2,8)`, producing URLs like
`/sarah-john-wedding-a1b2c3` even when unique. Uniqueness is guaranteed (the
POST handler retries on collision with a fresh suffix), but the suffix is on
every slug by design. Consider checking for a clean collision first and only
appending the suffix on conflict, for share-friendlier URLs.

---

### 🟢 LOW — Hardcoded Tailwind colors on auth screens

`LoginPage.tsx` / `RegisterPage.tsx` use utility classes like `text-gray-600`,
`text-violet-700` for the "already have an account" links, bypassing the Events
CSS variables (`--ink`, `--plum`) established in `index.css`. The rest of the
auth shell uses the variable-driven classes correctly, so this is an
inconsistency rather than a bug — but it breaks under a future theme change.

### 🟢 LOW — Redundant event fetch after payment verification

In `routes/events.ts:246`, the `verify-publish-payment` handler does a final
`prisma.event.findUnique` *after* `completeEventPublishPayment` already updated
the event's status. It's a harmless extra read, just not necessary.

---

## What's genuinely strong

- **Isolation discipline.** Events has its own DB volume (`/data/events.db`),
  JWT secret (`EVENTS_JWT_SECRET`), Paystack key (`EVENTS_PAYSTACK_SECRET_KEY`),
  Prisma client output (`generated-client/`), env namespace, and even its own
  upload volume. The `check-isolation.mjs` guard **passes**. Dockerfiles, nginx
  config, and the compose overlay touch zero Memorial files.

- **Shared catalogue as single source of truth.** `@memorialconnect/event-shared`
  owns event types, lifecycle, the section catalogue, presentation metadata, and
  Zod schemas — consumed identically by frontend and API. No
  `if (eventType === 'WEDDING')` branching anywhere; adding a type is a
  one-line catalogue entry in `EVENT_TEMPLATE_SECTIONS`.

- **Ownership & visibility security.** `requireOwnedEvent` enforces
  per-organiser isolation (tested: one organiser can't read/edit/publish/extend
  another's event); DRAFT/ARCHIVED → 404 (no existence leak); expired PUBLISHED
  → 410 `EVENT_EXPIRED`. Photo uploads verify magic bytes, not just MIME
  headers. Rate limits on auth, messages, and engagement. Bot filtering +
  idempotent per-visitor view counting via a unique `(eventId, visitorHash)`
  constraint.

- **Payment design.** One-time R299.99 with reference verification against
  amount/currency/purpose, idempotent republish, pending-checkout resumption, and
  `P2002` handling on reference creation.
  `EVENT_PUBLISH_PRICE_CENTS = 29999` is a named constant reused everywhere.

- **Frontend UX.** Progressive creation flow, tabbed editor with auto-verify on
  Paystack return-URL, preview-mode banner, keyboard-accessible tab panels,
  empty states, reduced-motion respect, and a working PWA setup (Workbox
  precache + manifest).

## Verification performed

- `npx tsc --noEmit` (events-api) → clean
- `npm run build -w @memorialconnect/event-shared` → clean
- `npm run build -w @memorialconnect/events` (tsc + vite) → clean (5 warnings: missing `.webp` assets)
- `npx vitest run` → 15/15 pass (both test files green) — see Finding #1
- `node scripts/check-isolation.mjs` → "Isolation check passed"
