-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN "actorType" TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE "ActivityLog" ADD COLUMN "actorName" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "shipmentId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "customerId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "field" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "oldValue" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "newValue" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "summary" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "metadata" JSONB;

-- CreateIndex
CREATE INDEX "ActivityLog_companyId_entityType_entityId_createdAt_idx" ON "ActivityLog"("companyId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_companyId_shipmentId_createdAt_idx" ON "ActivityLog"("companyId", "shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_companyId_customerId_createdAt_idx" ON "ActivityLog"("companyId", "customerId", "createdAt");
