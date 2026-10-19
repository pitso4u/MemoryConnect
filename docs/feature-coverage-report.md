# Feature Coverage Report

**Scope:** End-to-end coverage of every registered feature flag in MemoryConnect —
its backend route guards, admin UI route/nav guards, implementation pages, and
test coverage. Generated after the feature-flag audit (commit `3acf961`).

## How protection works

- **Backend:** `requireFeature('<KEY>')` middleware (`apps/api/src/lib/featureService.ts`)
  resolves a feature via `canAccess()` (release channel → override → global flag →
  edition → plan → rollout → **dependencies**) and returns **403** when unavailable.
  Runs **after** `authenticate`, so `req.user` is always populated. All 6 guarded
  routes mount it via `router.use(...)` (covers every HTTP verb on that path prefix).
- **Admin UI:** `FeatureOnly` route wrapper (`apps/admin/src/App.tsx`) redirects to
  `/dashboard` when the feature is off; `DashboardLayout` hides nav items whose
  `featureKey` is unavailable (driven by `hasFeature` from `AuthContext`, refreshed on
  load **and** on window focus).
- **Cache:** feature definitions cached 60s (`featureCache`); invalidated after every
  definition/override/dependency mutation and after the DB migration cleanup.

## Feature registry matrix

| Feature | Channel / Global | Premium | Min edition · plan | Backend guard (route) | UI route guard | Nav entry | Tests |
|---|---|---|---|---|---|---|---|
| BROCHURES | GA · yes | no | FUNERAL_OFFICE · PROFESSIONAL | `marketing.ts` `/brochures`, `/categories` | App.tsx `marketing/brochures*`, `marketing/categories` | Digital Brochures, Categories | route-guards (block + allow + override) |
| PROMOTIONS | GA · yes | no | FUNERAL_OFFICE · PROFESSIONAL | `marketing.ts` `/promotions` | App.tsx `marketing/promotions` | Promotions | route-guards |
| FEEDBACK | GA · yes | no | — | `feedback.ts` `/admin/memorials/:id/feedback` (+summary, status, contact-enquiries) | _(no admin UI page yet)_ | _(none)_ | route-guards (block + allow) |
| VEHICLES | QA · no | yes | FUNERAL_OFFICE · PROFESSIONAL | `vehicles.ts` (all) | App.tsx `vehicles` | Vehicles | route-guards* |
| ASSETS | QA · no | yes | FUNERAL_OFFICE · PROFESSIONAL | `assets.ts` (all, incl. `/documents`) | App.tsx `assets` | Assets | route-guards* |
| FUNERAL_RESOURCES | QA · no | yes | FUNERAL_OFFICE · BUSINESS | `funeral-resources.ts` (all) | App.tsx `funeral-resources` | Funeral Resources | route-guards* |
| MEMORIALS | GA · yes | no | — | _(credit/entitlement gate, not feature)_ | App.tsx `create`, `memorial/:id` | New Memorial | publishing (credit) |
| PHOTO_LIGHTBOX | GA · yes | no | — | _(GA viewing feature — always on)_ | — | — | — |
| GPS | GA · yes | no | — | _(GA viewing feature — always on)_ | — | — | — |
| LIVE_STREAM | INTERNAL · no | yes | FUNERAL_OFFICE · BUSINESS | _(memorial embed — not a route guard)_ | — | — | — |
| STAFF | GA · yes | no | — · PROFESSIONAL | _(no guard)_ | _(placeholder `/staff`→ProfilePage)_ | _(none)_ | — |
| CRM | INTERNAL · no | yes | FUNERAL_OFFICE · BUSINESS | _(no route)_ | _(no page)_ | _(none)_ | — |
| INSURANCE | INTERNAL · no | yes | ENTERPRISE · BUSINESS | _(none — not built)_ | _(none)_ | _(none)_ | — |
| MEMBERSHIP | INTERNAL · no | yes | ENTERPRISE · BUSINESS | _(none — not built)_ | _(none)_ | _(none)_ | — |
| REPORTS | INTERNAL · no | yes | FUNERAL_OFFICE · BUSINESS | _(no route guard)_ | _(no /reports page; marketing analytics ungated by design)_ | _(none)_ | — |
| CASE_MANAGEMENT | INTERNAL · no | yes | FUNERAL_OFFICE · BUSINESS | _(no route)_ | _(no page)_ | _(none)_ | — |
| API | INTERNAL · no | yes | ENTERPRISE · ENTERPRISE | _(platform-only)_ | _(none)_ | _(none)_ | — |
| WHITE_LABEL | INTERNAL · no | yes | WHITE_LABEL · ENTERPRISE | _(BrandContext/layout — internal)_ | _(none)_ | _(none)_ | — |
| AI_ASSISTANT | INTERNAL · no | yes | ENTERPRISE · ENTERPRISE | _(no route)_ | _(no page)_ | _(none)_ | — |

\* VEHICLES / ASSETS / FUNERAL_RESOURCES are QA channel → only accessible when explicitly
opted-in (override or `releaseChannelOverride: BETA`), e.g. the seed beta-enables
VEHICLES + ASSETS for the first funeral home.

## Dependency graph (canonical — enforced by `seed-features.ts` + migration)

```
CASE_MANAGEMENT → MEMORIALS
FUNERAL_RESOURCES → VEHICLES
FUNERAL_RESOURCES → ASSETS
```

A feature is only `enabled` when **all** of its dependencies resolve enabled. This is
why the now-removed `FEEDBACK → FUNERAL_RESOURCES` edge was a bug: it chained a GA
feature behind a QA/internal (disabled-by-default) feature and silently blocked
FEEDBACK for every regular funeral home. The migration
`20260802120000_remove_incorrect_feature_dependencies` and the seed's defensive
prune keep the graph to the three canonical edges.

## Protection-coverage summary

- **Fully implemented & consistently guarded (backend + UI nav + UI route):**
  Brochures, Categories, Promotions, Vehicles, Assets, Funeral Resources.
- **Backend-guarded; UI gated where UI exists:** Feedback (admin API guarded on all 4
  endpoints; the family-facing public submission stays intentionally ungated; no admin
  review page exists yet, so there is no UI route to gate).
- **Entitlement-gated (not feature-flagged):** New Memorial / memorial publish —
  gated by the credit/entitlement layer (`PaymentPage`, trial + wallet), per design.
- **GA, always-on viewing features (no gate needed):** Photo Lightbox, GPS, Memorials.
- **Registered but not built** (no UI/backend surface — nothing to bypass):
  CRM, Reports, Insurance, Membership, Case Management, API, Whitelabel, AI Assistant,
  Live Stream. (These are INTERNAL/QA premium gates reserved for future modules.)
- **Placeholder / incomplete:** `Staff` is registered (GA, min PROFESSIONAL) but the
  staff-management UI is not built — the existing `/staff` route renders `ProfilePage`.

## Tests

- `src/__tests__/features.test.ts` — 17 engine tests: resolution chain, edition/plan/
  rollout gates, overrides, dependency gating, circular-dependency detection.
- `src/__tests__/features-api.test.ts` — 8 tests: feature CRUD/seed, overrides,
  dependency management, audit log, resolution endpoints.
- `src/__tests__/feature-route-guards.test.ts` — 9 tests (new): 403 when a home lacks
  BROCHURES/PROMOTIONS/FEEDBACK, 200 when granted, opt-in via override, and a regression
  asserting FEEDBACK no longer depends on FUNERAL_RESOURCES.

**Status: 53/53 API tests pass · 16/16 admin tests pass · `tsc --noEmit` clean (both apps).**
