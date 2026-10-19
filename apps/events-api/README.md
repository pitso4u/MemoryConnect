# Events API — separate product

Independent Express + Prisma service for celebratory events (weddings, birthdays, graduations, etc.).
Own DB, own JWT secret (`EVENTS_JWT_SECRET`), own uploads dir. Never points at `memoryconnect.db`
or Memorial secrets. See `scripts/check-isolation.mjs` + `DEPLOYMENT.md`.

- Local: `http://localhost:4101` — Health: `GET /health` → `{ status: 'ok', service: 'events-api', version: 'v1' }`
- Prod: `https://events-api.memoryconnect.co.za`

## Stack

Express 4 + Zod + Prisma (SQLite) + `bcryptjs` + `jsonwebtoken` + `multer` + `qrcode`.
Validation schemas come from `@memorialconnect/event-shared`.
Security: `helmet` (CORP `cross-origin` for `/uploads`), `cors` (allowlist), `morgan`,
`express-rate-limit`, JWT auth, magic-byte image verification.

## Layout

```
src/
  app.ts            Express app: middleware, /health, /api/v1/* mounts, 404 + 500 handlers
  index.ts          Boot: prisma.$connect(), listen(PORT, HOST)
  lib/
    env.ts          Zod env parse; loads apps/events-api/.env then root .env (host wins)
    auth.ts         signEventsToken() + authenticateEvents middleware (Bearer JWT)
    platform.ts     Events-only owner overview, account/event/payment oversight, and audit log
    prisma.ts       Prisma client from ../generated-client (isolated output)
    uploads.ts      Uploads dir, slug helper, photo public URL
    rateLimit.ts    authLimiter, messageLimiter, engagementLimiter
    analytics.ts    visitor hash, bot check, expiry / visibility helpers
    validation.ts   Zod-error helpers
  routes/
    auth.ts         POST /api/v1/auth/register, /login, GET /me
    events.ts       Authenticated event CRUD + publish, agenda, locations, moderation, analytics
    photos.ts       Authenticated photo upload/delete (multer, 8 MB, JPEG/PNG/WebP/GIF)
    public.ts       Unauthenticated shareable pages, views, shares, QR, guest messages
  scripts/seed.ts   Dev seed (demo organiser + 3 published events)
  scripts/set-platform-owner.ts  CLI-only role grant/revoke for an existing account
  __tests__/       vitest suite (events.test.ts + setup.ts)
prisma/
  schema.prisma     Organiser, User, Event, EventPhoto/Message/Location/AgendaItem, EventView, AnalyticsEvent, EventPayment (reserved)
  dev-events.db    Local dev DB (via EVENTS_DATABASE_URL)
scripts/check-isolation.mjs   Guard: no Memorial imports/secrets/DB in Events and vice versa
generated-client/  Isolated Prisma client output (never @prisma/client directly)
```

## Data model (prisma/schema.prisma)

`Organiser 1—* User`, `Organiser 1—* Event`. Event owns `photos`, `messages`,
`locations`, `agenda`, `views`, `analytics`, `payments`.
Lifecycle: `DRAFT → PUBLISHED → EXPIRED` (only if organiser sets `expiresAt`) / `ARCHIVED`
(soft-delete via `DELETE /:id`). Visibility `PUBLIC` / `UNLISTED` — UNLISTED hides from
listings but the link still views without auth. A verified Paystack payment of **R299.99
once per event** is required to publish; republishing the same paid event is free. Payments
are stored only in the Events database and use the separate `EVENTS_PAYSTACK_SECRET_KEY`.

## API

