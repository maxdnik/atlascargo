import { prisma } from "@/lib/prisma";
export async function listCustomers(companyId: string, query?: string) {
  const search = query?.trim();
  return prisma.customer.findMany({
    where: {
      companyId,
      ...(search
        ? {
            OR: [
              { code: { contains: search } },
              { legalName: { contains: search } },
              { tradeName: { contains: search } },
              { taxId: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ legalName: "asc" }],
    include: {
      _count: {
        select: { shipments: true, quotes: true, contacts: true },
      },
    },
    take: 100,
  });
}

export async function getCustomerById(companyId: string, id: string) {
  return prisma.customer.findFirst({
    where: { id, companyId },
    include: {
      contacts: { orderBy: { createdAt: "desc" } },
      _count: {
        select: { shipments: true, quotes: true, contacts: true },
      },
    },
  });
}

export async function deleteCustomerById(companyId: string, id: string) {
  const existing = await prisma.customer.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Customer not found");
  }

  await prisma.customer.delete({ where: { id: existing.id } });
}
