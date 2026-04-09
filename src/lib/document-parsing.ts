import {
  DocumentParsingStatus,
  DocumentType,
  type AlertSeverity,
  type AlertType,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runAlertChecksForShipmentUpdate } from "@/lib/alerts";

export type ParsedShipmentDocumentData = {
  shipperName: string | null;
  consigneeName: string | null;
  notifyPartyName: string | null;
  grossWeightKg: number | null;
  packageCount: number | null;
  houseRef: string | null;
  masterRef: string | null;
  originCode: string | null;
  destinationCode: string | null;
  vesselOrFlight: string | null;
};

type ParseResult = {
  status: DocumentParsingStatus;
  parsed: ParsedShipmentDocumentData;
};

type FieldDiff = {
  field: keyof ParsedShipmentDocumentData;
  current: string | number | null;
  parsed: string | number | null;
};

type FieldApplyStrategy = "ONLY_EMPTY" | "OVERRIDE_CONFLICTS";

type AlertInput = {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
};

export type ApplyParsedDocumentInput = {
  companyId: string;
  userId: string;
  parsingResultId: string;
  strategy?: FieldApplyStrategy;
  confirmedOverrideFields?: Array<keyof ParsedShipmentDocumentData>;
};

export type ApplyParsedDocumentResult = {
  shipmentId: string;
  updatedFieldNames: Array<keyof ParsedShipmentDocumentData>;
  conflicts: FieldDiff[];
  skippedFields: Array<keyof ParsedShipmentDocumentData>;
};

export type DocumentParsingFeedRow = {
  id: string;
  shipmentDocumentId: string;
  documentType: DocumentType;
  status: DocumentParsingStatus;
  createdAt: Date;
  parsed: ParsedShipmentDocumentData | null;
};

type ParseShipmentDocumentResult = {
  id: string;
  shipmentDocumentId: string;
  documentType: DocumentType;
  status: DocumentParsingStatus;
  parsedJson: Prisma.JsonValue | null;
  createdAt: Date;
  shipmentId: string;
  shipmentNumber: string;
  fileName: string;
  alert?: AlertInput;
};

function normalizeText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return Number.isFinite(value) ? value : null;
}

function toJsonCompatible(value: string | number | null): Prisma.InputJsonValue {
  if (value === null) return "";
  return value;
}

function getTypeInferenceFromDocument(docType: DocumentType) {
  if (docType === DocumentType.BL) return "OCEAN";
  if (docType === DocumentType.AWB) return "AIR";
  return null;
}

function inferOriginAndDestinationFromFilename(fileName: string) {
  const lowered = fileName.toLowerCase();
  const airports = ["sha", "pvg", "bue", "eze", "mia", "gru", "scl", "mad", "fra"];
  const ports = ["shanghai", "buenos", "miami", "santos", "valparaiso"];

  for (const token of airports) {
    if (lowered.includes(token)) {
      if (token === "sha" || token === "pvg") return { originCode: "SHA", destinationCode: null };
      if (token === "bue" || token === "eze") return { originCode: null, destinationCode: "BUE" };
    }
  }
  for (const token of ports) {
    if (lowered.includes(token)) {
      if (token === "shanghai") return { originCode: "SHA", destinationCode: null };
      if (token === "buenos") return { originCode: null, destinationCode: "BUE" };
    }
  }

  return { originCode: null, destinationCode: null };
}

function inferRefsFromFilename(fileName: string, docType: DocumentType) {
  const upper = fileName.toUpperCase();
  const cleaned = upper.replace(/[^A-Z0-9]/g, " ");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const compact = upper.replace(/[^A-Z0-9]/g, "");

  const awbToken = tokens.find((token) => /\d{3,}-?\d{6,}/.test(token));
  const blToken = tokens.find((token) => /BL\d{4,}|HBL\d{4,}|MBL\d{4,}/.test(token));
  const genericRef = tokens.find((token) => token.length >= 6 && /\d/.test(token));

  if (docType === DocumentType.AWB) {
    const awbRef = awbToken ?? genericRef ?? (compact.length >= 8 ? compact.slice(-12) : null);
    return { houseRef: awbRef, masterRef: awbRef };
  }

  if (docType === DocumentType.BL) {
    const blRef = blToken ?? genericRef ?? (compact.length >= 8 ? compact.slice(-12) : null);
    return { houseRef: blRef, masterRef: blRef };
  }

  return { houseRef: null, masterRef: null };
}

