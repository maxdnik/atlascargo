import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

  await prisma.currency.createMany({
    data: [
      { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, active: true },
      { code: "EUR", name: "Euro", symbol: "EUR", decimals: 2, active: true },
      { code: "ARS", name: "Argentine Peso", symbol: "AR$", decimals: 2, active: true },
    ],
  });

  await prisma.incoterm.createMany({
    data: [
      { code: "EXW", description: "Ex Works", active: true },
      { code: "FOB", description: "Free On Board", active: true },
      { code: "CIF", description: "Cost, Insurance and Freight", active: true },
      { code: "DDP", description: "Delivered Duty Paid", active: true },
      { code: "FCA", description: "Free Carrier", active: true },
      { code: "CPT", description: "Carriage Paid To", active: true },
    ],
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
      incotermCode: "CPT",
      serviceLevel: "Airport to Door",
      referenceClient: "ACME-PO-45021",
      referenceInternal: "OPS-AIR-0426-01",
      bookingRef: "LH-BKG-77811",
      houseRef: "HAWB-045-77881122",
      masterRef: "MAWB-020-45678901",
      commodity: "Electronic Components",
      packageCount: 24,
      grossWeightKg: "980.500",
      volumeM3: "6.200",
      etd: new Date("2026-04-05T11:00:00.000Z"),
      eta: new Date("2026-04-09T10:30:00.000Z"),
      atd: new Date("2026-04-05T11:45:00.000Z"),
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
      status: "OPEN",
      incotermCode: "FOB",
      serviceLevel: "Port to Port",
      referenceClient: "PAMPA-EXP-2404",
      referenceInternal: "OPS-OCE-0426-03",
      bookingRef: "MSK-BKG-33109",
      houseRef: "HBL-ARBUE-CNSHA-00921",
      masterRef: "MBL-MSK-77893021",
      commodity: "Soybean Meal",
      packageCount: 2_000,
      grossWeightKg: "52000.000",
      volumeM3: "78.500",
      etd: new Date("2026-04-12T20:00:00.000Z"),
      eta: new Date("2026-05-18T08:00:00.000Z"),
      polPortId: portBue.id,
      podPortId: portSha.id,
      notes: "Export docs under chamber of commerce review.",
    },
  });

  await prisma.shipmentLeg.createMany({
    data: [
      {
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
      {
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
    ],
  });

  await prisma.shipmentMilestone.createMany({
    data: [
      {
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
      {
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
      {
        id: "ms_air_0001_arrival",
        shipmentId: shipmentAirImport.id,
        code: "ARRIVAL_ESTIMATED",
        label: "Estimated Arrival",
        expectedAt: new Date("2026-04-09T10:30:00.000Z"),
        status: "IN_PROGRESS",
        isCritical: true,
        assignedToId: adminUser.id,
      },
      {
        id: "ms_ocean_0002_docs",
        shipmentId: shipmentOceanExport.id,
        code: "DOCS_PENDING",
        label: "Export Documents Pending",
        expectedAt: new Date("2026-04-09T16:00:00.000Z"),
        status: "DELAYED",
        isCritical: true,
        assignedToId: adminUser.id,
        comment: "Original certificate of origin not received yet.",
      },
      {
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
    ],
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
      fxRate: "880.000000",
      amountBase: "2156000.00",
      dueDate: new Date("2026-04-20T00:00:00.000Z"),
      status: "POSTED",
      invoiceNumber: "INV-AR-2026-00112",
      postedAt: new Date("2026-04-06T09:00:00.000Z"),
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
      fxRate: "882.500000",
      amountBase: "5471500.00",
      dueDate: new Date("2026-04-25T00:00:00.000Z"),
      status: "DRAFT",
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
      fxRate: "880.000000",
      amountBase: "1663200.00",
      dueDate: new Date("2026-04-18T00:00:00.000Z"),
      status: "POSTED",
      invoiceNumber: "LH-INV-55619",
      postedAt: new Date("2026-04-06T09:15:00.000Z"),
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
      concept: "Ocean Carrier Buy Rate",
      amount: "4980.00",
      currencyCode: "USD",
      fxRate: "882.500000",
      amountBase: "4394850.00",
      dueDate: new Date("2026-04-22T00:00:00.000Z"),
      status: "DRAFT",
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
      concept: "Documentation and Customs Coordination",
      amount: "420.00",
      currencyCode: "USD",
      fxRate: "882.500000",
      amountBase: "370650.00",
      dueDate: new Date("2026-04-26T00:00:00.000Z"),
      status: "DRAFT",
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
      afterJson: { status: "OPEN", mode: "OCEAN", direction: "EXPORT" },
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
