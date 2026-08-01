# Feature Management Guide

## Goal

Control which funeral homes and users can use each Memory Connect feature, and when it is released.

**Estimated time:** 15 minutes  
**Requirements:** A SUPER_ADMIN account.

![Feature Management](images/feature-management.png)

> **Warning:** Only SUPER_ADMIN users may open `/admin-owner/features`. Funeral home and family accounts are blocked.

## How Features Are Decided

Every capability in Memory Connect is a **feature** in the registry. Each feature has a release channel, a rollout percentage, and optional subscription requirements. When a funeral home user signs in, the server evaluates their role, funeral home, and account and returns the list of features they are allowed to use. The admin menu automatically hides features that are not available.

The evaluation order is:

1. Release channel and role.
2. Funeral home or user override.
3. Global release flag.
4. Minimum edition (MEMORIAL, FUNERAL_OFFICE, ENTERPRISE, WHITE_LABEL).
5. Minimum subscription plan (STARTER, PROFESSIONAL, BUSINESS, ENTERPRISE).
6. Rollout percentage.
7. Feature dependencies.

## Feature Dependencies

Some features build on others. For example, `CASE_MANAGEMENT` depends on `MEMORIALS`, and `FUNERAL_RESOURCES` depends on both `VEHICLES` and `ASSETS`. A child feature is **not** available until every dependency resolves enabled — even if the child is force-enabled by an override. Dependencies never override the deny rules; they are the final gate before a feature is granted.

- Add a dependency by selecting the feature and choosing a feature it requires in the **Dependencies** tab.
- Remove a dependency with the **Remove** button next to it.
- A feature can have many dependencies, and many features can require the same feature.
- The dashboard shows each feature's requirements (`Requires`) and the **Dependencies** tab shows how many requirements each feature has.
- Cycles are rejected: the API returns a conflict if adding a dependency would create a loop, and the resolution engine falls back to HIDDEN with a `Circular feature dependency` reason if one is ever found.
- Every dependency change is recorded in the audit log (`ADD_DEPENDENCY` / `REMOVE_DEPENDENCY`).

## Feature Dashboard

The **Feature Dashboard** tab lists every registered feature with its channel, global state, edition and plan requirements, premium flag, override count, and last update.

- `MEMORIALS`, `PHOTO_LIGHTBOX`, `GPS`, and `FEEDBACK` are generally available to everyone.
- `PROMOTIONS` and `BROCHURES` require at least the FUNERAL_OFFICE edition and PROFESSIONAL plan.
- `VEHICLES`, `ASSETS`, and `FUNERAL_RESOURCES` start on the QA channel and are hidden until released or enabled for a specific home.
- Future modules (CASE_MANAGEMENT, CRM, INSURANCE, MEMBERSHIP, REPORTS, API, WHITE_LABEL, AI_ASSISTANT) are registered but internal-only.

## Seeding the Registry

On first use, select **Seed registry**. This creates all built-in features at once. Running it again never duplicates features.

## Release Channels

Each feature moves through channels that control who can see it:

| Channel | Who can use it |
|---|---|
| INTERNAL | SUPER_ADMIN and internal testers only |
| QA | SUPER_ADMIN and internal testers, plus homes that opted in |
| BETA | Homes or users that opted in with an override |
| EARLY_ACCESS | Homes or users that opted in with an override |
| GENERAL_AVAILABILITY | Everyone who meets edition, plan, and rollout rules |
| DEPRECATED | Still available but flagged for removal |
| DISABLED | No one |

## Rollout Control

The **Rollout Control** tab sets the percentage of funeral homes that receive a feature:

1. Open **Rollout Control**.
2. Select the feature.
3. Choose the percentage: 0, 5, 10, 25, 50, 75, or 100.

Sampling is deterministic per feature and funeral home, so the same home is always in or out until the percentage changes.

> **Tip:** Start new features at 0 or 5 percent, watch for issues, then increase gradually.

## Feature Tester

The **Feature Tester** tab previews the resolved feature set as if the signed-in SUPER_ADMIN were acting for any funeral home. Use it to confirm that edition, plan, and rollout rules are working before contacting a customer.

Each preview shows the final state (ENABLED, COMING_SOON, or HIDDEN) and the reason.

## Funeral Home Overrides

Use **Funeral Home Overrides** to force a feature on or off for one funeral home:

1. Select a funeral home on the left.
2. Find the feature.
3. Select **Enable for home** to grant it (this is how a QA or BETA feature is opened for a customer).
4. Select **Override active** to remove the override and return to normal rules.

An enabled override grants the feature even if the global release flag or rollout has not started. A removed override returns the home to the standard evaluation.

## User Overrides

The platform API also supports per-user overrides with an optional expiry date. User overrides are evaluated after funeral home overrides and are typically used to give a single staff member early access for testing.

## Audit Log

The **Audit Log** tab records every change to the feature registry, including the actor, action (CREATE, UPDATE, ENABLE, DISABLE, DELETE, REMOVE_OVERRIDE, ADD_DEPENDENCY, REMOVE_DEPENDENCY), feature, target, and time. All feature decisions you make are visible to other platform owners.

## Common Mistakes

- Using a funeral home account instead of SUPER_ADMIN.
- Setting rollout to 100 percent before QA is complete.
- Removing an override and expecting the feature to remain enabled.
- Expecting an INTERNAL feature to appear for a funeral home account.
