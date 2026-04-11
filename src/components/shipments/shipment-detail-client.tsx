"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  Plane,
  ShipWheel,
  Truck,
} from "lucide-react";
import {
  DocumentRecordStatus,
  FinancialRecordStatus,
  InvoiceLineType,
  InvoiceStatus,
  MilestoneStatus,
  ShipmentCostCategory,
  ShipmentCostStatus,
  ShipmentStatus,
} from "@prisma/client";

import type { ShipmentActionState } from "@/app/(dashboard)/shipments/actions";
import { MilestoneTimeline } from "@/components/shipments/milestone-timeline";
import { ShipmentControlTimeline } from "@/components/shipments/shipment-control-timeline";
import { ShipmentForm } from "@/components/shipments/shipment-form";
import type { ShipmentTimelineEvent } from "@/lib/shipment-timeline";

type ShipmentDetailViewModel = {
  id: string;
  customerId: string;
  quoteId?: string | null;
  incotermCode?: string | null;
  serviceLevel?: string | null;
  commodity?: string | null;
  cargoReadyDate?: string | null;
  referenceClient?: string | null;
  referenceInternal?: string | null;
  shipmentNumber: string;
  status: string;
  mode: string;
  direction: string;
  customerName: string;
  quoteNumber?: string | null;
  quoteStatus?: string | null;
  originCode?: string | null;
  destinationCode?: string | null;
  etd?: string | null;
  eta?: string | null;
  atd?: string | null;
  ata?: string | null;
  deliveredAt?: string | null;
  pol?: string | null;
  pod?: string | null;
  airportOrigin?: string | null;
  airportDestination?: string | null;
  placeOfReceipt?: string | null;
  placeOfDelivery?: string | null;
  shipperName?: string | null;
  consigneeName?: string | null;
  notifyPartyName?: string | null;
  agentOriginName?: string | null;
  agentDestinationName?: string | null;
  carrierName?: string | null;
  vesselOrFlight?: string | null;
  bookingRef?: string | null;
  houseRef?: string | null;
  masterRef?: string | null;
  packageCount?: number | null;
  packageType?: string | null;
  grossWeightKg?: string | null;
  chargeableWeightKg?: string | null;
  volumeM3?: string | null;
  containerCount?: number | null;
  containerType?: string | null;
  notes?: string | null;
  quoteSnapshotCapturedAt?: string | null;
  quoteContinuity: {
    quoted: {
      revenue: number | null;
      cost: number | null;
      grossProfit: number | null;
      marginPercent: number | null;
      transitTimeDays: number | null;
      mode: string | null;
      direction: string | null;
      origin: string | null;
      destination: string | null;
      chargeBreakdown: Array<{
        concept: string;
        chargeType: string | null;
        buyAmount: number;
        sellAmount: number;
        currencyCode: string;
      }>;
      supplierSuggestions: {
        suggestedCarrier: string | null;
        suggestedSupplier: string | null;
        serviceLevelAssumption: string | null;
        routeAssumption: string | null;
      } | null;
      assumptionsNotes: string | null;
    };
    actual: {
      revenue: number;
      cost: number;
      grossProfit: number;
      marginPercent: number | null;
      transitTimeDays: number | null;
      supplierCarrier: string | null;
      supplierName: string | null;
      origin: string | null;
      destination: string | null;
    };
    variance: {
      revenue: number | null;
      cost: number | null;
      grossProfit: number | null;
      marginPercent: number | null;
      transitTimeDays: number | null;
    };
    transitPerformanceStatus: "UNKNOWN" | "ON_TARGET" | "FASTER_THAN_QUOTED" | "SLOWER_THAN_QUOTED";
    warnings: {
      marginDroppedBelowQuote: boolean;
      costsExceedQuotedEstimate: boolean;
      transitSlowerThanQuoted: boolean;
      supplierDifferentFromSuggestion: boolean;
    };
  };
  milestones: Array<{
    id: string;
    code: string;
    label: string;
    status: MilestoneStatus;
    expectedAt?: string | null;
    actualAt?: string | null;
    comment?: string | null;
  }>;
  documents: Array<{
    id: string;
    docType: string;
    fileName: string;
    referenceNumber?: string | null;
    issueDate?: string | null;
    version: number;
    status: DocumentRecordStatus;
    notes?: string | null;
  }>;
  revenues: Array<{
    id: string;
    concept: string;
    amount: number;
    currencyCode: string;
    exchangeRate?: number | null;
    amountBase: number;
    dueDate?: string | null;
    status: FinancialRecordStatus;
    notes?: string | null;
  }>;
  expenses: Array<{
    id: string;
    supplierName: string;
    concept: string;
    amount: number;
    currencyCode: string;
    exchangeRate?: number | null;
    amountBase: number;
    dueDate?: string | null;
    status: FinancialRecordStatus;
    notes?: string | null;
  }>;
  shipmentCosts: Array<{
    id: string;
    supplierName: string;
    conceptCategory: ShipmentCostCategory;
    customConcept?: string | null;
    amount: number;
    currencyCode: string;
    dueDate?: string | null;
    status: ShipmentCostStatus;
    notes?: string | null;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    currencyCode: string;
    subtotal: number;
    taxes: number;
    total: number;
    issueDate?: string | null;
    dueDate?: string | null;
    afipCAE?: string | null;
    afipNumber?: string | null;
    afipStatus?: string | null;
    paidAmount: number;
    outstandingAmount: number;
    paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
    lines: Array<{
      id: string;
      description: string;
      amount: number;
      type: InvoiceLineType;
    }>;
  }>;
  controlTimeline: ShipmentTimelineEvent[];
};

