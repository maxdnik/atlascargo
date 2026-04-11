import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  GeneralExpenseCategory,
  GeneralExpenseStatus,
  PermissionAction,
  PermissionResource,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { baseRolePermissionMatrix, roleDisplayName } from "@/lib/permission-config";
import { resourceActionHints } from "@/lib/permission-hints";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run prisma seed");
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: connectionString }),
});

async function main() {
  const passwordHash = await bcrypt.hash("Admin123!", 10);

  const company = await prisma.company.upsert({
    where: { id: "comp_atlascargo" },
    update: {},
    create: {
      id: "comp_atlascargo",
      legalName: "Atlas Cargo Logistics S.A.",
      tradeName: "Atlas Cargo",
      taxId: "30-71234567-9",
      country: "AR",
      timezone: "America/Argentina/Buenos_Aires",
    },
  });

  const branchBA = await prisma.branch.upsert({
    where: { id: "branch_ba" },
    update: {},
    create: {
      id: "branch_ba",
      companyId: company.id,
      code: "BUE",
      name: "Buenos Aires",
      city: "Buenos Aires",
      country: "AR",
      active: true,
    },
  });

  await prisma.branch.upsert({
    where: { id: "branch_mvd" },
    update: {},
    create: {
      id: "branch_mvd",
      companyId: company.id,
      code: "MVD",
      name: "Montevideo",
      city: "Montevideo",
      country: "UY",
      active: true,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: "admin@atlascargo.local" } },
    update: {},
    create: {
      id: "user_admin",
      companyId: company.id,
      email: "admin@atlascargo.local",
      name: "Platform Admin",
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  await prisma.userRoleAssignment.deleteMany({
    where: {
      userId: adminUser.id,
    },
  });

  const allPermissions = await Promise.all(
    Object.values(PermissionResource).flatMap((resource) =>
      Object.values(PermissionAction).map(async (action) => {
        const isRelevant = resourceActionHints[resource].includes(action);
        return prisma.permission.upsert({
          where: { resource_action: { resource, action } },
          update: {
            description: isRelevant ? `${resource} · ${action}` : `Optional: ${resource} · ${action}`,
          },
          create: {
            resource,
            action,
            description: isRelevant ? `${resource} · ${action}` : `Optional: ${resource} · ${action}`,
          },
        });
      }),
    ),
  );

  const permissionByKey = new Map(
    allPermissions.map((permission) => [`${permission.resource}:${permission.action}`, permission.id]),
  );

  const systemRoles = await Promise.all(
    Object.values(UserRole).map((role) =>
      prisma.role.upsert({
        where: {
          companyId_code: {
            companyId: company.id,
            code: role,
          },
        },
        update: {
          name: roleDisplayName[role],
          isSystem: true,
        },
        create: {
          companyId: company.id,
          code: role,
          name: roleDisplayName[role],
          description: `${roleDisplayName[role]} system role`,
          isSystem: true,
        },
      }),
    ),
  );

  const roleByCode = new Map(systemRoles.map((role) => [role.code, role.id]));

  for (const role of Object.values(UserRole)) {
    const roleId = roleByCode.get(role);
    if (!roleId) continue;

    await prisma.rolePermission.deleteMany({ where: { roleId } });

    const grants = baseRolePermissionMatrix[role] ?? [];
    if (grants.length > 0) {
      await prisma.rolePermission.createMany({
        data: grants
          .map(([resource, action]) => permissionByKey.get(`${resource}:${action}`))
          .filter((permissionId): permissionId is string => Boolean(permissionId))
          .map((permissionId) => ({ roleId, permissionId })),
      });
    }
  }

  const adminRoleId = roleByCode.get(UserRole.SUPER_ADMIN);
  if (adminRoleId) {
    await prisma.userRoleAssignment.create({
      data: {
        userId: adminUser.id,
        roleId: adminRoleId,
      },
    });
  }

  await prisma.userBranchAccess.upsert({
    where: { userId_branchId: { userId: adminUser.id, branchId: branchBA.id } },
    update: {},
    create: {
      userId: adminUser.id,
      branchId: branchBA.id,
      canViewFinance: true,
      canApprove: true,
    },
  });

  await prisma.currency.upsert({
    where: { code: "USD" },
    update: { name: "US Dollar", symbol: "$", decimals: 2, active: true },
    create: { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, active: true },
  });
  await prisma.currency.upsert({
    where: { code: "EUR" },
    update: { name: "Euro", symbol: "EUR", decimals: 2, active: true },
    create: { code: "EUR", name: "Euro", symbol: "EUR", decimals: 2, active: true },
  });
  await prisma.currency.upsert({
    where: { code: "ARS" },
    update: { name: "Argentine Peso", symbol: "AR$", decimals: 2, active: true },
    create: { code: "ARS", name: "Argentine Peso", symbol: "AR$", decimals: 2, active: true },
  });

  await prisma.incoterm.upsert({
    where: { code: "EXW" },
    update: { description: "Ex Works", active: true },
    create: { code: "EXW", description: "Ex Works", active: true },
  });
  await prisma.incoterm.upsert({
    where: { code: "FOB" },
    update: { description: "Free On Board", active: true },
    create: { code: "FOB", description: "Free On Board", active: true },
  });
  await prisma.incoterm.upsert({
    where: { code: "CIF" },
    update: { description: "Cost, Insurance and Freight", active: true },
    create: { code: "CIF", description: "Cost, Insurance and Freight", active: true },
  });
  await prisma.incoterm.upsert({
    where: { code: "DDP" },
    update: { description: "Delivered Duty Paid", active: true },
    create: { code: "DDP", description: "Delivered Duty Paid", active: true },
  });
  await prisma.incoterm.upsert({
    where: { code: "FCA" },
    update: { description: "Free Carrier", active: true },
    create: { code: "FCA", description: "Free Carrier", active: true },
  });
  await prisma.incoterm.upsert({
    where: { code: "CPT" },
    update: { description: "Carriage Paid To", active: true },
    create: { code: "CPT", description: "Carriage Paid To", active: true },
  });

  const [portSha, portBue] = await Promise.all([
    prisma.port.upsert({
      where: { id: "port_shanghai" },
      update: {},
      create: {
        id: "port_shanghai",
        code: "CNSHA",
        name: "Shanghai",
        country: "CN",
        active: true,
      },
    }),
    prisma.port.upsert({
      where: { id: "port_buenos_aires" },
      update: {},
      create: {
        id: "port_buenos_aires",
        code: "ARBUE",
        name: "Buenos Aires",
        country: "AR",
        active: true,
      },
    }),
  ]);

  const [airportMia, airportEze] = await Promise.all([
    prisma.airport.upsert({
      where: { id: "airport_mia" },
      update: {},
      create: {
        id: "airport_mia",
        iataCode: "MIA",
        name: "Miami International Airport",
        city: "Miami",
        country: "US",
        active: true,
      },
    }),
    prisma.airport.upsert({
      where: { id: "airport_eze" },
      update: {},
      create: {
        id: "airport_eze",
        iataCode: "EZE",
        name: "Ministro Pistarini International Airport",
        city: "Buenos Aires",
        country: "AR",
        active: true,
      },
    }),
  ]);

  const [carrierAir, carrierOcean, supplierCustoms] = await Promise.all([
    prisma.businessPartner.upsert({
      where: { id: "bp_lh_cargo" },
      update: {},
      create: {
        id: "bp_lh_cargo",
        companyId: company.id,
        partnerType: "CARRIER",
        name: "Lufthansa Cargo",
        country: "DE",
        active: true,
      },
    }),
    prisma.businessPartner.upsert({
      where: { id: "bp_maersk" },
      update: {},
      create: {
        id: "bp_maersk",
        companyId: company.id,
        partnerType: "CARRIER",
        name: "Maersk",
        country: "DK",
        active: true,
      },
    }),
    prisma.businessPartner.upsert({
      where: { id: "bp_customs_partner" },
      update: {},
      create: {
        id: "bp_customs_partner",
        companyId: company.id,
        partnerType: "CUSTOMS_BROKER",
        name: "Andes Customs Broker",
        country: "AR",
        active: true,
      },
    }),
  ]);

  const customerAirImport = await prisma.customer.upsert({
    where: { companyId_code: { companyId: company.id, code: "CUST-ACME" } },
    update: {},
    create: {
      id: "cust_acme",
      companyId: company.id,
      branchId: branchBA.id,
      code: "CUST-ACME",
      legalName: "Acme Electronics Argentina S.A.",
      tradeName: "Acme Electronics",
      taxId: "30-70987654-1",
      country: "AR",
      city: "Buenos Aires",
      address: "Av. Corrientes 1543",
      paymentTermsDays: 30,
      isActive: true,
    },
  });

  const customerOceanExport = await prisma.customer.upsert({
    where: { companyId_code: { companyId: company.id, code: "CUST-PAMPA" } },
    update: {},
    create: {
      id: "cust_pampa",
      companyId: company.id,
      branchId: branchBA.id,
      code: "CUST-PAMPA",
      legalName: "Pampa Agro Export S.R.L.",
      tradeName: "Pampa Agro",
      taxId: "30-70123456-7",
      country: "AR",
      city: "Rosario",
      address: "Ruta AO12 Km 4",
      paymentTermsDays: 21,
      isActive: true,
    },
  });

  await prisma.contact.upsert({
    where: { id: "contact_acme_lucia" },
    update: {},
    create: {
      id: "contact_acme_lucia",
      customerId: customerAirImport.id,
      fullName: "Lucia Fernandez",
      email: "lfernandez@acme.com",
      phone: "+54 11 4555 1111",
      position: "Import Manager",
      isPrimary: true,
    },
  });

  await prisma.contact.upsert({
    where: { id: "contact_pampa_martin" },
    update: {},
    create: {
      id: "contact_pampa_martin",
      customerId: customerOceanExport.id,
      fullName: "Martin Alvarez",
      email: "malvarez@pampaagro.com",
      phone: "+54 341 522 1000",
      position: "Export Coordinator",
      isPrimary: true,
    },
  });

  await prisma.quote.upsert({
    where: {
      companyId_quoteNumber: { companyId: company.id, quoteNumber: "Q-2026-0001" },
    },
    update: {},
    create: {
      id: "quote_2026_0001",
      companyId: company.id,
      branchId: branchBA.id,
      quoteNumber: "Q-2026-0001",
      customerId: customerAirImport.id,
      ownerUserId: adminUser.id,
      mode: "AIR",
      direction: "IMPORT",
      status: "APPROVED",
      incotermCode: "CPT",
      originCode: "MIA",
      destinationCode: "BUE",
      airportOrigin: "MIA",
      airportDestination: "EZE",
      placeOfReceipt: "Miami, FL",
      placeOfDelivery: "Buenos Aires, AR",
      commodity: "Electronic Components",
      validUntil: new Date("2026-05-01T00:00:00.000Z"),
      currencyCode: "USD",
      totalBuy: "2350.00",
      totalSell: "3050.00",
      marginAmount: "700.00",
      marginPct: "0.2295",
      approvedAt: new Date("2026-04-02T15:30:00.000Z"),
    },
  });

  const shipmentAirImport = await prisma.shipment.upsert({
    where: {
      companyId_shipmentNumber: { companyId: company.id, shipmentNumber: "SHP-2026-0001" },
    },
    update: {},
    create: {
      id: "shp_air_import_0001",
      companyId: company.id,
      branchId: branchBA.id,
      shipmentNumber: "SHP-2026-0001",
      customerId: customerAirImport.id,
      quoteId: "quote_2026_0001",
      ownerUserId: adminUser.id,
      mode: "AIR",
      direction: "IMPORT",
      status: "IN_TRANSIT",
      originCode: "MIA",
      destinationCode: "BUE",
      airportOrigin: "MIA",
      airportDestination: "EZE",
      placeOfReceipt: "Miami Airport Terminal",
      placeOfDelivery: "Acme WH - Buenos Aires",
      shipperName: "Acme Electronics US LLC",
      consigneeName: "Acme Electronics Argentina S.A.",
      notifyPartyName: "Acme Import Desk",
      agentOriginName: "Atlas Cargo Miami Agent",
      agentDestinationName: "Atlas Cargo Buenos Aires",
      carrierName: "Lufthansa Cargo",
      vesselOrFlight: "LH511",
      incotermCode: "CPT",
      serviceLevel: "Airport to Door",
      referenceClient: "ACME-PO-45021",
      referenceInternal: "OPS-AIR-0426-01",
      bookingRef: "LH-BKG-77811",
      houseRef: "HAWB-045-77881122",
      masterRef: "MAWB-020-45678901",
      commodity: "Electronic Components",
      packageCount: 24,
      packageType: "CTN",
      grossWeightKg: "980.500",
      chargeableWeightKg: "1020.000",
      volumeM3: "6.200",
      cargoReadyDate: new Date("2026-04-04T20:00:00.000Z"),
      etd: new Date("2026-04-05T11:00:00.000Z"),
      eta: new Date("2026-04-09T10:30:00.000Z"),
      atd: new Date("2026-04-05T11:45:00.000Z"),
      containerCount: 0,
      containerType: "N/A",
      originAirportId: airportMia.id,
      destinationAirportId: airportEze.id,
      notes: "DG not applicable. Priority customs release requested.",
    },
  });

  const shipmentOceanExport = await prisma.shipment.upsert({
    where: {
      companyId_shipmentNumber: { companyId: company.id, shipmentNumber: "SHP-2026-0002" },
    },
    update: {},
    create: {
      id: "shp_ocean_export_0002",
      companyId: company.id,
      branchId: branchBA.id,
      shipmentNumber: "SHP-2026-0002",
      customerId: customerOceanExport.id,
      ownerUserId: adminUser.id,
      mode: "OCEAN",
      direction: "EXPORT",
      status: "BOOKING_REQUESTED",
      originCode: "ROS",
      destinationCode: "SHA",
      pol: "ARBUE",
      pod: "CNSHA",
      placeOfReceipt: "Rosario Plant",
      placeOfDelivery: "Shanghai Port",
      shipperName: "Pampa Agro Export S.R.L.",
      consigneeName: "Shanghai Grain Trading Co.",
      notifyPartyName: "Pampa Asia Desk",
      agentOriginName: "Atlas Cargo Rosario",
      agentDestinationName: "Atlas Cargo Shanghai Agent",
      carrierName: "Maersk",
      vesselOrFlight: "MSK ARGENTINA V.120E",
      incotermCode: "FOB",
      serviceLevel: "Port to Port",
      referenceClient: "PAMPA-EXP-2404",
      referenceInternal: "OPS-OCE-0426-03",
      bookingRef: "MSK-BKG-33109",
      houseRef: "HBL-ARBUE-CNSHA-00921",
      masterRef: "MBL-MSK-77893021",
      commodity: "Soybean Meal",
      packageCount: 2_000,
      packageType: "BAG",
      grossWeightKg: "52000.000",
      volumeM3: "78.500",
      containerCount: 2,
      containerType: "40HC",
      cargoReadyDate: new Date("2026-04-10T15:00:00.000Z"),
      etd: new Date("2026-04-12T20:00:00.000Z"),
      eta: new Date("2026-05-18T08:00:00.000Z"),
      polPortId: portBue.id,
      podPortId: portSha.id,
      notes: "Export docs under chamber of commerce review.",
    },
  });

  await prisma.shipmentLeg.upsert({
    where: { id: "leg_air_0001_1" },
    update: {},
    create: {
      id: "leg_air_0001_1",
      shipmentId: shipmentAirImport.id,
      sequence: 1,
      mode: "AIR",
      originAirportId: airportMia.id,
      destinationAirportId: airportEze.id,
      carrierPartnerId: carrierAir.id,
      vesselFlight: "LH511",
      etd: new Date("2026-04-05T11:00:00.000Z"),
      eta: new Date("2026-04-09T10:30:00.000Z"),
      atd: new Date("2026-04-05T11:45:00.000Z"),
    },
  });

  await prisma.shipmentLeg.upsert({
    where: { id: "leg_ocean_0002_1" },
    update: {},
    create: {
      id: "leg_ocean_0002_1",
      shipmentId: shipmentOceanExport.id,
      sequence: 1,
      mode: "OCEAN",
      originPortId: portBue.id,
      destinationPortId: portSha.id,
      carrierPartnerId: carrierOcean.id,
      vesselFlight: "MSK ARGENTINA V.120E",
      etd: new Date("2026-04-12T20:00:00.000Z"),
      eta: new Date("2026-05-18T08:00:00.000Z"),
    },
  });

  await prisma.shipmentMilestone.upsert({
    where: { id: "ms_air_0001_booking" },
    update: {},
    create: {
      id: "ms_air_0001_booking",
      shipmentId: shipmentAirImport.id,
      code: "BOOKING_CONFIRMED",
      label: "Booking Confirmed",
      expectedAt: new Date("2026-04-02T12:00:00.000Z"),
      actualAt: new Date("2026-04-02T11:42:00.000Z"),
      status: "COMPLETED",
      isCritical: true,
      assignedToId: adminUser.id,
    },
  });

  await prisma.shipmentMilestone.upsert({
    where: { id: "ms_air_0001_departed" },
    update: {},
    create: {
      id: "ms_air_0001_departed",
      shipmentId: shipmentAirImport.id,
      code: "DEPARTED",
      label: "Flight Departed",
      expectedAt: new Date("2026-04-05T11:00:00.000Z"),
      actualAt: new Date("2026-04-05T11:45:00.000Z"),
      status: "COMPLETED",
      isCritical: true,
      assignedToId: adminUser.id,
    },
  });

  await prisma.shipmentMilestone.upsert({
    where: { id: "ms_air_0001_arrival" },
    update: {},
    create: {
      id: "ms_air_0001_arrival",
      shipmentId: shipmentAirImport.id,
      code: "ARRIVED",
      label: "Arrived",
      expectedAt: new Date("2026-04-09T10:30:00.000Z"),
      status: "IN_PROGRESS",
      isCritical: true,
      assignedToId: adminUser.id,
    },
  });

  await prisma.shipmentMilestone.upsert({
    where: { id: "ms_ocean_0002_docs" },
    update: {},
    create: {
      id: "ms_ocean_0002_docs",
      shipmentId: shipmentOceanExport.id,
      code: "CUSTOMS_IN_PROGRESS",
      label: "Customs In Progress",
      expectedAt: new Date("2026-04-09T16:00:00.000Z"),
      status: "DELAYED",
      isCritical: true,
      assignedToId: adminUser.id,
      comment: "Original certificate of origin not received yet.",
    },
  });

  await prisma.shipmentMilestone.upsert({
    where: { id: "ms_ocean_0002_booking" },
    update: {},
    create: {
      id: "ms_ocean_0002_booking",
      shipmentId: shipmentOceanExport.id,
      code: "BOOKING_CONFIRMED",
      label: "Booking Confirmed",
      expectedAt: new Date("2026-04-08T12:00:00.000Z"),
      actualAt: new Date("2026-04-08T11:55:00.000Z"),
      status: "COMPLETED",
      isCritical: true,
      assignedToId: adminUser.id,
    },
  });

  await prisma.shipmentDocument.upsert({
    where: { id: "doc_air_0001_hawb" },
    update: {},
    create: {
      id: "doc_air_0001_hawb",
      shipmentId: shipmentAirImport.id,
      docType: "AWB",
      fileName: "hawb-045-77881122.pdf",
      fileUrl: "/uploads/seed/hawb-045-77881122.pdf",
      referenceNumber: "HAWB-045-77881122",
      issueDate: new Date("2026-04-05T09:00:00.000Z"),
      uploadedById: adminUser.id,
      version: 1,
      status: "VERIFIED",
      notes: "Original airway bill verified by operations.",
    },
  });

  await prisma.shipmentDocument.upsert({
    where: { id: "doc_air_0001_invoice" },
    update: {},
    create: {
      id: "doc_air_0001_invoice",
      shipmentId: shipmentAirImport.id,
      docType: "COMMERCIAL_INVOICE",
      fileName: "acme-commercial-invoice-45021.pdf",
      fileUrl: "/uploads/seed/acme-commercial-invoice-45021.pdf",
      referenceNumber: "INV-45021",
      issueDate: new Date("2026-04-04T12:00:00.000Z"),
      uploadedById: adminUser.id,
      version: 2,
      status: "RECEIVED",
      notes: "Customer re-uploaded corrected values in version 2.",
    },
  });

  await prisma.shipmentDocument.upsert({
    where: { id: "doc_ocean_0002_hbl" },
    update: {},
    create: {
      id: "doc_ocean_0002_hbl",
      shipmentId: shipmentOceanExport.id,
      docType: "BL",
      fileName: "hbl-arbue-cnsha-00921.pdf",
      fileUrl: "/uploads/seed/hbl-arbue-cnsha-00921.pdf",
      referenceNumber: "HBL-ARBUE-CNSHA-00921",
      issueDate: new Date("2026-04-11T15:00:00.000Z"),
      uploadedById: adminUser.id,
      version: 1,
      status: "PENDING",
      notes: "Pending final signature from shipper.",
    },
  });

  await prisma.revenue.upsert({
    where: { id: "rev_air_0001_main" },
    update: {},
    create: {
      id: "rev_air_0001_main",
      companyId: company.id,
      branchId: branchBA.id,
      shipmentId: shipmentAirImport.id,
      customerId: customerAirImport.id,
      concept: "International Air Freight",
      amount: "2450.00",
      currencyCode: "USD",
      exchangeRate: "880.000000",
      amountBase: "2156000.00",
      dueDate: new Date("2026-04-20T00:00:00.000Z"),
      status: "PAID",
      notes: "Collected with invoice INV-AR-2026-00112.",
    },
  });

  await prisma.revenue.upsert({
    where: { id: "rev_ocean_0002_main" },
    update: {},
    create: {
      id: "rev_ocean_0002_main",
      companyId: company.id,
      branchId: branchBA.id,
      shipmentId: shipmentOceanExport.id,
      customerId: customerOceanExport.id,
      concept: "Ocean Freight + Origin THC",
      amount: "6200.00",
      currencyCode: "USD",
      exchangeRate: "882.500000",
      amountBase: "5471500.00",
      dueDate: new Date("2026-04-25T00:00:00.000Z"),
      status: "INVOICED",
      notes: "Invoice issued; awaiting payment.",
    },
  });

  await prisma.expense.upsert({
    where: { id: "exp_air_0001_carrier" },
    update: {},
    create: {
      id: "exp_air_0001_carrier",
      companyId: company.id,
      branchId: branchBA.id,
      shipmentId: shipmentAirImport.id,
      supplierId: carrierAir.id,
      concept: "Airline Cost",
      amount: "1890.00",
      currencyCode: "USD",
      supplierName: carrierAir.name,
      exchangeRate: "880.000000",
      amountBase: "1663200.00",
      dueDate: new Date("2026-04-18T00:00:00.000Z"),
      status: "PAID",
      notes: "Airline invoice LH-INV-55619 paid.",
    },
  });

  await prisma.generalExpense.upsert({
    where: { id: "gexp_salaries_2026_04" },
    update: {},
    create: {
      id: "gexp_salaries_2026_04",
      companyId: company.id,
      branchId: branchBA.id,
      conceptCategory: GeneralExpenseCategory.SALARIES,
      customConcept: null,
      amount: "18500.00",
      currencyCode: "USD",
      dueDate: new Date("2026-04-30T00:00:00.000Z"),
      status: GeneralExpenseStatus.PENDING,
      notes: "Monthly payroll operations and customer service team.",
    },
  });

  await prisma.generalExpense.upsert({
    where: { id: "gexp_rent_2026_04" },
    update: {},
    create: {
      id: "gexp_rent_2026_04",
      companyId: company.id,
      branchId: branchBA.id,
      conceptCategory: GeneralExpenseCategory.RENT,
      customConcept: null,
      amount: "4200.00",
      currencyCode: "USD",
      dueDate: new Date("2026-04-10T00:00:00.000Z"),
      status: GeneralExpenseStatus.PAID,
      notes: "Main office lease - Buenos Aires HQ.",
    },
  });

  await prisma.generalExpense.upsert({
    where: { id: "gexp_other_2026_04" },
    update: {},
    create: {
      id: "gexp_other_2026_04",
      companyId: company.id,
      branchId: branchBA.id,
      conceptCategory: GeneralExpenseCategory.OTHER,
      customConcept: "Accounting advisory retainer",
      amount: "980.00",
      currencyCode: "USD",
      dueDate: new Date("2026-04-25T00:00:00.000Z"),
      status: GeneralExpenseStatus.PENDING,
      notes: "External accounting and tax advisory support.",
    },
  });

  await prisma.expense.upsert({
    where: { id: "exp_ocean_0002_carrier" },
    update: {},
    create: {
      id: "exp_ocean_0002_carrier",
      companyId: company.id,
      branchId: branchBA.id,
      shipmentId: shipmentOceanExport.id,
      supplierId: carrierOcean.id,
      supplierName: carrierOcean.name,
      concept: "Ocean Carrier Buy Rate",
      amount: "4980.00",
      currencyCode: "USD",
      exchangeRate: "882.500000",
      amountBase: "4394850.00",
      dueDate: new Date("2026-04-22T00:00:00.000Z"),
      status: "INVOICED",
      notes: "Carrier invoice received and under payment process.",
    },
  });

  await prisma.expense.upsert({
    where: { id: "exp_ocean_0002_docs" },
    update: {},
    create: {
      id: "exp_ocean_0002_docs",
      companyId: company.id,
      branchId: branchBA.id,
      shipmentId: shipmentOceanExport.id,
      supplierId: supplierCustoms.id,
      supplierName: supplierCustoms.name,
      concept: "Documentation and Customs Coordination",
      amount: "420.00",
      currencyCode: "USD",
      exchangeRate: "882.500000",
      amountBase: "370650.00",
      dueDate: new Date("2026-04-26T00:00:00.000Z"),
      status: "PENDING",
      notes: "Pending customs broker invoice confirmation.",
    },
  });

  await prisma.activityLog.upsert({
    where: { id: "act_shp_air_create" },
    update: {},
    create: {
      id: "act_shp_air_create",
      companyId: company.id,
      entityType: "SHIPMENT",
      entityId: shipmentAirImport.id,
      action: "CREATE",
      actorId: adminUser.id,
      afterJson: { status: "IN_TRANSIT", mode: "AIR", direction: "IMPORT" },
    },
  });

  await prisma.activityLog.upsert({
    where: { id: "act_shp_ocean_create" },
    update: {},
    create: {
      id: "act_shp_ocean_create",
      companyId: company.id,
      entityType: "SHIPMENT",
      entityId: shipmentOceanExport.id,
      action: "CREATE",
      actorId: adminUser.id,
      afterJson: { status: "BOOKING_REQUESTED", mode: "OCEAN", direction: "EXPORT" },
    },
  });

  await prisma.activityLog.upsert({
    where: { id: "act_quote_approve_0001" },
    update: {},
    create: {
      id: "act_quote_approve_0001",
      companyId: company.id,
      entityType: "QUOTE",
      entityId: "quote_2026_0001",
      action: "APPROVE",
      actorId: adminUser.id,
    },
  });

  console.log("Seed completed.");
  console.log("Admin user:", adminUser.email);
  console.log("Admin password: Admin123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