function parseMockedDocument(input: {
  docType: DocumentType;
  fileName: string;
  referenceNumber: string | null;
}): ParseResult {
  const inferredRoute = inferOriginAndDestinationFromFilename(input.fileName);
  const inferredRefs = inferRefsFromFilename(input.fileName, input.docType);
  const modeHint = getTypeInferenceFromDocument(input.docType);

  const shipperName =
    input.docType === DocumentType.COMMERCIAL_INVOICE || input.docType === DocumentType.PACKING_LIST
      ? "Parsed shipper (mock)"
      : null;
  const consigneeName =
    input.docType === DocumentType.COMMERCIAL_INVOICE || input.docType === DocumentType.PACKING_LIST
      ? "Parsed consignee (mock)"
      : null;

  const parsed: ParsedShipmentDocumentData = {
    shipperName,
    consigneeName,
    notifyPartyName: input.docType === DocumentType.BL || input.docType === DocumentType.AWB
      ? "Parsed notify (mock)"
      : null,
    grossWeightKg:
      input.docType === DocumentType.PACKING_LIST || input.docType === DocumentType.COMMERCIAL_INVOICE
        ? 500
        : null,
    packageCount:
      input.docType === DocumentType.PACKING_LIST || input.docType === DocumentType.COMMERCIAL_INVOICE
        ? 2
        : null,
    houseRef: normalizeText(input.referenceNumber) ?? normalizeText(inferredRefs.houseRef),
    masterRef: normalizeText(input.referenceNumber) ?? normalizeText(inferredRefs.masterRef),
    originCode: inferredRoute.originCode ?? (modeHint === "AIR" ? "SHA" : null),
    destinationCode: inferredRoute.destinationCode ?? (modeHint === "AIR" ? "BUE" : null),
    vesselOrFlight:
      input.docType === DocumentType.AWB
        ? "AWB flight parsed (mock)"
        : input.docType === DocumentType.BL
          ? "BL vessel parsed (mock)"
          : null,
  };

  const hasAnyParsedValue = Object.values(parsed).some((value) => value !== null);
  return {
    status: hasAnyParsedValue ? DocumentParsingStatus.PARSED : DocumentParsingStatus.REVIEW_REQUIRED,
    parsed,
  };
}

function getFieldDiffs(
  shipment: {
    shipperName: string | null;
    consigneeName: string | null;
    notifyPartyName: string | null;
    grossWeightKg: Prisma.Decimal | null;
    packageCount: number | null;
    houseRef: string | null;
    masterRef: string | null;
    originCode: string | null;
    destinationCode: string | null;
    vesselOrFlight: string | null;
  },
  parsed: ParsedShipmentDocumentData,
) {
  const currentMap: Record<keyof ParsedShipmentDocumentData, string | number | null> = {
    shipperName: normalizeText(shipment.shipperName),
    consigneeName: normalizeText(shipment.consigneeName),
    notifyPartyName: normalizeText(shipment.notifyPartyName),
    grossWeightKg: shipment.grossWeightKg ? Number(shipment.grossWeightKg) : null,
    packageCount: shipment.packageCount ?? null,
    houseRef: normalizeText(shipment.houseRef),
    masterRef: normalizeText(shipment.masterRef),
    originCode: normalizeText(shipment.originCode),
    destinationCode: normalizeText(shipment.destinationCode),
    vesselOrFlight: normalizeText(shipment.vesselOrFlight),
  };

  const conflicts: FieldDiff[] = [];
  const updates: Prisma.ShipmentUpdateInput = {};
  const updatedFieldNames: Array<keyof ParsedShipmentDocumentData> = [];
  const skippedFields: Array<keyof ParsedShipmentDocumentData> = [];

  (Object.keys(parsed) as Array<keyof ParsedShipmentDocumentData>).forEach((field) => {
    const parsedValue = parsed[field];
    if (parsedValue === null) return;
    const currentValue = currentMap[field];
    if (currentValue === null || currentValue === "") {
      updates[field] = toJsonCompatible(parsedValue);
      updatedFieldNames.push(field);
      return;
    }
    if (String(currentValue) === String(parsedValue)) {
      return;
    }
    conflicts.push({ field, current: currentValue, parsed: parsedValue });
    skippedFields.push(field);
  });

  return { conflicts, updates, updatedFieldNames, skippedFields };
}

export async function parseShipmentDocumentWithMock(input: {
  companyId: string;
  userId: string;
  shipmentDocumentId: string;
}) {
  const doc = await prisma.shipmentDocument.findFirst({
    where: {
      id: input.shipmentDocumentId,
      shipment: { companyId: input.companyId },
    },
    select: {
      id: true,
      docType: true,
      fileName: true,
      referenceNumber: true,
      issueDate: true,
      shipmentId: true,
      shipment: {
        select: {
          shipmentNumber: true,
        },
      },
    },
  });

  if (!doc) {
    throw new Error("Document not found");
  }

  let status = DocumentParsingStatus.FAILED;
  let parsedJson: Prisma.InputJsonValue | null = null;

  try {
    const parsed = parseMockedDocument({
      docType: doc.docType,
      fileName: doc.fileName,
      referenceNumber: doc.referenceNumber,
    });
    status = parsed.status;
    parsedJson = parsed.parsed as unknown as Prisma.InputJsonValue;
  } catch {
    status = DocumentParsingStatus.FAILED;
    parsedJson = null;
  }

  const result = await prisma.documentParsingResult.create({
    data: {
      shipmentDocumentId: doc.id,
      documentType: doc.docType,
      parsedJson,
      status,
    },
  });

  await prisma.activityLog.create({
    data: {
      companyId: input.companyId,
      entityType: "DOCUMENT",
      entityId: doc.id,
      action: "UPDATE",
      actorId: input.userId,
      afterJson: {
        event: "DOCUMENT_PARSED",
        parsingResultId: result.id,
        status: result.status,
        documentType: doc.docType,
      },
    },
  });

  return result;
}

