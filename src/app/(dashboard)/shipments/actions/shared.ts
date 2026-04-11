import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DocumentRecordStatus,
  DocumentType,
  FinancialRecordStatus,
  MilestoneStatus,
  Prisma,
  ShipmentStatus,
  TradeDirection,
  TransportMode,
} from "@prisma/client";

import { enforceActionPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import type { ShipmentActionState } from "./types";

const BASE_CURRENCY = "USD";
const financialStatusOptions = Object.values(FinancialRecordStatus);
const documentStatusOptions = Object.values(DocumentRecordStatus);
const documentTypeOptions = Object.values(DocumentType);

export function normalizeOptional(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toDate(value?: string) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value");
  }
  return date;
}

export function toDecimal(value?: string | number | null) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Invalid numeric value");
    }
    return value;
  }
  const normalized = String(value).trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid numeric value");
  }
  return parsed;
}

export function resolveAmountBase({
  amount,
  currencyCode,
  exchangeRate,
}: {
  amount: number;
  currencyCode: string;
  exchangeRate: number | null;
}) {
  if (currencyCode === BASE_CURRENCY) {
    return amount;
  }
  if (!exchangeRate || exchangeRate <= 0) {
    throw new Error(`Exchange rate is required for ${currencyCode}`);
  }
  return amount * exchangeRate;
}

export function toMilestoneStatus(date: Date | null): MilestoneStatus {
  return date ? MilestoneStatus.COMPLETED : MilestoneStatus.PENDING;
}

const defaultMilestones: Array<{ code: string; label: string; isCritical: boolean }> = [
  { code: "QUOTE_APPROVED", label: "Quote Approved", isCritical: false },
  { code: "BOOKING_REQUESTED", label: "Booking Requested", isCritical: true },
  { code: "BOOKING_CONFIRMED", label: "Booking Confirmed", isCritical: true },
  { code: "CARGO_READY", label: "Cargo Ready", isCritical: true },
  { code: "DEPARTED", label: "Departed", isCritical: true },
  { code: "ARRIVED", label: "Arrived", isCritical: true },
  { code: "CUSTOMS_IN_PROGRESS", label: "Customs In Progress", isCritical: false },
  { code: "DELIVERED", label: "Delivered", isCritical: true },
  { code: "CLOSED", label: "Closed", isCritical: true },
];

export function getDefaultMilestones() {
  return defaultMilestones;
}

type MilestoneDates = {
  quoteApprovedAt: Date | null;
  cargoReadyDate: Date | null;
  atd: Date | null;
  ata: Date | null;
  deliveredAt: Date | null;
};

export function milestoneSeedData(shipmentId: string, dates: MilestoneDates) {
  return defaultMilestones.map((milestone) => {
    let expectedAt: Date | null = null;
    let actualAt: Date | null = null;
    let status: MilestoneStatus = MilestoneStatus.PENDING;

    if (milestone.code === "QUOTE_APPROVED") {
      expectedAt = dates.quoteApprovedAt;
      actualAt = dates.quoteApprovedAt;
      status = toMilestoneStatus(dates.quoteApprovedAt);
    }
    if (milestone.code === "CARGO_READY") {
      expectedAt = dates.cargoReadyDate;
      actualAt = dates.cargoReadyDate;
      status = toMilestoneStatus(dates.cargoReadyDate);
    }
    if (milestone.code === "DEPARTED") {
      expectedAt = dates.atd;
      actualAt = dates.atd;
      status = toMilestoneStatus(dates.atd);
    }
    if (milestone.code === "ARRIVED") {
      expectedAt = dates.ata;
      actualAt = dates.ata;
      status = toMilestoneStatus(dates.ata);
    }
    if (milestone.code === "DELIVERED") {
      expectedAt = dates.deliveredAt;
      actualAt = dates.deliveredAt;
      status = toMilestoneStatus(dates.deliveredAt);
    }
    if (milestone.code === "CLOSED" && dates.deliveredAt) {
      expectedAt = dates.deliveredAt;
    }

    return {
      shipmentId,
      code: milestone.code,
      label: milestone.label,
      expectedAt,
      actualAt,
      status,
      isCritical: milestone.isCritical,
    };
  });
}

export function validateShipmentDates({
  cargoReadyDate,
  etd,
  eta,
  atd,
  ata,
  deliveredAt,
}: {
  cargoReadyDate: Date | null;
  etd: Date | null;
  eta: Date | null;
  atd: Date | null;
  ata: Date | null;
  deliveredAt: Date | null;
}) {
  if (cargoReadyDate && etd && cargoReadyDate > etd) {
    throw new Error("Cargo Ready Date cannot be later than ETD");
  }
  if (etd && eta && etd > eta) {
    throw new Error("ETD cannot be later than ETA");
  }
  if (atd && ata && atd > ata) {
    throw new Error("ATD cannot be later than ATA");
  }
  if (etd && atd && atd < etd) {
    throw new Error("ATD cannot be earlier than ETD");
  }
  if (eta && ata && ata < eta) {
    throw new Error("ATA cannot be earlier than ETA");
  }
  if (deliveredAt && atd && deliveredAt < atd) {
    throw new Error("Delivered date cannot be earlier than ATD");
  }
}

