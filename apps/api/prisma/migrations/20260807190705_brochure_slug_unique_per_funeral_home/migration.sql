-- Brochure slugs are now unique per funeral home instead of globally.
-- Data safety: the previous global UNIQUE index on "slug" guarantees that no
-- two rows share a slug, so every existing (funeralHomeId, slug) combination is
-- already unique. This migration therefore cannot fail on duplicate data.

-- DropIndex
DROP INDEX "Brochure_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "Brochure_funeralHomeId_slug_key" ON "Brochure"("funeralHomeId", "slug");
