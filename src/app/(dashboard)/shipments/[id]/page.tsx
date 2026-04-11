import { notFound } from "next/navigation";
import { PermissionAction, PermissionResource } from "@prisma/client";

import { getShipmentById } from "@/lib/shipments";
import { listCustomers } from "@/lib/customers";
import { getShipmentTimeline } from "@/lib/shipment-timeline";
import { getShipmentQuoteContinuity } from "@/lib/shipment-quote-continuity";
import {
  createInvoiceDirectAction,
  issueInvoiceAFIPDirectAction,
  registerShipmentInvoicePaymentDirectAction,
  cancelInvoiceDirectAction,
  deleteInvoiceDirectAction,
  deleteExpenseDirectAction,
  deleteRevenueDirectAction,
  deleteShipmentCostDirectAction,
  deleteShipmentDocumentDirectAction,
  updateShipmentAction,
  upsertExpenseDirectAction,
  upsertInvoiceDirectAction,
  upsertRevenueDirectAction,
  upsertShipmentCostDirectAction,
  upsertShipmentDocumentDirectAction,
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
  const shipmentTimeline = await getShipmentTimeline({
    companyId: session.companyId,
    shipmentId: id,
    limit: 120,
  });
  const customers = await listCustomers(session.companyId);
  if (!shipment) {
    notFound();
  }

  const continuity = getShipmentQuoteContinuity({
    quotedSellAmount: shipment.quotedSellAmount,
    quotedCostAmount: shipment.quotedCostAmount,
    quotedGrossProfit: shipment.quotedGrossProfit,
    quotedMarginPercent: shipment.quotedMarginPercent,
    quotedTransitTimeDays: shipment.quotedTransitTimeDays,
    quotedMode: shipment.quotedMode,
    quotedDirection: shipment.quotedDirection,
    quotedOrigin: shipment.quotedOrigin,
    quotedDestination: shipment.quotedDestination,
    quotedAssumptionsNotes: shipment.quotedAssumptionsNotes,
    quotedChargeBreakdown: shipment.quotedChargeBreakdown,
    quotedSupplierSuggestions: shipment.quotedSupplierSuggestions,
    quoteSnapshot: shipment.quoteSnapshot,
    originCode: shipment.originCode,
    destinationCode: shipment.destinationCode,
    pol: shipment.pol,
    pod: shipment.pod,
    carrierName: shipment.carrierName,
    serviceLevel: shipment.serviceLevel,
    atd: shipment.atd,
    ata: shipment.ata,
    milestones: shipment.milestones.map((row) => ({
      code: row.code,
      actualAt: row.actualAt,
    })),
    invoices: shipment.invoices.map((row) => ({
      total: row.total,
      status: row.status,
    })),
    revenues: shipment.revenues.map((row) => ({
      amountBase: row.amountBase,
      status: row.status,
    })),
    shipmentCosts: shipment.shipmentCosts.map((row) => ({
      supplierName: row.supplierName,
      amount: row.amount,
      conceptCategory: row.conceptCategory,
      customConcept: row.customConcept,
    })),
    expenses: shipment.expenses.map((row) => ({
      supplierName: row.supplierName,
      amountBase: row.amountBase,
      concept: row.concept,
    })),
  });

  const getPaymentStatus = (total: number, paid: number): "UNPAID" | "PARTIALLY_PAID" | "PAID" => {
    if (total <= 0) return "PAID";
    if (paid <= 0) return "UNPAID";
    if (paid + 0.000001 >= total) return "PAID";
    return "PARTIALLY_PAID";
  };

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
        quoteSnapshotCapturedAt:
          shipment.quoteSnapshot &&
          typeof shipment.quoteSnapshot === "object" &&
          "capturedAt" in shipment.quoteSnapshot &&
          typeof shipment.quoteSnapshot.capturedAt === "string"
            ? shipment.quoteSnapshot.capturedAt
            : null,
        quoteContinuity: continuity,
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
          paidAmount: row.payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
          outstandingAmount: Math.max(
            Number(row.total) -
              row.payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
            0,
          ),
          paymentStatus: getPaymentStatus(
            Number(row.total),
            row.payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
          ),
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
        controlTimeline: shipmentTimeline.map((event) => ({
          id: event.id,
          shipmentId: event.shipmentId,
          eventType: event.eventType,
          category: event.category,
          title: event.title,
          description: event.description,
          actorType: event.actorType,
          actorName: event.actorName,
          metadata: event.metadata,
          timestamp: event.timestamp,
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
        upsertShipmentDocumentDirectAction,
        deleteRevenueDirectAction,
        upsertRevenueDirectAction,
        deleteExpenseDirectAction,
        upsertExpenseDirectAction,
        deleteShipmentCostDirectAction,
        upsertShipmentCostDirectAction,
        createInvoiceDirectAction,
        upsertInvoiceDirectAction,
        issueInvoiceAFIPDirectAction,
        registerInvoicePaymentDirectAction: registerShipmentInvoicePaymentDirectAction,
        cancelInvoiceDirectAction,
        deleteInvoiceDirectAction,
      }}
    />
  );
}
