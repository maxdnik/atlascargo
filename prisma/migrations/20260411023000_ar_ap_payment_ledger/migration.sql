-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Payment" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "entityType" TEXT;
ALTER TABLE "Payment" ADD COLUMN "generalExpenseId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "shipmentCostId" TEXT;

-- Backfill entityType/entityId for existing rows
UPDATE "Payment"
SET "entityType" = 'INVOICE',
    "entityId" = "invoiceId"
WHERE "invoiceId" IS NOT NULL;

UPDATE "Payment"
SET "entityType" = 'EXPENSE',
    "entityId" = "expenseId"
WHERE "entityType" IS NULL
  AND "expenseId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Payment_companyId_entityType_entityId_paymentDate_idx"
ON "Payment"("companyId", "entityType", "entityId", "paymentDate");

CREATE INDEX "Payment_shipmentCostId_idx" ON "Payment"("shipmentCostId");

CREATE INDEX "Payment_generalExpenseId_idx" ON "Payment"("generalExpenseId");
