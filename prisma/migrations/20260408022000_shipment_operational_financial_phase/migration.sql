-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ShipmentDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "issueDate" DATETIME,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShipmentDocument_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShipmentDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_ShipmentDocument" (
    "id",
    "shipmentId",
    "docType",
    "fileName",
    "referenceNumber",
    "issueDate",
    "uploadedById",
    "uploadedAt",
    "version",
    "status",
    "notes",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "shipmentId",
    "docType",
    COALESCE(NULLIF("fileName", ''), COALESCE(NULLIF("title", ''), 'Document')),
    NULL,
    NULL,
    "uploadedById",
    "uploadedAt",
    "version",
    CASE
        WHEN "status" IN ('RECEIVED', 'VERIFIED', 'PENDING') THEN "status"
        ELSE 'PENDING'
    END,
    "comments",
    "createdAt",
    "updatedAt"
FROM "ShipmentDocument";

DROP TABLE "ShipmentDocument";
ALTER TABLE "new_ShipmentDocument" RENAME TO "ShipmentDocument";
CREATE INDEX "ShipmentDocument_shipmentId_docType_status_idx" ON "ShipmentDocument"("shipmentId", "docType", "status");

CREATE TABLE "new_Revenue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "shipmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL,
    "amountBase" DECIMAL NOT NULL DEFAULT 0,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Revenue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Revenue_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Revenue_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Revenue_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Revenue_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Revenue" (
    "id",
    "companyId",
    "branchId",
    "shipmentId",
    "customerId",
    "concept",
    "amount",
    "currencyCode",
    "exchangeRate",
    "amountBase",
    "dueDate",
    "status",
    "notes",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "companyId",
    "branchId",
    "shipmentId",
    "customerId",
    "concept",
    "amount",
    "currencyCode",
    "fxRate",
    COALESCE("amountBase", 0),
    "dueDate",
    CASE
        WHEN "status" = 'PAID' THEN 'PAID'
        WHEN "status" IN ('POSTED', 'PARTIALLY_PAID') THEN 'INVOICED'
        ELSE 'PENDING'
    END,
    NULL,
    "createdAt",
    "updatedAt"
FROM "Revenue";

DROP TABLE "Revenue";
ALTER TABLE "new_Revenue" RENAME TO "Revenue";
CREATE INDEX "Revenue_companyId_dueDate_status_idx" ON "Revenue"("companyId", "dueDate", "status");
CREATE INDEX "Revenue_customerId_status_idx" ON "Revenue"("customerId", "status");

CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "shipmentId" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL,
    "amountBase" DECIMAL NOT NULL DEFAULT 0,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "BusinessPartner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Expense" (
    "id",
    "companyId",
    "branchId",
    "shipmentId",
    "supplierId",
    "supplierName",
    "concept",
    "amount",
    "currencyCode",
    "exchangeRate",
    "amountBase",
    "dueDate",
    "status",
    "notes",
    "createdAt",
    "updatedAt"
)
SELECT
    e."id",
    e."companyId",
    e."branchId",
    e."shipmentId",
    e."supplierId",
    COALESCE(bp."name", 'Unknown Supplier'),
    e."concept",
    e."amount",
    e."currencyCode",
    e."fxRate",
    COALESCE(e."amountBase", 0),
    e."dueDate",
    CASE
        WHEN e."status" = 'PAID' THEN 'PAID'
        WHEN e."status" IN ('POSTED', 'PARTIALLY_PAID') THEN 'INVOICED'
        ELSE 'PENDING'
    END,
    NULL,
    e."createdAt",
    e."updatedAt"
FROM "Expense" e
LEFT JOIN "BusinessPartner" bp ON bp."id" = e."supplierId";

DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_companyId_dueDate_status_idx" ON "Expense"("companyId", "dueDate", "status");
CREATE INDEX "Expense_supplierId_status_idx" ON "Expense"("supplierId", "status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
