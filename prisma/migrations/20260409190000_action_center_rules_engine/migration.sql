-- CreateTable
CREATE TABLE "Alert" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "ruleKey" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'rules-engine',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "recommendedAction" TEXT,
  "shipmentId" TEXT,
  "customerId" TEXT,
  "metadata" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "resolvedAt" DATETIME,
  CONSTRAINT "Alert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Alert_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Alert_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Alert_companyId_ruleKey_key" ON "Alert"("companyId", "ruleKey");
CREATE INDEX "Alert_companyId_status_createdAt_idx" ON "Alert"("companyId", "status", "createdAt");
CREATE INDEX "Alert_companyId_severity_status_idx" ON "Alert"("companyId", "severity", "status");
CREATE INDEX "Alert_companyId_type_status_idx" ON "Alert"("companyId", "type", "status");
CREATE INDEX "Alert_shipmentId_status_idx" ON "Alert"("shipmentId", "status");
CREATE INDEX "Alert_customerId_status_idx" ON "Alert"("customerId", "status");

-- Normalize legacy document enum values to current schema
UPDATE "ShipmentDocument"
SET "docType" = 'HBL'
WHERE "docType" = 'BL';

UPDATE "ShipmentDocument"
SET "docType" = 'HAWB'
WHERE "docType" = 'AWB';
