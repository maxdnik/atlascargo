-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "estimatedTransitTimeDays" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "suggestedCarrier" TEXT;
ALTER TABLE "Quote" ADD COLUMN "suggestedSupplier" TEXT;
ALTER TABLE "Quote" ADD COLUMN "serviceLevelAssumption" TEXT;
ALTER TABLE "Quote" ADD COLUMN "routeAssumption" TEXT;
ALTER TABLE "Quote" ADD COLUMN "assumptionsNotes" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "quoteSnapshot" JSONB;
ALTER TABLE "Shipment" ADD COLUMN "quotedSellAmount" DECIMAL;
ALTER TABLE "Shipment" ADD COLUMN "quotedCostAmount" DECIMAL;
ALTER TABLE "Shipment" ADD COLUMN "quotedGrossProfit" DECIMAL;
ALTER TABLE "Shipment" ADD COLUMN "quotedMarginPercent" DECIMAL;
ALTER TABLE "Shipment" ADD COLUMN "quotedTransitTimeDays" INTEGER;
ALTER TABLE "Shipment" ADD COLUMN "quotedMode" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "quotedDirection" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "quotedOrigin" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "quotedDestination" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "quotedChargeBreakdown" JSONB;
ALTER TABLE "Shipment" ADD COLUMN "quotedSupplierSuggestions" JSONB;
ALTER TABLE "Shipment" ADD COLUMN "quotedAssumptionsNotes" TEXT;
