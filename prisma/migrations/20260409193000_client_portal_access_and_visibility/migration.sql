ALTER TABLE "User" ADD COLUMN "isPortalUser" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CustomerPortalAccess" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CustomerPortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerPortalAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerPortalAccess_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomerPortalAccess_userId_customerId_key" ON "CustomerPortalAccess"("userId", "customerId");
CREATE INDEX "CustomerPortalAccess_companyId_customerId_isActive_idx" ON "CustomerPortalAccess"("companyId", "customerId", "isActive");
CREATE INDEX "CustomerPortalAccess_userId_isActive_idx" ON "CustomerPortalAccess"("userId", "isActive");
CREATE INDEX "User_companyId_isPortalUser_isActive_idx" ON "User"("companyId", "isPortalUser", "isActive");

ALTER TABLE "ShipmentDocument" ADD COLUMN "isClientVisible" BOOLEAN NOT NULL DEFAULT false;