Base `/api/v1`. Success envelope `{ success: true, data }`, errors `{ success: false, error, code? }`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | no | liveness |
| POST | `/api/v1/auth/register` | rate-limited | `{ name, organiserName, email, password }` → 201 `{ accessToken, user, organiser }` |
| POST | `/api/v1/auth/login` | rate-limited | `{ email, password }` → `{ accessToken, user, organiser }` |
| GET | `/api/v1/auth/me` | JWT | current user + organiser + role |
| GET | `/api/v1/platform/overview` | Events `SUPER_ADMIN` | platform counts and verified publishing revenue |
| GET | `/api/v1/platform/organisers` | Events `SUPER_ADMIN` | all organiser accounts and event/user counts |
| POST | `/api/v1/platform/organisers/:id/suspend` / `reactivate` | Events `SUPER_ADMIN` | suspend access or reactivate; actions are audited |
| GET | `/api/v1/platform/events` | Events `SUPER_ADMIN` | all events and engagement counts |
| POST | `/api/v1/platform/events/:id/status` | Events `SUPER_ADMIN` | set `DRAFT` (unpublish) or `ARCHIVED`; actions are audited |
| GET | `/api/v1/platform/payments` | Events `SUPER_ADMIN` | Events publishing payments and provider references |
| GET | `/api/v1/platform/audit-logs` | Events `SUPER_ADMIN` | latest 250 platform owner actions |
| GET | `/api/v1/events` | JWT | own organiser's events, `_count{photos,messages}`, `updatedAt desc` |
| POST | `/api/v1/events` | JWT | `createEventSchema`; auto-unique slug; defaults `timezone Africa/Johannesburg`, `visibility PUBLIC`, `theme CELEBRATION` |
| GET | `/api/v1/events/:id` | JWT (owner) | full include (photos/messages/locations/agenda) |
| PATCH | `/api/v1/events/:id` | JWT (owner) | `updateEventSchema` partial |
| DELETE | `/api/v1/events/:id` | JWT (owner) | soft-archive → `{ archived: true }` |
| POST | `/api/v1/events/:id/publish` | JWT (owner) | Starts Paystack checkout for R299.99; does not publish until server verifies the transaction |
| GET | `/api/v1/events/:id/verify-publish-payment/:reference` | JWT (owner) | Verifies Paystack and publishes the event only on a matching successful ZAR 29999 payment |
| POST | `/api/v1/events/:id/unpublish` | JWT (owner) | back to `DRAFT` |
| POST | `/api/v1/events/:id/agenda` | JWT (owner) | `agendaItemSchema`; auto `order` |
| DELETE | `/api/v1/events/:id/agenda/:itemId` | JWT (owner) | → `{ deleted: true }` |
| POST | `/api/v1/events/:id/locations` | JWT (owner) | `locationSchema`; auto `order` |
| DELETE | `/api/v1/events/:id/locations/:locationId` | JWT (owner) | → `{ deleted: true }` |
| PATCH | `/api/v1/events/:id/messages/:messageId` | JWT (owner) | `{ approved: boolean }` |
| DELETE | `/api/v1/events/:id/messages/:messageId` | JWT (owner) | → `{ deleted: true }` |
| GET | `/api/v1/events/:id/analytics` | JWT (owner) | `{ viewCount, uniqueVisitors, events{type:count} }` |
| POST | `/api/v1/events/:id/photos` | JWT (owner) | multipart `photo` + optional `caption` (300 chars); 8 MB; magic-byte checked → 201 photo `{ url: /uploads/<eventId>/<file> }` |
| DELETE | `/api/v1/events/:id/photos/:photoId` | JWT (owner) | deletes row + best-effort file |
| GET | `/api/v1/public/events/:slug` | no | published + unexpired only; includes approved messages; DRAFT/ARCHIVED → 404, expired PUBLISHED → 410 `EVENT_EXPIRED` |
| GET | `/api/v1/public/events/:slug/qr` | no | PNG QR of `${EVENTS_PUBLIC_URL}/${slug}` (`Cache-Control: max-age=86400`) |
| POST | `/api/v1/public/events/:slug/view` | rate-limited | `{ visitorId (12–200 chars) }`; bot-filtered; deduped by `(eventId, visitorHash)` → `{ counted, viewCount }` |
| POST | `/api/v1/public/events/:slug/share` | rate-limited | records `share` analytics |
| POST | `/api/v1/public/events/:slug/qr-scan` | rate-limited | records `qr_scan` analytics |
| POST | `/api/v1/public/events/:slug/messages` | rate-limited | `messageSchema` (1000-char cap); v1 auto-approves → 201; demo (`isDemo`) pages → 403 |

