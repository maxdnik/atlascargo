-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "notes" TEXT;

-- CreateTable
CREATE TABLE "GeneralExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "conceptCategory" TEXT NOT NULL,
    "customConcept" TEXT,
    "amount" DECIMAL NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GeneralExpense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneralExpense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GeneralExpense_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GeneralExpense_companyId_conceptCategory_status_idx" ON "GeneralExpense"("companyId", "conceptCategory", "status");

-- CreateIndex
CREATE INDEX "GeneralExpense_companyId_dueDate_idx" ON "GeneralExpense"("companyId", "dueDate");
