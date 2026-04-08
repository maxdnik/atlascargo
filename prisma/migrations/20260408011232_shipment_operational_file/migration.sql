-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "agentDestinationName" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "agentOriginName" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "airportDestination" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "airportOrigin" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "cargoReadyDate" DATETIME;
ALTER TABLE "Shipment" ADD COLUMN "carrierName" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "chargeableWeightKg" DECIMAL;
ALTER TABLE "Shipment" ADD COLUMN "consigneeName" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "containerCount" INTEGER;
ALTER TABLE "Shipment" ADD COLUMN "containerType" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "deliveredAt" DATETIME;
ALTER TABLE "Shipment" ADD COLUMN "destinationCode" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "notifyPartyName" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "originCode" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "packageType" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "placeOfDelivery" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "placeOfReceipt" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "pod" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "pol" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "shipperName" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "vesselOrFlight" TEXT;

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
    "mode" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "incotermCode" TEXT,
    "originCode" TEXT,
    "destinationCode" TEXT,
    "pol" TEXT,
    "pod" TEXT,
    "airportOrigin" TEXT,
    "airportDestination" TEXT,
    "placeOfReceipt" TEXT,
    "placeOfDelivery" TEXT,
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
INSERT INTO "new_Quote" ("approvedAt", "branchId", "companyId", "createdAt", "currencyCode", "customerId", "direction", "exchangeRate", "id", "internalNotes", "marginAmount", "marginPct", "mode", "ownerUserId", "quoteNumber", "rejectedAt", "sentAt", "status", "totalBuy", "totalSell", "updatedAt", "validUntil") SELECT "approvedAt", "branchId", "companyId", "createdAt", "currencyCode", "customerId", "direction", "exchangeRate", "id", "internalNotes", "marginAmount", "marginPct", "mode", "ownerUserId", "quoteNumber", "rejectedAt", "sentAt", "status", "totalBuy", "totalSell", "updatedAt", "validUntil" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
CREATE INDEX "Quote_companyId_status_createdAt_idx" ON "Quote"("companyId", "status", "createdAt");
CREATE INDEX "Quote_companyId_customerId_idx" ON "Quote"("companyId", "customerId");
CREATE UNIQUE INDEX "Quote_companyId_quoteNumber_key" ON "Quote"("companyId", "quoteNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