Static: `GET /uploads/*` serves `EVENTS_UPLOADS_DIR`.

## Env

Copy `.env.example` → `.env`. Only `EVENTS_*` keys are read — Memorial `JWT_SECRET` / `DATABASE_URL` are rejected by the isolation check.

| Key | Default | Notes |
|---|---|---|
| `PORT` / `HOST` | `4101` / `0.0.0.0` | listen address |
| `NODE_ENV` | `development` | `development \| production \| test` |
| `EVENTS_DATABASE_URL` | `file:./dev-events.db` | prod: `/data/events.db` volume |
| `EVENTS_JWT_SECRET` | — (required, min 16 chars) | fails loudly if missing |
| `EVENTS_JWT_EXPIRES_IN` | `7d` | token TTL |
| `EVENTS_CORS_ORIGIN` | `http://localhost:5177` | comma-separated allowlist; prod `https://events.memoryconnect.co.za` |
| `EVENTS_UPLOADS_DIR` | `./uploads` | prod `/app/uploads` volume |
| `EVENTS_PUBLIC_URL` | `http://localhost:5177` | used for QR URLs |
| `EVENTS_PAYSTACK_SECRET_KEY` | unset | Events-only Paystack key; publishing checkout is disabled until configured |
| `EVENTS_AUTH_RATE_LIMIT_MAX` | `10` | register/login per window |
| `EVENTS_MESSAGE_RATE_LIMIT_MAX` | `5` | guest messages per window |

## Run locally

```bash
cp apps/events-api/.env.example apps/events-api/.env
npm run build -w @memorialconnect/event-shared
npm run db:push -w @memorialconnect/events-api
npm run seed -w @memorialconnect/events-api
npm run dev -w @memorialconnect/events-api
```

Health: `http://localhost:4101/health`. Demo login (after seed): `demo@events.local` / `events-demo-123`
(seeds wedding + birthday + graduation, all `PUBLISHED`; idempotent, skips existing slugs).

## Scripts

| Script | Command |
|---|---|
| dev | `tsx watch src/index.ts` |
| build / start | `tsc` / `node dist/index.js` |
| `db:generate` / `db:push` | `prisma generate` / `prisma db push` |
| `seed` | `tsx src/scripts/seed.ts` |
| `seed:showcase` | `tsx src/scripts/seed-showcase.ts` (idempotent; needs `EVENTS_SHOWCASE_PASSWORD`; the ONLY seed allowed in prod) |
| `platform-owner` | `npm run platform-owner -w @memorialconnect/events-api -- <grant|revoke> <existing-user-email>` |
| `test` | `vitest run` (isolated `prisma/test-events.db`, secret, uploads; `EVENTS_AUTH_RATE_LIMIT_MAX=100`) |
| `check:isolation` | `node scripts/check-isolation.mjs` |

## Isolation

Events must never import `@prisma/client` (use `../../generated-client`), Memorial's
`JWT_SECRET` / `DATABASE_URL` / `memoryconnect.db`, or `@memorialconnect/shared`
(use `@memorialconnect/event-shared`). Run `npm run check:isolation -w @memorialconnect/events-api`
in CI. Production starts EMPTY — never run dev seed there (see `DEPLOYMENT.md` for
staging/prod, smoke test, logs, Events-only rollback).

### Platform owner access

Events superuser access is isolated from MemorialConnect's owner account and database.
Create a normal Events account first, then grant or revoke its role from the API host's
command line after `db:push`:

```bash
npm run platform-owner -w @memorialconnect/events-api -- grant owner@example.com
npm run platform-owner -w @memorialconnect/events-api -- revoke owner@example.com
```

Only that command can change the `SUPER_ADMIN` role; registration never accepts a role.
The owner console is at `/platform`. Organiser suspension blocks existing and new sessions.
Owner status changes are recorded in the Events database audit log.
