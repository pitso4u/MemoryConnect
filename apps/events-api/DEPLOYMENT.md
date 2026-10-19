# Events staging/production deployment (isolated from Memorial)

> Status: prepared, NOT yet deployed. Do not commit until the deployer approves.
>
> Runtime note: `@memorialconnect/event-shared` ships native ESM, which the
> Events API consumes via `require()` — supported on Node 22 and Node
> 20.19+. `Dockerfile.events-api` uses `node:20-alpine` (floats to latest
> 20.x), satisfying this.

## Architecture

| Concern | Memorial (existing, untouched) | Events (new) |
|---|---|---|
| Web | `memoryconnect-public` → `memoryconnect.co.za` | `memoryconnect-events-web` → `events.memoryconnect.co.za` |
| API | `memoryconnect-api` → `api.memoryconnect.co.za` | `memoryconnect-events-api` → `events-api.memoryconnect.co.za` |
| Database | `./data` bind mount (`memoryconnect.db`) | `events_db_data` volume (`/data/events.db`) |
| Uploads | `./uploads` bind mount | `events_uploads_data` volume (`/app/uploads`) |
| JWT secret | `JWT_SECRET` in `.env.production` | `EVENTS_JWT_SECRET` in VM-untracked `.env` (fails loudly if missing) |
| CORS | memorial origins | `https://events.memoryconnect.co.za` only |
| Paystack | Memorial-specific key and records | Dedicated `EVENTS_PAYSTACK_SECRET_KEY` and `EventPayment` records |

## Files (all new — no existing file was modified)

- `Dockerfile.events-api`, `Dockerfile.events-web`
- `nginx/events.conf` (static SPA, deliberately NO `/api/` proxy)
- `events.env.production` (non-secret config)
- `docker-compose.events.yml` (overlay — applied on top of `docker-compose.prod.yml`)

## VM prerequisites

1. DNS (Cloudflare): `events.memoryconnect.co.za` and `events-api.memoryconnect.co.za`
   → VM, proxied (same approach as existing hosts). No existing records change.
2. Secrets (one time, untracked, never committed):
   ```bash
   cd /home/pitso4u/apps/MemoryConnect
   cat > .env <<'EOF'
   EVENTS_JWT_SECRET=<generate-a-long-random-value>
   EVENTS_PAYSTACK_SECRET_KEY=<dedicated-Paystack-secret-for-Events>
   EOF
   ```
   Use an Events payment-provider secret for the Events API. Do not copy Memorial `Payment` records or use its database; publishing remains disabled until this secret is configured.
3. External network `infrastructure_default` already exists (used by Memorial).

## Deploy

```bash
cd /home/pitso4u/apps/MemoryConnect
docker compose -f docker-compose.prod.yml -f docker-compose.events.yml \
  up -d --build memoryconnect-events-api memoryconnect-events-web
docker logs memoryconnect-events-api | head -20
curl -s https://events-api.memoryconnect.co.za/health
```

The API container runs `prisma db push` on start, so tables are created on
first boot. Production starts EMPTY — never run the dev seed there.

## Showcase seed (example events)

The landing page links to three example events (`sarah-john-wedding-demo`,
`thabo-50th-birthday-demo`, `naledi-graduation-demo`). Production starts EMPTY,
so run the showcase seed once after first deploy. It is idempotent (upsert by
slug) — safe to re-run any time. It creates/updates exactly those 3 events as
`PUBLISHED` + `UNLISTED` with no expiry, plus a dedicated "MemoryConnect
Showcase" organiser. Guest messages stay disabled on these pages (403).

```bash
cd /home/pitso4u/apps/MemoryConnect
docker exec -i -e EVENTS_SHOWCASE_PASSWORD="$EVENTS_SHOWCASE_PASSWORD" \
  memoryconnect-events-api node dist/scripts/seed-showcase.js
```

(The prod image omits dev dependencies, so there is no `tsx` there — run the
compiled `dist/scripts/seed-showcase.js` with plain `node`. Locally, use
`npm run seed:showcase -w @memorialconnect/events-api` with
`EVENTS_SHOWCASE_PASSWORD` set.)

`EVENTS_SHOWCASE_PASSWORD` sets the showcase organiser's login password. It is
required — the script fails loudly if missing — and must never be committed.
Keep it in the same VM-untracked env handling as `EVENTS_JWT_SECRET`.

NEVER run the dev seed in production (`npm run seed -w
@memorialconnect/events-api`): it creates `demo@events.local` /
`events-demo-123` credentials and dev content. Dev seed is for local only.

## Staging account (no demo credentials in production)

```bash
curl -s -X POST https://events-api.memoryconnect.co.za/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"<name>","organiserName":"<staging family/org>","email":"<staging email>","password":"<strong password>"}'
```

Keep the password out of Git.

## Staging smoke test

1. `https://events.memoryconnect.co.za` loads; register/login works.
2. Create event (title, type, date, location, agenda, photo, theme), publish.
3. Public URL shows hero, programme, venue, gallery, messages, share, QR.
4. Post a guest message; verify it appears.
5. Restart persistence: `docker restart memoryconnect-events-api` →
   event and photos still present.
6. Confirm Memorial is unaffected: existing hosts respond normally.

## UNLISTED semantics

**UNLISTED** means: the event will not appear in public listings or
discovery, but anyone who has the event link can view it. It is NOT
called "private" and it does NOT require authentication to view.

## Logging

`docker logs memoryconnect-events-api` (distinct name from `memoryconnect-api`).
Logs contain startup, DB errors, request/auth/upload errors — never passwords,
secrets, or tokens.

## Rollback (Events only — Memorial untouched)

```bash
cd /home/pitso4u/apps/MemoryConnect
docker compose -f docker-compose.prod.yml -f docker-compose.events.yml \
  stop memoryconnect-events-web memoryconnect-events-api
# optional full removal (keeps volumes/DB by default):
docker compose -f docker-compose.prod.yml -f docker-compose.events.yml \
  rm -f memoryconnect-events-web memoryconnect-events-api
```

Do NOT delete `events_db_data` / `events_uploads_data` on normal rollback.
Memorial services are never named in these commands.
