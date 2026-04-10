/*
  Warnings:

  - Added the required column `fileUrl` to the `ShipmentDocument` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShipmentDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
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
INSERT INTO "new_ShipmentDocument" ("createdAt", "docType", "fileName", "fileUrl", "id", "issueDate", "notes", "referenceNumber", "shipmentId", "status", "updatedAt", "uploadedAt", "uploadedById", "version") SELECT "createdAt", CASE "docType" WHEN 'HBL' THEN 'BL' WHEN 'MBL' THEN 'BL' WHEN 'HAWB' THEN 'AWB' WHEN 'MAWB' THEN 'AWB' WHEN 'CERTIFICATE' THEN 'CUSTOMS_DOC' WHEN 'PERMIT' THEN 'CUSTOMS_DOC' WHEN 'POD' THEN 'OTHER' ELSE "docType" END AS "docType", "fileName", '/uploads/legacy/' || "fileName" AS "fileUrl", "id", "issueDate", "notes", "referenceNumber", "shipmentId", "status", "updatedAt", "uploadedAt", "uploadedById", "version" FROM "ShipmentDocument";
DROP TABLE "ShipmentDocument";
ALTER TABLE "new_ShipmentDocument" RENAME TO "ShipmentDocument";
CREATE INDEX "ShipmentDocument_shipmentId_docType_status_idx" ON "ShipmentDocument"("shipmentId", "docType", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
