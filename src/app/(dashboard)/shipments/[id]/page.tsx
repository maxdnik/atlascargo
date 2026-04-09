import { notFound } from "next/navigation";
import { PermissionAction, PermissionResource } from "@prisma/client";

import { getShipmentById } from "@/lib/shipments";
import { listCustomers } from "@/lib/customers";
import {
  createInvoiceDirectAction,
  issueInvoiceAFIPDirectAction,
  markInvoicePaidDirectAction,
  cancelInvoiceDirectAction,
  deleteInvoiceDirectAction,
  deleteExpenseDirectAction,
  deleteRevenueDirectAction,
  deleteShipmentCostDirectAction,
  deleteShipmentDocumentDirectAction,
  replaceShipmentDocumentDirectAction,
  uploadShipmentDocumentDirectAction,
  updateShipmentAction,
  upsertExpenseDirectAction,
  upsertInvoiceDirectAction,
  upsertRevenueDirectAction,
  upsertShipmentCostDirectAction,
} from "@/app/(dashboard)/shipments/actions";
import { canUser, enforcePagePermission } from "@/lib/permissions";
import { ShipmentDetailClient } from "@/components/shipments/shipment-detail-client";
import { InvoiceLineType, InvoiceStatus } from "@prisma/client";

type ShipmentEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ShipmentEditPage({ params }: ShipmentEditPageProps) {
  const session = await enforcePagePermission(PermissionResource.SHIPMENTS, PermissionAction.VIEW);
  const canEditShipments = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.SHIPMENTS,
    PermissionAction.EDIT,
  );
  const canEditDocuments = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.DOCUMENTS,
    PermissionAction.EDIT,
  );
  const canCreateDocuments = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.DOCUMENTS,
    PermissionAction.CREATE,
  );
  const canDeleteDocuments = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.DOCUMENTS,
    PermissionAction.DELETE,
  );
  const canViewDocuments = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.DOCUMENTS,
    PermissionAction.VIEW,
  );
  const canViewRevenue = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.REVENUE,
    PermissionAction.VIEW,
  );
  const canEditRevenue = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.REVENUE,
    PermissionAction.EDIT,
  );
  const canCreateRevenue = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.REVENUE,
    PermissionAction.CREATE,
  );
  const canDeleteRevenue = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.REVENUE,
    PermissionAction.DELETE,
  );
  const canViewExpenses = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.EXPENSES,
    PermissionAction.VIEW,
  );
  const canEditExpenses = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.EXPENSES,
    PermissionAction.EDIT,
  );
  const canCreateExpenses = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.EXPENSES,
    PermissionAction.CREATE,
  );
  const canDeleteExpenses = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.EXPENSES,
    PermissionAction.DELETE,
  );
  const canCreateShipmentCosts = canCreateExpenses;
  const canEditShipmentCosts = canEditExpenses;
  const canDeleteShipmentCosts = canDeleteExpenses;
  const canViewFinancialSummary =
    (await canUser(
      { id: session.userId, role: session.role, companyId: session.companyId },
      PermissionResource.REVENUE,
      PermissionAction.VIEW_FINANCIALS,
    )) ||
    (await canUser(
      { id: session.userId, role: session.role, companyId: session.companyId },
      PermissionResource.EXPENSES,
      PermissionAction.VIEW_FINANCIALS,
    ));
  const canCreateInvoices = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.REVENUE,
    PermissionAction.CREATE,
  );
  const canEditInvoices = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.REVENUE,
    PermissionAction.EDIT,
  );
  const canDeleteInvoices = await canUser(
    { id: session.userId, role: session.role, companyId: session.companyId },
    PermissionResource.REVENUE,
    PermissionAction.DELETE,
  );

  const { id } = await params;
  const shipment = await getShipmentById(session.companyId, id);
  const customers = await listCustomers(session.companyId);
  if (!shipment) {
    notFound();
  }

  const invoicedRevenue = shipment.invoices.reduce((sum, row) => sum + Number(row.total), 0);
  const totalShipmentCost = shipment.shipmentCosts.reduce((sum, row) => sum + Number(row.amount), 0);
  const grossProfit = invoicedRevenue - totalShipmentCost;
  const marginPct = invoicedRevenue > 0 ? (grossProfit / invoicedRevenue) * 100 : null;
  const quotedSell = shipment.quote ? Number(shipment.quote.totalSell) : null;
  const quotedCost = shipment.quote ? Number(shipment.quote.totalBuy) : null;
  const quotedMarginAmount = shipment.quote ? Number(shipment.quote.marginAmount) : null;
  const quotedMarginPct = shipment.quote ? Number(shipment.quote.marginPct) * 100 : null;
  const hasRevenue = shipment.invoices.length > 0 && invoicedRevenue > 0;
  const hasCosts = shipment.shipmentCosts.length > 0 && totalShipmentCost > 0;
  const hasFinancials = hasRevenue && hasCosts;
  const quotedMarginPctValue = quotedMarginPct ?? null;
  const varianceMarginPct = hasFinancials && quotedMarginPctValue !== null ? marginPct! - quotedMarginPctValue : null;
  const marginDeteriorated = hasFinancials && quotedMarginPctValue !== null ? marginPct! < quotedMarginPctValue : false;

  return (
    <ShipmentDetailClient
      shipment={{
        id: shipment.id,
        customerId: shipment.customerId,
        quoteId: shipment.quoteId,
        incotermCode: shipment.incotermCode,
        serviceLevel: shipment.serviceLevel,
        commodity: shipment.commodity,
        cargoReadyDate: shipment.cargoReadyDate?.toISOString() ?? null,
        referenceClient: shipment.referenceClient,
        referenceInternal: shipment.referenceInternal,
        shipmentNumber: shipment.shipmentNumber,
        status: shipment.status,
        mode: shipment.mode,
        direction: shipment.direction,
        customerName: shipment.customer.legalName,
        quoteNumber: shipment.quote?.quoteNumber ?? null,
        quoteStatus: shipment.quote?.status ?? null,
        originCode: shipment.originCode,
        destinationCode: shipment.destinationCode,
        etd: shipment.etd?.toISOString() ?? null,
        eta: shipment.eta?.toISOString() ?? null,
        atd: shipment.atd?.toISOString() ?? null,
        ata: shipment.ata?.toISOString() ?? null,
        deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
        pol: shipment.pol,
        pod: shipment.pod,
        airportOrigin: shipment.airportOrigin,
        airportDestination: shipment.airportDestination,
        placeOfReceipt: shipment.placeOfReceipt,
        placeOfDelivery: shipment.placeOfDelivery,
        shipperName: shipment.shipperName,
        consigneeName: shipment.consigneeName,
        notifyPartyName: shipment.notifyPartyName,
        agentOriginName: shipment.agentOriginName,
        agentDestinationName: shipment.agentDestinationName,
        carrierName: shipment.carrierName,
        vesselOrFlight: shipment.vesselOrFlight,
        bookingRef: shipment.bookingRef,
        houseRef: shipment.houseRef,
        masterRef: shipment.masterRef,
        packageCount: shipment.packageCount,
        packageType: shipment.packageType,
        grossWeightKg: shipment.grossWeightKg?.toString() ?? null,
        chargeableWeightKg: shipment.chargeableWeightKg?.toString() ?? null,
        volumeM3: shipment.volumeM3?.toString() ?? null,
        containerCount: shipment.containerCount,
        containerType: shipment.containerType,
        notes: shipment.notes,
        quoteFinancials: {
          hasQuote: Boolean(shipment.quote),
          quotedSell,
          quotedCost,
          quotedMarginAmount,
          quotedMarginPct,
        },
        actualFinancials: {
          invoicedRevenue,
          totalShipmentCost,
          grossProfit,
          marginPct,
          varianceMarginPct,
          hasRevenue,
          hasCosts,
          hasFinancials,
          marginDeteriorated,
        },
        milestones: shipment.milestones.map((milestone) => ({
          id: milestone.id,
          code: milestone.code,
          label: milestone.label,
          status: milestone.status,
          expectedAt: milestone.expectedAt?.toISOString() ?? null,
          actualAt: milestone.actualAt?.toISOString() ?? null,
          comment: milestone.comment,
        })),
        documents: shipment.documents.map((doc) => ({
          id: doc.id,
          docType: doc.docType,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          uploadedAt: doc.uploadedAt.toISOString(),
          referenceNumber: doc.referenceNumber,
          issueDate: doc.issueDate?.toISOString() ?? null,
          version: doc.version,
          status: doc.status,
          notes: doc.notes,
        })),
        revenues: shipment.revenues.map((row) => ({
          id: row.id,
          concept: row.concept,
          amount: Number(row.amount),
          currencyCode: row.currencyCode,
          exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
          amountBase: Number(row.amountBase),
          dueDate: row.dueDate?.toISOString() ?? null,
          status: row.status,
          notes: row.notes,
        })),
        expenses: shipment.expenses.map((row) => ({
          id: row.id,
          supplierName: row.supplierName,
          concept: row.concept,
          amount: Number(row.amount),
          currencyCode: row.currencyCode,
          exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
          amountBase: Number(row.amountBase),
          dueDate: row.dueDate?.toISOString() ?? null,
          status: row.status,
          notes: row.notes,
        })),
        shipmentCosts: shipment.shipmentCosts.map((row) => ({
          id: row.id,
          supplierName: row.supplierName,
          conceptCategory: row.conceptCategory,
          customConcept: row.customConcept,
          amount: Number(row.amount),
          currencyCode: row.currencyCode,
          dueDate: row.dueDate?.toISOString() ?? null,
          status: row.status,
          notes: row.notes,
        })),
        invoices: shipment.invoices.map((row) => ({
          id: row.id,
          invoiceNumber: row.invoiceNumber,
          status: row.status as InvoiceStatus,
          currencyCode: row.currencyCode,
          subtotal: Number(row.subtotal),
          taxes: Number(row.taxes),
          total: Number(row.total),
          issueDate: row.issueDate?.toISOString() ?? null,
          dueDate: row.dueDate?.toISOString() ?? null,
          afipCAE: row.afipCAE,
          afipNumber: row.afipNumber,
          afipStatus: row.afipStatus,
          lines: row.lines.map((line) => ({
            id: line.id,
            description: line.description,
            amount: Number(line.amount),
            type: line.type as InvoiceLineType,
          })),
        })),
      }}
      customers={customers}
      permissions={{
        canEditShipments,
        canViewDocuments,
        canCreateDocuments,
        canEditDocuments,
        canDeleteDocuments,
        canViewRevenue,
        canCreateRevenue,
        canEditRevenue,
        canDeleteRevenue,
        canViewExpenses,
        canCreateExpenses,
        canEditExpenses,
        canDeleteExpenses,
        canCreateShipmentCosts,
        canEditShipmentCosts,
        canDeleteShipmentCosts,
        canViewFinancialSummary,
        canCreateInvoices,
        canEditInvoices,
        canDeleteInvoices,
      }}
      actions={{
        updateShipmentAction,
        deleteShipmentDocumentDirectAction,
        uploadShipmentDocumentDirectAction,
        replaceShipmentDocumentDirectAction,
        deleteRevenueDirectAction,
        upsertRevenueDirectAction,
        deleteExpenseDirectAction,
        upsertExpenseDirectAction,
        deleteShipmentCostDirectAction,
        upsertShipmentCostDirectAction,
        createInvoiceDirectAction,
        upsertInvoiceDirectAction,
        issueInvoiceAFIPDirectAction,
        markInvoicePaidDirectAction,
        cancelInvoiceDirectAction,
        deleteInvoiceDirectAction,
      }}
    />
  );
}
