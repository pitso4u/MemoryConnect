# Events frontend — separate product

React + Vite PWA for `events.memoryconnect.co.za` (local: `http://localhost:5177`).
Organiser dashboard + shareable public event pages (hero, programme, venue, gallery,
messages, share, QR). Talks to the Events API only — never Memorial's API.

Requires the Events API on `http://localhost:4101` (see `apps/events-api/README.md`).
Demo: `demo@events.local` / `events-demo-123` after seeding.

Creating and editing events is free. Publishing costs **R299.99 (about R300) once per event**
through Paystack. Republish of an event that has already been paid for is free.

## Stack

React 19 + React Router 7 + Vite 6 + Tailwind CSS v4 (`@tailwindcss/vite`) + `vite-plugin-pwa`
(auto-update, `theme_color #7c3aed`, standalone). Shared validation via `@memorialconnect/event-shared`.
No backend code, no Prisma, no secrets in the bundle — only `VITE_EVENTS_API_URL`.

## Layout

```
src/
  main.tsx          React root: BrowserRouter + AuthProvider + App + index.css
  App.tsx           Routes (see below)
  lib/
    api.ts          fetch wrapper: apiBase(), photoUrl(), ApiError{status,code},
                    eventsApi{auth, events, agenda, locations, messages, photos, public, analytics, qrUrl},
                    getVisitorId() (localStorage events_visitor for deduped views)
    auth.tsx        AuthContext: token in localStorage events_token, user, login/register/logout, me() on boot
  pages/
    HomePage.tsx        Marketing/landing
    LoginPage.tsx       Organiser login
    RegisterPage.tsx    Organiser + organiserName + credentials
    DashboardPage.tsx   Own events list, analytics counts
    EventEditorPage.tsx Create/edit event, agenda, locations, photos, publish/unpublish, moderation
    PublicEventPage.tsx Slug page: publicEvent() + recordView/share/qrScan + postMessage + QR image
  components/       Shared UI
  index.css         Tailwind entry
index.html          Vite entry
vite.config.ts      dev server 0.0.0.0:5177, PWA manifest, event-shared CommonJS interop
```

## Routes (src/App.tsx)

| Path | Page | Auth |
|---|---|---|
| `/` | HomePage | public |
| `/login` | LoginPage | public |
| `/register` | RegisterPage | public |
| `/dashboard` | DashboardPage | organiser (token) |
| `/events/new` | EventEditorPage | organiser (token) |
| `/events/:id` | EventEditorPage | organiser (token) |
| `/:slug` | PublicEventPage | public (published + unexpired; expired → `EVENT_EXPIRED` notice) |
| `*` | → `/` | — |

## API client (src/lib/api.ts)

Base `VITE_EVENTS_API_URL` (fallback `http://localhost:4101`). JSON requests send
`Authorization: Bearer <events_token>` when present; responses unwrap `{ data }` and throw
`ApiError` on `{ error, code }`. Photo uploads use `FormData` (no JSON header); `photoUrl()`
prefixes relative `/uploads/*` paths with the API base.

Covers: `register`, `login`, `me`, `listEvents`, `getEvent`, `createEvent`, `updateEvent`,
`publish`, `analytics`, `addAgenda`/`deleteAgenda`, `addLocation`/`deleteLocation`,
`moderateMessage`/`deleteMessage`, `uploadPhoto`/`deletePhoto`, `publicEvent`, `recordView`
(visitorId), `recordShare`, `recordQrScan`, `postMessage`, `qrUrl`.

## Env

| Key | Default | Notes |
|---|---|---|
| `VITE_EVENTS_API_URL` | `http://localhost:4101` | prod `https://events-api.memoryconnect.co.za`; baked at build time |

```bash
cp apps/events/.env.example apps/events/.env
```

## Run locally

```bash
cp apps/events/.env.example apps/events/.env
npm run dev -w @memorialconnect/events        # http://localhost:5177
```

Needs API first:

```bash
npm run build -w @memorialconnect/event-shared
npm run db:push -w @memorialconnect/events-api
npm run seed -w @memorialconnect/events-api
npm run dev -w @memorialconnect/events-api    # http://localhost:4101
```

Then visit `http://localhost:5177`, register or log in with the demo account,
create an event → pay R299.99 through Paystack → open `/:slug` public URL, post a guest message, check QR.

## Scripts

| Script | Command |
|---|---|
| dev | `vite` (HMR, host `0.0.0.0:5177`) |
| build | `tsc -b && vite build` |
| preview | `vite preview` (serve prod build) |

## PWA

`VitePWA({ registerType: 'autoUpdate' })`, manifest `MemoryConnect Events` / `Events`,
`start_url /`, workbox caches `**/*.{js,css,html,png,svg}`. Icons in `public/`.

## Deploy

Prod hosts: web `events.memoryconnect.co.za`, API `events-api.memoryconnect.co.za`
(no `/api/` proxy — `nginx/events.conf` serves the static SPA only; the app calls the API
origin directly, so CORS must allow the web origin). Build arg `VITE_EVENTS_API_URL` must be
set at image build time (`Dockerfile.events-web`). See root `DEPLOYMENT.md` in
`apps/events-api/` for DNS, compose overlay, smoke test, and rollback.
