-- ## Migration: remove incorrect feature dependency records
--
-- The feature registry (scripts/seed-features.ts) defines exactly three
-- `FeatureDependency` rows as the canonical dependency graph:
--
--   CASE_MANAGEMENT  -> MEMORIALS
--   FUNERAL_RESOURCES -> VEHICLES
--   FUNERAL_RESOURCES -> ASSETS
--
-- A number of *additional* dependency edges were written to the database by hand
-- during a prior development session. These are not part of the seed and are
-- incorrect. In particular:
--
--   FEEDBACK          -> FUNERAL_RESOURCES   (FUNERAL_RESOURCES is a QA channel,
--                                            globally-disabled feature)
--   FEEDBACK          -> MEMORIALS
--   PHOTO_LIGHTBOX    -> MEMORIALS
--   PHOTO_LIGHTBOX    -> FUNERAL_RESOURCES
--   GPS               -> MEMORIALS
--   GPS               -> API
--   GPS               -> FUNERAL_RESOURCES
--   ASSETS            -> STAFF
--   ASSETS            -> CASE_MANAGEMENT
--
-- Because FEEDBACK, PHOTO_LIGHTBOX and GPS are all GA / globally-enabled
-- features, requiring them to depend (transitively) on the disabled
-- FUNERAL_RESOURCES / API / CASE_MANAGEMENT features caused those features to
-- resolve as unavailable for every regular funeral home — defeating the
-- purpose of the feature flag system.
--
-- This migration deletes every `FeatureDependency` row that is NOT one of the
-- three canonical edges. The `DELETE ... WHERE NOT IN (...)` predicate is
-- idempotent: running it on an already-clean database is a no-op, which makes
-- it safe to re-run on any environment.
--
-- After this migration the dependency graph matches the seed exactly.

DELETE FROM "FeatureDependency"
WHERE ("featureKey", "dependsOnFeature") NOT IN (
  ('CASE_MANAGEMENT', 'MEMORIALS'),
  ('FUNERAL_RESOURCES', 'VEHICLES'),
  ('FUNERAL_RESOURCES', 'ASSETS')
);