export async function applyParsedDocumentToShipment(input: ApplyParsedDocumentInput): Promise<ApplyParsedDocumentResult> {
  const strategy = input.strategy ?? "ONLY_EMPTY";
  const overrideSet = new Set(input.confirmedOverrideFields ?? []);

  const parsing = await prisma.documentParsingResult.findFirst({
    where: {
      id: input.parsingResultId,
      shipmentDocument: {
        shipment: {
          companyId: input.companyId,
        },
      },
    },
    select: {
      id: true,
      status: true,
      parsedJson: true,
      shipmentDocument: {
        select: {
          id: true,
          shipmentId: true,
          fileName: true,
          docType: true,
          shipment: {
            select: {
              id: true,
              shipmentNumber: true,
              shipperName: true,
              consigneeName: true,
              notifyPartyName: true,
              grossWeightKg: true,
              packageCount: true,
              houseRef: true,
              masterRef: true,
              originCode: true,
              destinationCode: true,
              vesselOrFlight: true,
            },
          },
        },
      },
    },
  });

  if (!parsing) {
    throw new Error("Parsing result not found");
  }
  if (!parsing.parsedJson || typeof parsing.parsedJson !== "object") {
    throw new Error("Parsing result has no parsed data");
  }

  const parsedData = parsing.parsedJson as ParsedShipmentDocumentData;
  const { conflicts, updates, updatedFieldNames, skippedFields } = getFieldDiffs(parsing.shipmentDocument.shipment, {
    shipperName: normalizeText(parsedData.shipperName),
    consigneeName: normalizeText(parsedData.consigneeName),
    notifyPartyName: normalizeText(parsedData.notifyPartyName),
    grossWeightKg: normalizeNumber(parsedData.grossWeightKg),
    packageCount: normalizeNumber(parsedData.packageCount),
    houseRef: normalizeText(parsedData.houseRef),
    masterRef: normalizeText(parsedData.masterRef),
    originCode: normalizeText(parsedData.originCode),
    destinationCode: normalizeText(parsedData.destinationCode),
    vesselOrFlight: normalizeText(parsedData.vesselOrFlight),
  });

  if (conflicts.length > 0 && strategy === "ONLY_EMPTY") {
    await prisma.documentParsingResult.update({
      where: { id: parsing.id },
      data: { status: DocumentParsingStatus.REVIEW_REQUIRED },
    });
    return {
      shipmentId: parsing.shipmentDocument.shipmentId,
      updatedFieldNames,
      conflicts,
      skippedFields,
    };
  }

  if (conflicts.length > 0 && strategy === "OVERRIDE_CONFLICTS") {
    for (const conflict of conflicts) {
      if (!overrideSet.has(conflict.field)) continue;
      updates[conflict.field] = toJsonCompatible(conflict.parsed);
      updatedFieldNames.push(conflict.field);
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.shipment.update({
      where: { id: parsing.shipmentDocument.shipmentId },
      data: updates,
    });
  }

  await prisma.documentParsingResult.update({
    where: { id: parsing.id },
    data: {
      status: conflicts.length > 0 && strategy === "ONLY_EMPTY"
        ? DocumentParsingStatus.REVIEW_REQUIRED
        : DocumentParsingStatus.PARSED,
    },
  });

  await prisma.activityLog.create({
    data: {
      companyId: input.companyId,
      entityType: "SHIPMENT",
      entityId: parsing.shipmentDocument.shipmentId,
      action: "UPDATE",
      actorId: input.userId,
      afterJson: {
        event: "DOCUMENT_PARSED_APPLIED",
        parsingResultId: parsing.id,
        documentId: parsing.shipmentDocument.id,
        updatedFieldNames,
        skippedFields,
      },
    },
  });

  await runAlertChecksForShipmentUpdate({
    companyId: input.companyId,
    shipmentId: parsing.shipmentDocument.shipmentId,
  });

  return {
    shipmentId: parsing.shipmentDocument.shipmentId,
    updatedFieldNames,
    conflicts,
    skippedFields,
  };
}

export async function listDocumentParsingResultsForShipment(
  companyId: string,
  shipmentId: string,
): Promise<DocumentParsingFeedRow[]> {
  const rows = await prisma.documentParsingResult.findMany({
    where: {
      shipmentDocument: {
        shipmentId,
        shipment: {
          companyId,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      shipmentDocumentId: true,
      documentType: true,
      status: true,
      createdAt: true,
      parsedJson: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    shipmentDocumentId: row.shipmentDocumentId,
    documentType: row.documentType,
    status: row.status,
    createdAt: row.createdAt,
    parsed:
      row.parsedJson && typeof row.parsedJson === "object"
        ? (row.parsedJson as unknown as ParsedShipmentDocumentData)
        : null,
  }));
}
