-- CreateTable
CREATE TABLE "MemorialPerformance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memorialId" TEXT NOT NULL,
    "day1Views" INTEGER NOT NULL DEFAULT 0,
    "day2Views" INTEGER NOT NULL DEFAULT 0,
    "day3Views" INTEGER NOT NULL DEFAULT 0,
    "day1UniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "day2UniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "day3UniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "day1QrScans" INTEGER NOT NULL DEFAULT 0,
    "day2QrScans" INTEGER NOT NULL DEFAULT 0,
    "day3QrScans" INTEGER NOT NULL DEFAULT 0,
    "day1Shares" INTEGER NOT NULL DEFAULT 0,
    "day2Shares" INTEGER NOT NULL DEFAULT 0,
    "day3Shares" INTEGER NOT NULL DEFAULT 0,
    "total72HourViews" INTEGER NOT NULL DEFAULT 0,
    "performanceRating" TEXT,
    "highestDailyViews" INTEGER NOT NULL DEFAULT 0,
    "highestMilestoneAwarded" TEXT,
    "milestones" JSONB,
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemorialPerformance_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Brochure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "funeralHomeId" TEXT NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "description" TEXT,
    "pdfUrl" TEXT,
    "includedItems" JSONB,
    "price" TEXT,
    "depositRequired" BOOLEAN NOT NULL DEFAULT false,
    "monthlyPaymentAvailable" BOOLEAN NOT NULL DEFAULT false,
    "financeAvailable" BOOLEAN NOT NULL DEFAULT false,
    "ctaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ctaType" TEXT,
    "ctaText" TEXT DEFAULT 'Enquire Now',
    "ctaUrl" TEXT,
    "whatsappNumber" TEXT,
    "phoneNumber" TEXT,
    "emailAddress" TEXT,
    "contactPerson" TEXT,
    "branchName" TEXT,
    "websiteUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "shortUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Brochure_funeralHomeId_fkey" FOREIGN KEY ("funeralHomeId") REFERENCES "FuneralHome" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Brochure_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BrochureCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Brochure" ("categoryId", "coverImageUrl", "createdAt", "ctaEnabled", "ctaText", "ctaUrl", "description", "displayOrder", "emailAddress", "featured", "funeralHomeId", "id", "pdfUrl", "phoneNumber", "published", "seoDescription", "seoTitle", "shortUrl", "slug", "title", "updatedAt", "viewCount", "whatsappNumber") SELECT "categoryId", "coverImageUrl", "createdAt", "ctaEnabled", "ctaText", "ctaUrl", "description", "displayOrder", "emailAddress", "featured", "funeralHomeId", "id", "pdfUrl", "phoneNumber", "published", "seoDescription", "seoTitle", "shortUrl", "slug", "title", "updatedAt", "viewCount", "whatsappNumber" FROM "Brochure";
DROP TABLE "Brochure";
ALTER TABLE "new_Brochure" RENAME TO "Brochure";
CREATE UNIQUE INDEX "Brochure_slug_key" ON "Brochure"("slug");
CREATE INDEX "Brochure_funeralHomeId_idx" ON "Brochure"("funeralHomeId");
CREATE INDEX "Brochure_categoryId_idx" ON "Brochure"("categoryId");
CREATE INDEX "Brochure_published_displayOrder_idx" ON "Brochure"("published", "displayOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MemorialPerformance_memorialId_key" ON "MemorialPerformance"("memorialId");

-- CreateIndex
CREATE INDEX "MemorialPerformance_memorialId_idx" ON "MemorialPerformance"("memorialId");
