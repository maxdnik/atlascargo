-- CreateTable
CREATE TABLE "DocumentParsingResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentDocumentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "parsedJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentParsingResult_shipmentDocumentId_fkey" FOREIGN KEY ("shipmentDocumentId") REFERENCES "ShipmentDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DocumentParsingResult_shipmentDocumentId_createdAt_idx" ON "DocumentParsingResult"("shipmentDocumentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentParsingResult_status_createdAt_idx" ON "DocumentParsingResult"("status", "createdAt");
