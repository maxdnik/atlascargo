-- Replace legacy EXPIRED status with NEGOTIATION in SQLite enum check.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "quoteNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "mode" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'SENT', 'NEGOTIATION', 'APPROVED', 'REJECTED')),
    "incotermCode" TEXT,
    "originCode" TEXT,
    "destinationCode" TEXT,
    "pol" TEXT,
    "pod" TEXT,
    "airportOrigin" TEXT,
    "airportDestination" TEXT,
    "placeOfReceipt" TEXT,
    "placeOfDelivery" TEXT,
    "loadType" TEXT,
    "packageCount" INTEGER,
    "packageType" TEXT,
    "grossWeightKg" DECIMAL,
    "volumeM3" DECIMAL,
    "cargoReadyDate" DATETIME,
    "serviceScope" TEXT,
    "customerReference" TEXT,
    "insuranceRequired" BOOLEAN NOT NULL DEFAULT false,
    "customsClearanceScope" TEXT NOT NULL DEFAULT 'NONE',
    "equipmentType" TEXT,
    "commodity" TEXT,
    "validUntil" DATETIME,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL,
    "totalBuy" DECIMAL NOT NULL DEFAULT 0,
    "totalSell" DECIMAL NOT NULL DEFAULT 0,
    "marginAmount" DECIMAL NOT NULL DEFAULT 0,
    "marginPct" DECIMAL NOT NULL DEFAULT 0,
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
    CONSTRAINT "Quote_incotermCode_fkey" FOREIGN KEY ("incotermCode") REFERENCES "Incoterm" ("code") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Quote" (
  "id", "companyId", "branchId", "quoteNumber", "customerId", "ownerUserId", "mode", "direction", "status",
  "incotermCode", "originCode", "destinationCode", "pol", "pod", "airportOrigin", "airportDestination",
  "placeOfReceipt", "placeOfDelivery", "loadType", "packageCount", "packageType", "grossWeightKg", "volumeM3",
  "cargoReadyDate", "serviceScope", "customerReference", "insuranceRequired", "customsClearanceScope",
  "equipmentType", "commodity", "validUntil", "currencyCode", "exchangeRate", "totalBuy", "totalSell",
  "marginAmount", "marginPct", "internalNotes", "sentAt", "approvedAt", "rejectedAt", "createdAt", "updatedAt"
)
SELECT
  "id", "companyId", "branchId", "quoteNumber", "customerId", "ownerUserId", "mode", "direction",
  CASE WHEN "status" = 'EXPIRED' THEN 'REJECTED' ELSE "status" END,
  "incotermCode", "originCode", "destinationCode", "pol", "pod", "airportOrigin", "airportDestination",
  "placeOfReceipt", "placeOfDelivery", "loadType", "packageCount", "packageType", "grossWeightKg", "volumeM3",
  "cargoReadyDate", "serviceScope", "customerReference", "insuranceRequired", "customsClearanceScope",
  "equipmentType", "commodity", "validUntil", "currencyCode", "exchangeRate", "totalBuy", "totalSell",
  "marginAmount", "marginPct", "internalNotes", "sentAt", "approvedAt", "rejectedAt", "createdAt", "updatedAt"
FROM "Quote";

DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";

CREATE UNIQUE INDEX "Quote_companyId_quoteNumber_key" ON "Quote"("companyId", "quoteNumber");
CREATE INDEX "Quote_companyId_status_createdAt_idx" ON "Quote"("companyId", "status", "createdAt");
CREATE INDEX "Quote_companyId_customerId_idx" ON "Quote"("companyId", "customerId");

PRAGMA foreign_keys=ON;