type Props = {
  shipment: ShipmentDetailViewModel;
  customers: Array<{ id: string; code: string; legalName: string }>;
  permissions: {
    canEditShipments: boolean;
    canViewDocuments: boolean;
    canCreateDocuments: boolean;
    canEditDocuments: boolean;
    canDeleteDocuments: boolean;
    canViewRevenue: boolean;
    canCreateRevenue: boolean;
    canEditRevenue: boolean;
    canDeleteRevenue: boolean;
    canViewExpenses: boolean;
    canCreateExpenses: boolean;
    canEditExpenses: boolean;
    canDeleteExpenses: boolean;
    canCreateShipmentCosts: boolean;
    canEditShipmentCosts: boolean;
    canDeleteShipmentCosts: boolean;
    canViewFinancialSummary: boolean;
    canCreateInvoices: boolean;
    canEditInvoices: boolean;
    canDeleteInvoices: boolean;
  };
  actions: {
    updateShipmentAction: (
      prevState: ShipmentActionState,
      formData: FormData,
    ) => Promise<ShipmentActionState>;
    deleteShipmentDocumentDirectAction: (formData: FormData) => Promise<void>;
    upsertShipmentDocumentDirectAction: (formData: FormData) => Promise<void>;
    deleteRevenueDirectAction: (formData: FormData) => Promise<void>;
    upsertRevenueDirectAction: (formData: FormData) => Promise<void>;
    deleteExpenseDirectAction: (formData: FormData) => Promise<void>;
    upsertExpenseDirectAction: (formData: FormData) => Promise<void>;
    deleteShipmentCostDirectAction: (formData: FormData) => Promise<void>;
    upsertShipmentCostDirectAction: (formData: FormData) => Promise<void>;
    createInvoiceDirectAction: (formData: FormData) => Promise<void>;
    upsertInvoiceDirectAction: (formData: FormData) => Promise<void>;
    issueInvoiceAFIPDirectAction: (formData: FormData) => Promise<void>;
    registerInvoicePaymentDirectAction: (formData: FormData) => Promise<void>;
    cancelInvoiceDirectAction: (formData: FormData) => Promise<void>;
    deleteInvoiceDirectAction: (formData: FormData) => Promise<void>;
  };
};

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shipmentStatusClass(status: string) {
  if (status === "DELIVERED" || status === "CLOSED") return "bg-emerald-100 text-emerald-800";
  if (status === "CUSTOMS" || status === "BOOKING_CONFIRMED") return "bg-amber-100 text-amber-800";
  if (status === "IN_TRANSIT" || status === "ARRIVED") return "bg-sky-100 text-sky-700";
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function pct(value: number | null) {
  return value === null ? "-" : `${value.toFixed(2)}%`;
}

function varianceLabel(value: number | null, kind: "currency" | "points" | "days") {
  if (value === null) return "-";
  if (kind === "currency") {
    return `${value > 0 ? "+" : value < 0 ? "-" : ""}${money(Math.abs(value))}`;
  }
  if (kind === "points") {
    return `${value > 0 ? "+" : value < 0 ? "-" : ""}${Math.abs(value).toFixed(2)} pts`;
  }
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${Math.abs(value).toFixed(0)} days`;
}

function varianceClass(value: number | null, inverse = false) {
  if (value === null || value === 0) return "text-slate-600";
  const positive = value > 0;
  if (inverse) {
    return positive ? "text-rose-700" : "text-emerald-700";
  }
  return positive ? "text-emerald-700" : "text-rose-700";
}

function transitStatusLabel(status: ShipmentDetailViewModel["quoteContinuity"]["transitPerformanceStatus"]) {
  if (status === "ON_TARGET") return "On target";
  if (status === "FASTER_THAN_QUOTED") return "Faster than quoted";
  if (status === "SLOWER_THAN_QUOTED") return "Slower than quoted";
  return "Unknown";
}

function transitStatusClass(status: ShipmentDetailViewModel["quoteContinuity"]["transitPerformanceStatus"]) {
  if (status === "ON_TARGET") return "bg-sky-100 text-sky-700";
  if (status === "FASTER_THAN_QUOTED") return "bg-emerald-100 text-emerald-700";
  if (status === "SLOWER_THAN_QUOTED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function dateLabel(value?: string | Date | null, withTime = false) {
  if (!value) return "-";
  const parsed = new Date(value);
  return withTime ? parsed.toLocaleString() : parsed.toLocaleDateString();
}

function modeIcon(mode: string) {
  if (mode === "AIR") return <Plane className="h-4 w-4" />;
  if (mode === "ROAD") return <Truck className="h-4 w-4" />;
  return <ShipWheel className="h-4 w-4" />;
}

function milestoneVisual(status: MilestoneStatus) {
  if (status === "COMPLETED") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "IN_PROGRESS") return <CircleDot className="h-4 w-4 text-sky-500" />;
  if (status === "DELAYED") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Clock3 className="h-4 w-4 text-slate-400" />;
}

function statusPill(
  status: DocumentRecordStatus | FinancialRecordStatus,
  map: Record<string, string>,
) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${map[status]}`}>
      {status}
    </span>
  );
}

function invoiceStatusClass(status: InvoiceStatus) {
  if (status === InvoiceStatus.PAID) return "bg-emerald-100 text-emerald-700";
  if (status === InvoiceStatus.ISSUED) return "bg-sky-100 text-sky-700";
  if (status === InvoiceStatus.READY_TO_ISSUE) return "bg-amber-100 text-amber-800";
  if (status === InvoiceStatus.CANCELLED) return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function invoiceStatusLabel(status: InvoiceStatus) {
  if (status === InvoiceStatus.READY_TO_ISSUE) return "Ready";
  if (status === InvoiceStatus.ISSUED) return "Issued";
  if (status === InvoiceStatus.PAID) return "Paid";
  if (status === InvoiceStatus.CANCELLED) return "Cancelled";
  return "Draft";
}

const docStatusClass: Record<DocumentRecordStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  RECEIVED: "bg-sky-100 text-sky-700",
  VERIFIED: "bg-emerald-100 text-emerald-700",
};