export function validateOperationalStatusRules(
  status: ShipmentStatus,
  dates: {
    atd: Date | null;
    deliveredAt: Date | null;
    etd: Date | null;
    eta: Date | null;
    ata: Date | null;
  },
  refs: {
    bookingRef: string | null;
    houseRef: string | null;
    masterRef: string | null;
  },
) {
  if (status === ShipmentStatus.IN_TRANSIT && !dates.atd) {
    throw new Error("IN_TRANSIT requires ATD operational confirmation");
  }

  if (status === ShipmentStatus.DELIVERED && !dates.deliveredAt) {
    throw new Error("DELIVERED requires Delivered At date");
  }

  if (status === ShipmentStatus.CLOSED) {
    if (!dates.atd || !dates.ata || !dates.deliveredAt) {
      throw new Error("CLOSED requires ATD, ATA and Delivered At dates");
    }
    if (!refs.bookingRef || (!refs.houseRef && !refs.masterRef)) {
      throw new Error("CLOSED requires booking reference and house/master reference");
    }
  }
}

export function parseDocumentType(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().toUpperCase();
  const matched = documentTypeOptions.find((option) => option === normalized);
  if (!matched) {
    throw new Error("Invalid document type");
  }
  return matched;
}

export function parseFinancialStatus(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!financialStatusOptions.includes(normalized as FinancialRecordStatus)) {
    throw new Error("Invalid financial status");
  }
  return normalized as FinancialRecordStatus;
}

export function parseDocumentStatus(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!documentStatusOptions.includes(normalized as DocumentRecordStatus)) {
    throw new Error("Invalid document status");
  }
  return normalized as DocumentRecordStatus;
}

function sanitizeDocumentFileName(fileName: string) {
  const normalized = fileName.trim().replaceAll("\\", "/");
  const base = normalized.includes("/") ? normalized.slice(normalized.lastIndexOf("/") + 1) : normalized;
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned.slice(0, 180) : "document.bin";
}

export async function persistShipmentDocumentFile(input: { shipmentId: string; file: File }) {
  const cleanedFileName = sanitizeDocumentFileName(input.file.name);
  const extension = path.extname(cleanedFileName) || ".bin";
  const storedFileName = `${Date.now()}-${randomUUID()}${extension}`;
  const relativeDir = path.join("uploads", "shipments", input.shipmentId);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });

  const bytes = Buffer.from(await input.file.arrayBuffer());
  await writeFile(path.join(absoluteDir, storedFileName), bytes);

  return {
    fileName: cleanedFileName,
    fileUrl: `/${relativeDir.replaceAll(path.sep, "/")}/${storedFileName}`,
  };
}

export async function assertShipmentAccess(companyId: string, shipmentId: string) {
  const shipment = await prisma.shipment.findFirst({
    where: {
      id: shipmentId,
      companyId,
    },
    select: {
      id: true,
      customerId: true,
    },
  });
  if (!shipment) {
    throw new Error("Shipment not found");
  }
  return shipment;
}

function resolveShipmentPrefix(mode: TransportMode, direction: TradeDirection) {
  const normalizedDirection = direction === TradeDirection.IMPORT ? "IMPORT" : "EXPORT";
  if (mode === TransportMode.AIR) {
    return normalizedDirection === "IMPORT" ? "CAI" : "CAE";
  }
  if (mode === TransportMode.OCEAN) {
    return normalizedDirection === "IMPORT" ? "CMI" : "CME";
  }
  if (mode === TransportMode.ROAD) {
    return normalizedDirection === "IMPORT" ? "TTI" : "TTE";
  }
  if (mode === TransportMode.COURIER) {
    return normalizedDirection === "IMPORT" ? "COI" : "COE";
  }
  throw new Error("Shipment numbering is only available for AIR, OCEAN, ROAD or COURIER");
}

export async function nextShipmentNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
  mode: TransportMode,
  direction: TradeDirection,
) {
  const prefix = resolveShipmentPrefix(mode, direction);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const counter = await tx.shipmentNumberCounter.upsert({
      where: {
        companyId_prefix: {
          companyId,
          prefix,
        },
      },
      create: {
        companyId,
        prefix,
        nextValue: 2,
      },
      update: {
        nextValue: { increment: 1 },
      },
      select: { nextValue: true },
    });
    const sequence = counter.nextValue - 1;
    const candidate = `${prefix}${String(sequence).padStart(3, "0")}`;
    const exists = await tx.shipment.findFirst({
      where: {
        companyId,
        shipmentNumber: candidate,
      },
      select: { id: true },
    });
    if (!exists) {
      return candidate;
    }
  }
  throw new Error("Unable to generate a unique shipment number");
}

export async function getContext(
  resource: "SHIPMENTS" | "MILESTONES" = "SHIPMENTS",
  action: "CREATE" | "EDIT" | "DELETE" = "EDIT",
) {
  if (resource === "MILESTONES") {
    return enforceActionPermission("SHIPMENTS", action);
  }
  return enforceActionPermission(resource, action);
}

export function wrapDirectAction(
  action: (_prevState: ShipmentActionState, formData: FormData) => Promise<ShipmentActionState>,
  fallbackMessage: string,
) {
  return async (formData: FormData): Promise<void> => {
    const result = await action({ success: false }, formData);
    if (!result.success) {
      throw new Error(result.error ?? fallbackMessage);
    }
  };
}
