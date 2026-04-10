"use server";

import { z } from "zod";
import {
  DocumentRecordStatus,
  DocumentType,
  FinancialRecordStatus,
  MilestoneStatus,
  ShipmentCostCategory,
  ShipmentCostStatus,
} from "@prisma/client";

const TRANSPORT_MODES = ["AIR", "OCEAN", "ROAD", "COURIER"] as const;
const TRADE_DIRECTIONS = ["IMPORT", "EXPORT"] as const;
const SHIPMENT_STATUSES = [
  "DRAFT",
  "BOOKING_REQUESTED",
  "BOOKING_CONFIRMED",
  "IN_TRANSIT",
  "ARRIVED",
  "CUSTOMS",
  "DELIVERED",
  "CLOSED",
  "CANCELLED",
] as const;

export const shipmentSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().min(1),
  quoteId: z.string().optional(),
  mode: z.enum(TRANSPORT_MODES),
  direction: z.enum(TRADE_DIRECTIONS),
  status: z.enum(SHIPMENT_STATUSES),
  incotermCode: z.string().max(10).optional(),
  serviceLevel: z.string().max(120).optional(),
  originCode: z.string().max(32).optional(),
  destinationCode: z.string().max(32).optional(),
  pol: z.string().max(64).optional(),
  pod: z.string().max(64).optional(),
  airportOrigin: z.string().max(64).optional(),
  airportDestination: z.string().max(64).optional(),
  placeOfReceipt: z.string().max(120).optional(),
  placeOfDelivery: z.string().max(120).optional(),
  shipperName: z.string().max(180).optional(),
  consigneeName: z.string().max(180).optional(),
  notifyPartyName: z.string().max(180).optional(),
  agentOriginName: z.string().max(180).optional(),
  agentDestinationName: z.string().max(180).optional(),
  carrierName: z.string().max(180).optional(),
  vesselOrFlight: z.string().max(180).optional(),
  referenceClient: z.string().max(80).optional(),
  referenceInternal: z.string().max(80).optional(),
  bookingRef: z.string().max(80).optional(),
  houseRef: z.string().max(80).optional(),
  masterRef: z.string().max(80).optional(),
  commodity: z.string().max(160).optional(),
  packageCount: z.coerce.number().int().min(0).max(1_000_000).optional(),
  packageType: z.string().max(80).optional(),
  grossWeightKg: z.coerce.number().min(0).max(10_000_000).optional(),
  chargeableWeightKg: z.coerce.number().min(0).max(10_000_000).optional(),
  volumeM3: z.coerce.number().min(0).max(100_000).optional(),
  containerCount: z.coerce.number().int().min(0).max(100_000).optional(),
  containerType: z.string().max(80).optional(),
  cargoReadyDate: z.string().optional(),
  etd: z.string().optional(),
  eta: z.string().optional(),
  atd: z.string().optional(),
  ata: z.string().optional(),
  deliveredAt: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const milestoneUpdateSchema = z.object({
  shipmentId: z.string().min(1),
  code: z.string().min(1).max(60),
  label: z.string().min(1).max(140),
  expectedAt: z.string().optional(),
  actualAt: z.string().optional(),
  status: z.nativeEnum(MilestoneStatus).optional(),
  notes: z.string().max(600).optional(),
});

export const shipmentDocumentSchema = z.object({
  replaceOfId: z.string().optional(),
  shipmentId: z.string().min(1),
  docType: z.nativeEnum(DocumentType),
  referenceNumber: z.string().max(80).optional(),
  issueDate: z.string().optional(),
  status: z.nativeEnum(DocumentRecordStatus).optional(),
  notes: z.string().max(600).optional(),
});

export const triggerDocumentParsingSchema = z.object({
  shipmentId: z.string().min(1),
  shipmentDocumentId: z.string().min(1),
});

export const applyDocumentParsingSchema = z.object({
  shipmentId: z.string().min(1),
  parsingResultId: z.string().min(1),
  strategy: z.enum(["ONLY_EMPTY", "OVERRIDE_CONFLICTS"]).optional(),
  overrideFields: z.string().optional(),
});

export const revenueSchema = z.object({
  id: z.string().optional(),
  shipmentId: z.string().min(1),
  concept: z.string().min(2).max(160),
  amount: z.coerce.number().positive().max(100_000_000),
  currencyCode: z.enum(["USD", "EUR", "ARS"]),
  exchangeRate: z.coerce.number().positive().max(100_000).optional(),
  dueDate: z.string().optional(),
  status: z.nativeEnum(FinancialRecordStatus),
  notes: z.string().max(600).optional(),
});

export const expenseSchema = z.object({
  id: z.string().optional(),
  shipmentId: z.string().min(1),
  supplierName: z.string().min(2).max(180),
  concept: z.string().min(2).max(160),
  amount: z.coerce.number().positive().max(100_000_000),
  currencyCode: z.enum(["USD", "EUR", "ARS"]),
  exchangeRate: z.coerce.number().positive().max(100_000).optional(),
  dueDate: z.string().optional(),
  status: z.nativeEnum(FinancialRecordStatus),
  notes: z.string().max(600).optional(),
});

export const shipmentCostSchema = z.object({
  id: z.string().optional(),
  shipmentId: z.string().min(1),
  supplierName: z.string().min(2).max(180),
  conceptCategory: z.nativeEnum(ShipmentCostCategory),
  customConcept: z.string().max(160).optional(),
  amount: z.coerce.number().positive().max(100_000_000),
  currencyCode: z.enum(["USD", "EUR", "ARS"]),
  dueDate: z.string().optional(),
  status: z.nativeEnum(ShipmentCostStatus),
  notes: z.string().max(600).optional(),
});

export const invoiceCreateSchema = z.object({
  shipmentId: z.string().min(1),
  invoiceNumber: z.string().min(3).max(40).optional(),
  currencyCode: z.enum(["USD", "EUR", "ARS"]).optional(),
  lineDescription: z.string().min(2).max(220),
  lineAmount: z.coerce.number().positive().max(100_000_000),
  lineType: z.enum(["FREIGHT", "HANDLING", "CUSTOMS", "DOCUMENTATION", "OTHER"]),
  taxes: z.coerce.number().min(0).max(100_000_000).optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const invoiceLineUpsertSchema = z.object({
  id: z.string().min(1),
  shipmentId: z.string().min(1),
  lineId: z.string().optional(),
  lineDescription: z.string().min(2).max(220),
  lineAmount: z.coerce.number().positive().max(100_000_000),
  lineType: z.enum(["FREIGHT", "HANDLING", "CUSTOMS", "DOCUMENTATION", "OTHER"]),
  invoiceNumber: z.string().min(3).max(40).optional(),
  currencyCode: z.enum(["USD", "EUR", "ARS"]).optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const quoteConvertSchema = z.object({
  quoteId: z.string().min(1),
});