const financeStatusClass: Record<FinancialRecordStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  INVOICED: "bg-sky-100 text-sky-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

const shipmentCostStatusClass: Record<ShipmentCostStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-sky-100 text-sky-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

const invoiceInitialState: ShipmentActionState = { success: false };

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

export function ShipmentDetailClient({
  shipment,
  customers,
  permissions,
  actions,
}: Props) {
  const {
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
    canCreateShipmentCosts,
    canEditShipmentCosts,
    canDeleteShipmentCosts,
    canViewFinancialSummary,
    canCreateInvoices,
    canEditInvoices,
    canDeleteInvoices,
  } = permissions;
  const {
    updateShipmentAction,
    deleteShipmentDocumentDirectAction: deleteDocumentAction,
    upsertShipmentDocumentDirectAction: upsertDocumentAction,
    deleteRevenueDirectAction: deleteRevenueAction,
    upsertRevenueDirectAction: upsertRevenueAction,
    deleteShipmentCostDirectAction: deleteShipmentCostAction,
    upsertShipmentCostDirectAction: upsertShipmentCostAction,
    createInvoiceDirectAction: createInvoiceAction,
    upsertInvoiceDirectAction: upsertInvoiceAction,
    issueInvoiceAFIPDirectAction: issueInvoiceAFIPAction,
    registerInvoicePaymentDirectAction: registerInvoicePaymentAction,
    cancelInvoiceDirectAction: cancelInvoiceAction,
    deleteInvoiceDirectAction: deleteInvoiceAction,
  } = actions;
  const defaultTab: "documents" | "revenue" | "costs" | "invoices" = canViewDocuments
    ? "documents"
    : canViewRevenue
      ? "revenue"
      : canViewExpenses
        ? "costs"
        : "invoices";
  const [activeTab, setActiveTab] = useState<"documents" | "revenue" | "costs" | "invoices">(
    defaultTab,
  );
  const [invoiceCreateState] = useActionState<ShipmentActionState, FormData>(
    async (_state, formData) => {
      try {
        await createInvoiceAction(formData);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unable to create invoice",
        };
      }
    },
    invoiceInitialState,
  );
  const timeline = useMemo(() => {
    return shipment.milestones.map((m, index) => ({
      ...m,
      isCurrent: m.status === "IN_PROGRESS",
      isDone: m.status === "COMPLETED",
      isLast: index === shipment.milestones.length - 1,
    }));
  }, [shipment.milestones]);

  const routeLabel = `${shipment.originCode ?? "-"} → ${shipment.destinationCode ?? "-"}`;
  const shipmentReadyForBilling = shipment.status === ShipmentStatus.CLOSED;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Shipment File</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{shipment.shipmentNumber}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                {modeIcon(shipment.mode)}
                {shipment.mode}
              </span>
              <span>{shipment.direction}</span>
              <span className="text-slate-400">•</span>
              <span>{shipment.customerName}</span>
              <span className="text-slate-400">•</span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <span>{shipment.originCode ?? "-"}</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                <span>{shipment.destinationCode ?? "-"}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${shipmentStatusClass(shipment.status)}`}
            >
              {statusLabel(shipment.status)}
            </span>
            {shipment.quoteNumber ? (
              <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1.5 text-sm font-semibold text-indigo-700">
                Quote {shipment.quoteNumber}
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Route</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{routeLabel}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">ETD</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{dateLabel(shipment.etd)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">ETA</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{dateLabel(shipment.eta)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Delivered</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{dateLabel(shipment.deliveredAt, true)}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card title="Tracking timeline" subtitle="Live operational checkpoint sequence">
            {timeline.length === 0 ? (
              <Empty label="No milestones configured for this shipment." />
            ) : (
              <ol className="space-y-3">
                {timeline.map((step) => (
                  <li key={step.id} className="relative pl-7">
                    {!step.isLast ? (
                      <span className="absolute left-[7px] top-5 h-10 w-px bg-slate-200" aria-hidden />
                    ) : null}
                    <span className="absolute left-0 top-1">{milestoneVisual(step.status)}</span>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                        <span className="text-xs font-medium text-slate-500">{step.status}</span>
                      </div>
                      <div className="mt-1 grid gap-1 text-xs text-slate-600 md:grid-cols-2">
                        <p>Expected: {dateLabel(step.expectedAt, true)}</p>
                        <p>Actual: {dateLabel(step.actualAt, true)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Routing & references">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 text-sm text-slate-700">
                <p>
                  <span className="font-medium text-slate-900">POL / POD:</span> {shipment.pol ?? "-"} /{" "}
                  {shipment.pod ?? "-"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Airport O/D:</span> {shipment.airportOrigin ?? "-"} /{" "}
                  {shipment.airportDestination ?? "-"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Receipt / Delivery:</span>{" "}
                  {(shipment.placeOfReceipt ?? "-") + " / " + (shipment.placeOfDelivery ?? "-")}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Carrier:</span> {shipment.carrierName ?? "-"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Vessel / Flight:</span>{" "}
                  {shipment.vesselOrFlight ?? "-"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Incoterm:</span> {shipment.incotermCode ?? "-"}
                </p>
              </div>
              <div className="space-y-1 text-sm text-slate-700">
                <p>
                  <span className="font-medium text-slate-900">Booking Ref:</span> {shipment.bookingRef ?? "-"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">House Ref:</span> {shipment.houseRef ?? "-"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Master Ref:</span> {shipment.masterRef ?? "-"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">ATD:</span> {dateLabel(shipment.atd, true)}
                </p>
                <p>
                  <span className="font-medium text-slate-900">ATA:</span> {dateLabel(shipment.ata, true)}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Cargo Ready:</span>{" "}
                  {dateLabel(shipment.cargoReadyDate, true)}
                </p>
              </div>
            </div>
          </Card>

          <Card title="Parties & cargo">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 text-sm text-slate-700">
                <p>
                  <span className="font-medium text-slate-900">Shipper:</span> {shipment.shipperName ?? "-"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Consignee:</span> {shipment.consigneeName ?? "-"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Notify Party:</span> {shipment.notifyPartyName ?? "-"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Origin Agent:</span>{" "}
                  {shipment.agentOriginName ?? "-"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Destination Agent:</span>{" "}
                  {shipment.agentDestinationName ?? "-"}
                </p>
              </div>
              <div className="space-y-1 text-sm text-slate-700">
                <p>
                  <span className="font-medium text-slate-900">Packages:</span>{" "}
                  {(shipment.packageCount ?? "-") + " " + (shipment.packageType ?? "")}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Gross Weight:</span>{" "}
                  {shipment.grossWeightKg ?? "-"} kg
                </p>
                <p>
                  <span className="font-medium text-slate-900">Chargeable Weight:</span>{" "}
                  {shipment.chargeableWeightKg ?? "-"} kg
                </p>
                <p>
                  <span className="font-medium text-slate-900">Volume:</span> {shipment.volumeM3 ?? "-"} m3
                </p>
                <p>
                  <span className="font-medium text-slate-900">Containers:</span>{" "}
                  {(shipment.containerCount ?? "-") + " / " + (shipment.containerType ?? "-")}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Commodity:</span> {shipment.commodity ?? "-"}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Notes:</span> {shipment.notes ?? "-"}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {canViewFinancialSummary ? (
            <Card title="Originally Quoted vs Actual" subtitle="Commercial and operational continuity">
              {shipment.quoteContinuity.quoted.revenue === null ? (
                <Empty label="No quote snapshot available yet for continuity comparison." />
              ) : (
                <div className="space-y-3 text-sm">
                  {shipment.quoteSnapshotCapturedAt ? (
                    <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      Captured from quote on {dateLabel(shipment.quoteSnapshotCapturedAt, true)}.
                    </p>
                  ) : null}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Commercial</p>
                    <div className="mt-2 space-y-1.5">
                      <p>
                        Quoted Revenue:{" "}
                        <span className="font-semibold text-slate-900">
                          {money(shipment.quoteContinuity.quoted.revenue ?? 0)}
                        </span>
                      </p>
                      <p>
                        Actual Revenue:{" "}
                        <span className="font-semibold text-slate-900">
                          {money(shipment.quoteContinuity.actual.revenue)}
                        </span>
                      </p>
                      <p>
                        Revenue Variance:{" "}
                        <span className={varianceClass(shipment.quoteContinuity.variance.revenue)}>
                          {varianceLabel(shipment.quoteContinuity.variance.revenue, "currency")}
                        </span>
                      </p>
                      <p>
                        Quoted Cost:{" "}
                        <span className="font-semibold text-slate-900">
                          {money(shipment.quoteContinuity.quoted.cost ?? 0)}
                        </span>
                      </p>
                      <p>
                        Actual Cost:{" "}
                        <span className="font-semibold text-slate-900">
                          {money(shipment.quoteContinuity.actual.cost)}
                        </span>
                      </p>
                      <p>
                        Cost Variance:{" "}
                        <span className={varianceClass(shipment.quoteContinuity.variance.cost, true)}>
                          {varianceLabel(shipment.quoteContinuity.variance.cost, "currency")}
                        </span>
                      </p>
                      <p>
                        Quoted Gross Profit:{" "}
                        <span className="font-semibold text-slate-900">
                          {money(shipment.quoteContinuity.quoted.grossProfit ?? 0)}
                        </span>
                      </p>
                      <p>
                        Actual Gross Profit:{" "}
                        <span className="font-semibold text-slate-900">
                          {money(shipment.quoteContinuity.actual.grossProfit)}
                        </span>
                      </p>
                      <p>
                        Profit Variance:{" "}
                        <span className={varianceClass(shipment.quoteContinuity.variance.grossProfit)}>
                          {varianceLabel(shipment.quoteContinuity.variance.grossProfit, "currency")}
                        </span>
                      </p>
                      <p>
                        Quoted Margin %:{" "}
                        <span className="font-semibold text-slate-900">
                          {pct(shipment.quoteContinuity.quoted.marginPercent)}
                        </span>
                      </p>
                      <p>
                        Actual Margin %:{" "}
                        <span className="font-semibold text-slate-900">
                          {pct(shipment.quoteContinuity.actual.marginPercent)}
                        </span>
                      </p>
                      <p>
                        Margin Variance:{" "}
                        <span className={varianceClass(shipment.quoteContinuity.variance.marginPercent)}>
                          {varianceLabel(shipment.quoteContinuity.variance.marginPercent, "points")}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operational</p>
                    <div className="mt-2 space-y-1.5">
                      <p>
                        Quoted Transit Time:{" "}
                        <span className="font-semibold text-slate-900">
                          {shipment.quoteContinuity.quoted.transitTimeDays === null
                            ? "-"
                            : `${shipment.quoteContinuity.quoted.transitTimeDays} days`}
                        </span>
                      </p>
                      <p>
                        Actual Transit Time:{" "}
                        <span className="font-semibold text-slate-900">
                          {shipment.quoteContinuity.actual.transitTimeDays === null
                            ? "-"
                            : `${shipment.quoteContinuity.actual.transitTimeDays} days`}
                        </span>
                      </p>
                      <p>
                        Transit Variance:{" "}
                        <span className={varianceClass(shipment.quoteContinuity.variance.transitTimeDays)}>
                          {varianceLabel(shipment.quoteContinuity.variance.transitTimeDays, "days")}
                        </span>
                      </p>
                      <p>
                        Transit Performance:{" "}
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${transitStatusClass(
                            shipment.quoteContinuity.transitPerformanceStatus,
                          )}`}
                        >
                          {transitStatusLabel(shipment.quoteContinuity.transitPerformanceStatus)}
                        </span>
                      </p>
                      <p>
                        Quoted Supplier / Carrier:{" "}
                        <span className="font-semibold text-slate-900">
                          {shipment.quoteContinuity.quoted.supplierSuggestions?.suggestedSupplier ??
                            shipment.quoteContinuity.quoted.supplierSuggestions?.suggestedCarrier ??
                            "-"}
                        </span>
                      </p>
                      <p>
                        Actual Supplier / Carrier:{" "}
                        <span className="font-semibold text-slate-900">
                          {shipment.quoteContinuity.actual.supplierName ??
                            shipment.quoteContinuity.actual.supplierCarrier ??
                            "-"}
                        </span>
                      </p>
                      <p>
                        Route (Quoted vs Actual):{" "}
                        <span className="font-semibold text-slate-900">
                          {(shipment.quoteContinuity.quoted.origin ?? "-") +
                            " → " +
                            (shipment.quoteContinuity.quoted.destination ?? "-")}
                          {" / "}
                          {(shipment.quoteContinuity.actual.origin ?? "-") +
                            " → " +
                            (shipment.quoteContinuity.actual.destination ?? "-")}
                        </span>
                      </p>
                    </div>
                  </div>

                  {shipment.quoteContinuity.quoted.chargeBreakdown.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Quoted charge breakdown
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-slate-700">
                        {shipment.quoteContinuity.quoted.chargeBreakdown.map((row, index) => (
                          <li key={`${row.concept}-${index}`} className="flex items-center justify-between gap-2">
                            <span>
                              {row.concept}
                              {row.chargeType ? ` (${row.chargeType})` : ""}
                            </span>
                            <span className="font-medium text-slate-900">
                              {money(row.sellAmount)} / {money(row.buyAmount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {shipment.quoteContinuity.quoted.assumptionsNotes ? (
                    <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">Quoted notes / assumptions:</span>{" "}
                      {shipment.quoteContinuity.quoted.assumptionsNotes}
                    </p>
                  ) : null}
                  {shipment.quoteSnapshotCapturedAt ? (
                    <p className="text-[11px] text-slate-500">
                      Snapshot captured: {dateLabel(shipment.quoteSnapshotCapturedAt, true)}
                    </p>
                  ) : null}

                  {shipment.quoteContinuity.warnings.marginDroppedBelowQuote ? (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      Warning: actual margin is below quoted margin.
                    </p>
                  ) : null}
                  {shipment.quoteContinuity.warnings.costsExceedQuotedEstimate ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Warning: actual costs exceed quoted estimate by more than 10%.
                    </p>
                  ) : null}
                  {shipment.quoteContinuity.warnings.transitSlowerThanQuoted ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Warning: shipment transit is slower than quoted.
                    </p>
                  ) : null}
                  {shipment.quoteContinuity.warnings.supplierDifferentFromSuggestion ? (
                    <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                      Note: operational supplier differs from quoted recommendation.
                    </p>
                  ) : null}
                </div>
              )}
            </Card>
          ) : null}

          <Card title="Operational records">
            <div className="mb-3 flex gap-2">
              {canViewDocuments ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("documents")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    activeTab === "documents"
                      ? "bg-sky-600 text-white"
                      : "border border-slate-200 text-slate-600"
                  }`}
                >
                  Documents
                </button>
              ) : null}
              {canViewRevenue ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("revenue")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    activeTab === "revenue" ? "bg-sky-600 text-white" : "border border-slate-200 text-slate-600"
                  }`}
                >
                  Revenue
                </button>
              ) : null}
              {canViewExpenses ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("costs")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    activeTab === "costs" ? "bg-sky-600 text-white" : "border border-slate-200 text-slate-600"
                  }`}
                >
                  Costs
                </button>
              ) : null}
              {canCreateInvoices || canEditInvoices || canDeleteInvoices ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("invoices")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    activeTab === "invoices"
                      ? "bg-sky-600 text-white"
                      : "border border-slate-200 text-slate-600"
                  }`}
                >
                  Invoices
                </button>
              ) : null}
            </div>

            {activeTab === "invoices" && (canCreateInvoices || canEditInvoices || canDeleteInvoices) ? (
              <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Create invoice</p>
                    <p className="text-xs text-slate-600">
                      Invoice is linked to this shipment and customer. Requires shipment closed.
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      shipmentReadyForBilling
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {shipmentReadyForBilling ? "Ready for billing" : "Not ready for billing"}
                  </span>
                </div>
                {canCreateInvoices ? (
                  <form action={createInvoiceAction} className="space-y-2">
                    <input type="hidden" name="shipmentId" value={shipment.id} />
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        name="invoiceNumber"
                        required
                        placeholder="Invoice number (internal)"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <select
                        name="currencyCode"
                        defaultValue="USD"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="ARS">ARS</option>
                      </select>
                    </div>
                    <input
                      name="lineDescription"
                      required
                      placeholder="Line description"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <div className="grid gap-2 md:grid-cols-3">
                      <input
                        type="number"
                        name="lineAmount"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="Line amount"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <select
                        name="lineType"
                        defaultValue="FREIGHT"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        {Object.values(InvoiceLineType).map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        name="taxes"
                        step="0.01"
                        min="0"
                        defaultValue="0"
                        placeholder="Taxes"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        type="date"
                        name="issueDate"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <input
                        type="date"
                        name="dueDate"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-500"
                    >
                      Create invoice
                    </button>
                    {invoiceCreateState.error && !invoiceCreateState.success ? (
                      <p className="text-xs text-rose-700">{invoiceCreateState.error}</p>
                    ) : null}
                  </form>
                ) : null}
              </div>
            ) : null}

            {activeTab === "documents" && canViewDocuments ? (
              <div className="space-y-3">
                {shipment.documents.length === 0 ? (
                  <Empty label="No documents registered yet." />
                ) : (
                  shipment.documents.map((doc) => (
                    <div key={doc.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-slate-900">{doc.fileName}</p>
                          <p className="text-xs text-slate-600">{doc.docType}</p>
                        </div>
                        {statusPill(doc.status, docStatusClass)}
                      </div>
                      <div className="mt-2 text-xs text-slate-600">
                        <p>Ref: {doc.referenceNumber ?? "-"}</p>
                        <p>Issue: {dateLabel(doc.issueDate)}</p>
                        <p>Version: {doc.version}</p>
                      </div>
                      {canDeleteDocuments ? (
                        <form action={deleteDocumentAction} className="mt-2">
                          <input type="hidden" name="id" value={doc.id} />
                          <button
                            className="text-xs font-medium text-rose-700 transition hover:underline"
                            type="submit"
                          >
                            Delete
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))
                )}

                {canCreateDocuments ? (
                  <form action={upsertDocumentAction} className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <input type="hidden" name="shipmentId" value={shipment.id} />
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add document</p>
                    <select name="docType" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      {["COMMERCIAL_INVOICE","PACKING_LIST","HBL","MBL","HAWB","MAWB","CERTIFICATE","PERMIT","POD","OTHER"].map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <input name="fileName" required placeholder="File name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input name="referenceNumber" placeholder="Reference number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input type="date" name="issueDate" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input type="number" min={1} name="version" defaultValue={1} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <select name="status" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      {Object.values(DocumentRecordStatus).map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <textarea name="notes" rows={2} placeholder="Internal notes" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <button type="submit" className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-500">
                      Save document
                    </button>
                  </form>
                ) : null}

                {canEditDocuments && shipment.documents.length > 0 ? (
                  <form action={upsertDocumentAction} className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <input type="hidden" name="shipmentId" value={shipment.id} />
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit document</p>
                    <select name="id" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <option value="">Select document</option>
                      {shipment.documents.map((doc) => (
                        <option key={doc.id} value={doc.id}>{doc.docType} - {doc.fileName}</option>
                      ))}
                    </select>
                    <select name="docType" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      {["COMMERCIAL_INVOICE","PACKING_LIST","HBL","MBL","HAWB","MAWB","CERTIFICATE","PERMIT","POD","OTHER"].map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <input name="fileName" required placeholder="File name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input name="referenceNumber" placeholder="Reference number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input type="date" name="issueDate" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input type="number" min={1} name="version" defaultValue={1} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <select name="status" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      {Object.values(DocumentRecordStatus).map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <textarea name="notes" rows={2} placeholder="Internal notes" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                      Update document
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}

            {activeTab === "revenue" && canViewRevenue ? (
              <div className="space-y-3">
                {shipment.revenues.length === 0 ? (
                  <Empty label="No revenue records yet." />
                ) : (
                  shipment.revenues.map((row) => (
                    <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{row.concept}</p>
                          <p className="text-xs text-slate-600">
                            {row.amount.toFixed(2)} {row.currencyCode} · Base {row.amountBase.toFixed(2)}
                          </p>
                        </div>
                        {statusPill(row.status, financeStatusClass)}
                      </div>
                      <p className="mt-2 text-xs text-slate-600">Due: {dateLabel(row.dueDate)}</p>
                      {canDeleteRevenue ? (
                        <form action={deleteRevenueAction} className="mt-2">
                          <input type="hidden" name="id" value={row.id} />
                          <button className="text-xs font-medium text-rose-700 transition hover:underline" type="submit">
                            Delete
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))
                )}

                {canCreateRevenue ? (
                  <form action={upsertRevenueAction} className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <input type="hidden" name="shipmentId" value={shipment.id} />
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add revenue</p>
                    <input name="concept" required placeholder="Concept" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" step="0.01" min={0} name="amount" required placeholder="Amount" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      <select name="currencyCode" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="ARS">ARS</option>
                      </select>
                      <input type="number" step="0.0001" min={0} name="exchangeRate" placeholder="Rate" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                    <input type="date" name="dueDate" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <select name="status" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      {Object.values(FinancialRecordStatus).map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <button type="submit" className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-500">
                      Save revenue
                    </button>
                  </form>
                ) : null}

                {canEditRevenue && shipment.revenues.length > 0 ? (
                  <form action={upsertRevenueAction} className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <input type="hidden" name="shipmentId" value={shipment.id} />
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit revenue</p>
                    <select name="id" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <option value="">Select revenue record</option>
                      {shipment.revenues.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.concept} - {row.amount.toFixed(2)} {row.currencyCode}
                        </option>
                      ))}
                    </select>
                    <input name="concept" required placeholder="Concept" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" step="0.01" min={0} name="amount" required placeholder="Amount" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      <select name="currencyCode" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="ARS">ARS</option>
                      </select>
                      <input type="number" step="0.0001" min={0} name="exchangeRate" placeholder="Rate" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                    <input type="date" name="dueDate" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <select name="status" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      {Object.values(FinancialRecordStatus).map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                      Update revenue
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}

            {activeTab === "costs" && canViewExpenses ? (
              <div className="space-y-3">
                {shipment.shipmentCosts.length === 0 ? (
                  <Empty label="No shipment costs registered yet." />
                ) : (
                  shipment.shipmentCosts.map((row) => (
                    <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{row.supplierName}</p>
                          <p className="text-xs text-slate-600">
                            {row.conceptCategory}
                            {row.customConcept ? ` · ${row.customConcept}` : ""} · {row.amount.toFixed(2)}{" "}
                            {row.currencyCode}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${shipmentCostStatusClass[row.status]}`}
                        >
                          {row.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">Due: {dateLabel(row.dueDate)}</p>
                      {canDeleteShipmentCosts ? (
                        <form action={deleteShipmentCostAction} className="mt-2">
                          <input type="hidden" name="id" value={row.id} />
                          <button className="text-xs font-medium text-rose-700 transition hover:underline" type="submit">
                            Delete
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))
                )}

                {canCreateShipmentCosts ? (
                  <form action={upsertShipmentCostAction} className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <input type="hidden" name="shipmentId" value={shipment.id} />
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Add shipment cost
                    </p>
                    <input name="supplierName" required placeholder="Supplier name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <select
                      name="conceptCategory"
                      defaultValue="OCEAN_FREIGHT"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {Object.values(ShipmentCostCategory).map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <input
                      name="customConcept"
                      placeholder="Custom concept (required if category is OTHER)"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" step="0.01" min={0} name="amount" required placeholder="Amount" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      <select name="currencyCode" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="ARS">ARS</option>
                      </select>
                      <select
                        name="status"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        {Object.values(ShipmentCostStatus).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input type="date" name="dueDate" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <button type="submit" className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-500">
                      Save cost
                    </button>
                  </form>
                ) : null}

                {canEditShipmentCosts && shipment.shipmentCosts.length > 0 ? (
                  <form action={upsertShipmentCostAction} className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <input type="hidden" name="shipmentId" value={shipment.id} />
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Edit shipment cost
                    </p>
                    <select name="id" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <option value="">Select cost record</option>
                      {shipment.shipmentCosts.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.supplierName} - {row.conceptCategory}
                        </option>
                      ))}
                    </select>
                    <input name="supplierName" required placeholder="Supplier name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <select
                      name="conceptCategory"
                      defaultValue="OCEAN_FREIGHT"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {Object.values(ShipmentCostCategory).map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <input
                      name="customConcept"
                      placeholder="Custom concept (required if category is OTHER)"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" step="0.01" min={0} name="amount" required placeholder="Amount" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      <select name="currencyCode" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="ARS">ARS</option>
                      </select>
                      <select
                        name="status"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        {Object.values(ShipmentCostStatus).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input type="date" name="dueDate" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                      Update cost
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}

            {activeTab === "invoices" && (canCreateInvoices || canEditInvoices || canDeleteInvoices) ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoices</p>
                {shipment.invoices.length === 0 ? (
                  <Empty label="No invoices linked to this shipment yet." />
                ) : (
                  shipment.invoices.map((invoice) => (
                    <div key={invoice.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-slate-600">
                            Total {money(invoice.total)} · Subtotal {money(invoice.subtotal)} · Taxes {money(invoice.taxes)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${invoiceStatusClass(
                            invoice.status,
                          )}`}
                        >
                          {invoiceStatusLabel(invoice.status)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-600">
                        <p>Issue: {dateLabel(invoice.issueDate)}</p>
                        <p>Due: {dateLabel(invoice.dueDate)}</p>
                        <p>AFIP CAE: {invoice.afipCAE ?? "-"}</p>
                        <p>AFIP Number: {invoice.afipNumber ?? "-"}</p>
                        <p>AFIP Status: {invoice.afipStatus ?? "-"}</p>
                      </div>
                      {invoice.status === InvoiceStatus.ISSUED && !invoice.afipCAE ? (
                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                          Warning: invoice issued without AFIP CAE.
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          href={`/finance/invoices/${invoice.id}`}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Open detail
                        </Link>
                        {canEditInvoices ? (
                          <form action={issueInvoiceAFIPAction}>
                            <input type="hidden" name="id" value={invoice.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-sky-200 px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-50"
                            >
                              Issue AFIP
                            </button>
                          </form>
                        ) : null}
                        {canEditInvoices ? (
                          <form action={registerInvoicePaymentAction} className="flex items-center gap-2">
                            <input type="hidden" name="id" value={invoice.id} />
                            <input
                              type="number"
                              name="amount"
                              min="0.01"
                              step="0.01"
                              placeholder="Amount"
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            />
                            <input
                              type="date"
                              name="paymentDate"
                              defaultValue={new Date().toISOString().slice(0, 10)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            />
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
                            >
                              Register payment
                            </button>
                          </form>
                        ) : null}
                        {canEditInvoices ? (
                          <form action={cancelInvoiceAction}>
                            <input type="hidden" name="id" value={invoice.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : null}
                        {canDeleteInvoices ? (
                          <form action={deleteInvoiceAction}>
                            <input type="hidden" name="id" value={invoice.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </form>
                        ) : null}
                      </div>
                      {canEditInvoices ? (
                        <form action={upsertInvoiceAction} className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <input type="hidden" name="id" value={invoice.id} />
                          <input type="hidden" name="shipmentId" value={shipment.id} />
                          <input type="hidden" name="invoiceNumber" value={invoice.invoiceNumber} />
                          <input type="hidden" name="currencyCode" value={invoice.currencyCode} />
                          <input type="hidden" name="issueDate" value={invoice.issueDate ? new Date(invoice.issueDate).toISOString().slice(0, 10) : ""} />
                          <input type="hidden" name="dueDate" value={invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : ""} />
                          <div className="grid gap-2 md:grid-cols-3">
                            <input
                              name="lineDescription"
                              required
                              placeholder="Add line description"
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                            <input
                              type="number"
                              name="lineAmount"
                              step="0.01"
                              min="0.01"
                              required
                              placeholder="Amount"
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                            <select
                              name="lineType"
                              defaultValue="OTHER"
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            >
                              {Object.values(InvoiceLineType).map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="submit"
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-white"
                          >
                            Add line
                          </button>
                        </form>
                      ) : null}
                      {invoice.lines.length > 0 ? (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <p className="mb-1 text-xs font-medium text-slate-600">Lines</p>
                          <ul className="space-y-1">
                            {invoice.lines.map((line) => (
                              <li key={line.id} className="flex items-center justify-between gap-2 text-xs text-slate-700">
                                <span>
                                  {line.description} · {line.type}
                                </span>
                                <span className="font-medium">{money(line.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <Card title="Milestones update panel" subtitle="Update milestone dates and progress notes">
        <MilestoneTimeline
          shipmentId={shipment.id}
          milestones={shipment.milestones.map((milestone) => ({
            id: milestone.id,
            code: milestone.code,
            label: milestone.label,
            expectedAt: milestone.expectedAt ?? null,
            actualAt: milestone.actualAt ?? null,
            status: milestone.status,
            comment: milestone.comment ?? null,
          }))}
        />
      </Card>

      <Card title="Shipment control timeline" subtitle="Unified chronological feed across operations, finance, documents, alerts, and system changes">
        <ShipmentControlTimeline items={shipment.controlTimeline} />
      </Card>

      {canEditShipments ? (
        <Card title="Edit shipment operational data" subtitle="Operational form with current shipment values">
          <ShipmentForm
            action={updateShipmentAction}
            customers={customers}
            submitLabel="Update shipment"
            defaults={{
              id: shipment.id,
              shipmentNumber: shipment.shipmentNumber,
              customerId: shipment.customerId,
              quoteId: shipment.quoteId ?? undefined,
              quoteNumber: shipment.quoteNumber ?? undefined,
              incotermCode: shipment.incotermCode ?? "",
              serviceLevel: shipment.serviceLevel ?? "",
              commodity: shipment.commodity ?? "",
              mode: shipment.mode as "AIR" | "OCEAN" | "ROAD" | "COURIER",
              direction: shipment.direction as "IMPORT" | "EXPORT",
              status: shipment.status as
                | "DRAFT"
                | "BOOKING_REQUESTED"
                | "BOOKING_CONFIRMED"
                | "IN_TRANSIT"
                | "ARRIVED"
                | "CUSTOMS"
                | "DELIVERED"
                | "CLOSED"
                | "CANCELLED",
              originCode: shipment.originCode ?? "",
              destinationCode: shipment.destinationCode ?? "",
              pol: shipment.pol ?? "",
              pod: shipment.pod ?? "",
              airportOrigin: shipment.airportOrigin ?? "",
              airportDestination: shipment.airportDestination ?? "",
              placeOfReceipt: shipment.placeOfReceipt ?? "",
              placeOfDelivery: shipment.placeOfDelivery ?? "",
              shipperName: shipment.shipperName ?? "",
              consigneeName: shipment.consigneeName ?? "",
              notifyPartyName: shipment.notifyPartyName ?? "",
              agentOriginName: shipment.agentOriginName ?? "",
              agentDestinationName: shipment.agentDestinationName ?? "",
              carrierName: shipment.carrierName ?? "",
              vesselOrFlight: shipment.vesselOrFlight ?? "",
              bookingRef: shipment.bookingRef ?? "",
              houseRef: shipment.houseRef ?? "",
              masterRef: shipment.masterRef ?? "",
              referenceClient: shipment.referenceClient ?? "",
              referenceInternal: shipment.referenceInternal ?? "",
              packageCount: shipment.packageCount ?? undefined,
              packageType: shipment.packageType ?? "",
              grossWeightKg: shipment.grossWeightKg ?? "",
              chargeableWeightKg: shipment.chargeableWeightKg ?? "",
              volumeM3: shipment.volumeM3 ?? "",
              containerCount: shipment.containerCount ?? undefined,
              containerType: shipment.containerType ?? "",
              cargoReadyDate: shipment.cargoReadyDate
                ? new Date(shipment.cargoReadyDate).toISOString().slice(0, 16)
                : "",
              etd: shipment.etd ? new Date(shipment.etd).toISOString().slice(0, 16) : "",
              eta: shipment.eta ? new Date(shipment.eta).toISOString().slice(0, 16) : "",
              atd: shipment.atd ? new Date(shipment.atd).toISOString().slice(0, 16) : "",
              ata: shipment.ata ? new Date(shipment.ata).toISOString().slice(0, 16) : "",
              deliveredAt: shipment.deliveredAt
                ? new Date(shipment.deliveredAt).toISOString().slice(0, 16)
                : "",
              notes: shipment.notes ?? "",
            }}
          />
        </Card>
      ) : null}
    </div>
  );
}
