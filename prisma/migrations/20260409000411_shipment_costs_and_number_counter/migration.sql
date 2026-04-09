-- CreateTable
CREATE TABLE "ShipmentNumberCounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShipmentNumberCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShipmentCost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "shipmentId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "conceptCategory" TEXT NOT NULL,
    "customConcept" TEXT,
    "amount" DECIMAL NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShipmentCost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShipmentCost_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShipmentCost_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShipmentCost_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShipmentNumberCounter_companyId_prefix_nextValue_idx" ON "ShipmentNumberCounter"("companyId", "prefix", "nextValue");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentNumberCounter_companyId_prefix_key" ON "ShipmentNumberCounter"("companyId", "prefix");

-- CreateIndex
CREATE INDEX "ShipmentCost_companyId_shipmentId_status_idx" ON "ShipmentCost"("companyId", "shipmentId", "status");

-- CreateIndex
CREATE INDEX "ShipmentCost_companyId_dueDate_idx" ON "ShipmentCost"("companyId", "dueDate");

-- CreateIndex
CREATE INDEX "ShipmentCost_companyId_conceptCategory_idx" ON "ShipmentCost"("companyId", "conceptCategory");

-- CreateIndex
CREATE INDEX "Shipment_shipmentNumber_idx" ON "Shipment"("shipmentNumber");
