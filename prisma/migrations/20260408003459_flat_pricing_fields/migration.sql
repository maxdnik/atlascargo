/*
  Warnings:

  - You are about to drop the column `marginAmount` on the `Quote` table. All the data in the column will be lost.
  - You are about to drop the column `marginPct` on the `Quote` table. All the data in the column will be lost.
  - You are about to drop the column `totalBuy` on the `Quote` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "quoteNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "approvedByUserId" TEXT,
    "mode" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "origin" TEXT,
    "destination" TEXT,
    "incotermCode" TEXT,
    "commodity" TEXT,
    "validUntil" DATETIME,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL,
    "freightSell" DECIMAL NOT NULL DEFAULT 0,
    "originChargesSell" DECIMAL NOT NULL DEFAULT 0,
    "destinationChargesSell" DECIMAL NOT NULL DEFAULT 0,
    "additionalChargesSell" DECIMAL NOT NULL DEFAULT 0,
    "totalSell" DECIMAL NOT NULL DEFAULT 0,
    "freightCost" DECIMAL NOT NULL DEFAULT 0,
    "originChargesCost" DECIMAL NOT NULL DEFAULT 0,
    "destinationChargesCost" DECIMAL NOT NULL DEFAULT 0,
    "additionalChargesCost" DECIMAL NOT NULL DEFAULT 0,
    "totalCost" DECIMAL NOT NULL DEFAULT 0,
    "grossMarginAmount" DECIMAL NOT NULL DEFAULT 0,
    "grossMarginPercent" DECIMAL NOT NULL DEFAULT 0,
    "internalNotes" TEXT,
    "sentAt" DATETIME,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quote_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quote_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Quote" ("approvedAt", "branchId", "companyId", "createdAt", "currencyCode", "customerId", "destination", "direction", "exchangeRate", "id", "incotermCode", "internalNotes", "mode", "origin", "ownerUserId", "quoteNumber", "rejectedAt", "sentAt", "status", "totalSell", "updatedAt", "validUntil") SELECT "approvedAt", "branchId", "companyId", "createdAt", "currencyCode", "customerId", "destination", "direction", "exchangeRate", "id", "incotermCode", "internalNotes", "mode", "origin", "ownerUserId", "quoteNumber", "rejectedAt", "sentAt", "status", "totalSell", "updatedAt", "validUntil" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
CREATE INDEX "Quote_companyId_status_createdAt_idx" ON "Quote"("companyId", "status", "createdAt");
CREATE INDEX "Quote_companyId_customerId_idx" ON "Quote"("companyId", "customerId");
CREATE UNIQUE INDEX "Quote_companyId_quoteNumber_key" ON "Quote"("companyId", "quoteNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
