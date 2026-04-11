"use server";

import { ActivityAction, ActivityActorType, EntityType, PaymentEntityType } from "@prisma/client";
import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const registerPaymentSchema = z.object({
  entityType: z.nativeEnum(PaymentEntityType),
  entityId: z.string().min(1),
  amount: z.coerce.number().positive(),
  currencyCode: z.string().min(3).max(3).transform((value) => value.toUpperCase()),
  paymentDate: z.string().min(1),
  method: z.string().max(50).optional(),
  reference: z.string().max(120).optional(),
  notes: z.string().max(1200).optional(),
});

type RegisterPaymentInput = z.infer<typeof registerPaymentSchema> & {
  companyId: string;
  branchId?: string | null;
  actor: {
    actorId: string;
    actorName?: string | null;
  };
};

function toDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid payment date");
  }
  return parsed;
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

async function sumPayments(input: {
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$use" | "$extends">;
  companyId: string;
  entityType: PaymentEntityType;
  entityId: string;
}) {
  const where =
    input.entityType === PaymentEntityType.INVOICE
      ? { companyId: input.companyId, invoiceId: input.entityId }
      : input.entityType === PaymentEntityType.SHIPMENT_COST
        ? { companyId: input.companyId, shipmentCostId: input.entityId }
        : input.entityType === PaymentEntityType.EXPENSE
          ? { companyId: input.companyId, expenseId: input.entityId }
          : { companyId: input.companyId, generalExpenseId: input.entityId };
  const result = await input.tx.payment.aggregate({
    where,
    _sum: { amount: true },
  });
  return toNumber(result._sum.amount);
}

async function validateEntity(input: {
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$use" | "$extends">;
  companyId: string;
  entityType: PaymentEntityType;
  entityId: string;
  currencyCode: string;
}) {
  if (input.entityType === PaymentEntityType.INVOICE) {
    const invoice = await input.tx.invoice.findFirst({
      where: {
        id: input.entityId,
        companyId: input.companyId,
      },
      select: {
        id: true,
        total: true,
        invoiceNumber: true,
        shipmentId: true,
        customerId: true,
        currencyCode: true,
        status: true,
      },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "CANCELLED") throw new Error("Cannot register payment for cancelled invoice");
    if (invoice.currencyCode !== input.currencyCode) {
      throw new Error("Payment currency must match invoice currency");
    }
    return {
      amount: toNumber(invoice.total),
      referenceLabel: invoice.invoiceNumber,
      shipmentId: invoice.shipmentId,
      customerId: invoice.customerId,
      entityType: EntityType.INVOICE,
    };
  }

  if (input.entityType === PaymentEntityType.SHIPMENT_COST) {
    const cost = await input.tx.shipmentCost.findFirst({
      where: {
        id: input.entityId,
        companyId: input.companyId,
      },
      select: {
        id: true,
        amount: true,
        conceptCategory: true,
        shipmentId: true,
        currencyCode: true,
        status: true,
      },
    });
    if (!cost) throw new Error("Shipment cost not found");
    if (cost.status === "PAID") throw new Error("Shipment cost already marked paid");
    if (cost.currencyCode !== input.currencyCode) {
      throw new Error("Payment currency must match shipment cost currency");
    }
    return {
      amount: toNumber(cost.amount),
      referenceLabel: cost.conceptCategory,
      shipmentId: cost.shipmentId,
      customerId: null,
      entityType: EntityType.SHIPMENT_COST,
    };
  }

  if (input.entityType === PaymentEntityType.EXPENSE) {
    const expense = await input.tx.expense.findFirst({
      where: {
        id: input.entityId,
        companyId: input.companyId,
      },
      select: {
        id: true,
        amount: true,
        concept: true,
        shipmentId: true,
        currencyCode: true,
        status: true,
      },
    });
    if (!expense) throw new Error("Expense not found");
    if (expense.status === "PAID") throw new Error("Expense already marked paid");
    if (expense.currencyCode !== input.currencyCode) {
      throw new Error("Payment currency must match expense currency");
    }
    return {
      amount: toNumber(expense.amount),
      referenceLabel: expense.concept,
      shipmentId: expense.shipmentId,
      customerId: null,
      entityType: EntityType.EXPENSE,
    };
  }

  const generalExpense = await input.tx.generalExpense.findFirst({
    where: {
      id: input.entityId,
      companyId: input.companyId,
    },
    select: {
      id: true,
      amount: true,
      conceptCategory: true,
      customConcept: true,
      currencyCode: true,
      status: true,
    },
  });
  if (!generalExpense) throw new Error("General expense not found");
  if (generalExpense.status === "CANCELLED") {
    throw new Error("Cannot register payment for cancelled expense");
  }
  if (generalExpense.currencyCode !== input.currencyCode) {
    throw new Error("Payment currency must match expense currency");
  }
  return {
    amount: toNumber(generalExpense.amount),
    referenceLabel: generalExpense.customConcept ?? generalExpense.conceptCategory,
    shipmentId: null,
    customerId: null,
    entityType: EntityType.EXPENSE,
  };
}

export async function registerEntityPayment(input: RegisterPaymentInput) {
  const parsed = registerPaymentSchema.parse(input);
  const paymentDate = toDate(parsed.paymentDate);

  return prisma.$transaction(async (tx) => {
    const entity = await validateEntity({
      tx,
      companyId: input.companyId,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      currencyCode: parsed.currencyCode,
    });

    const alreadyPaid = await sumPayments({
      tx,
      companyId: input.companyId,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
    });
    const outstandingBefore = Math.max(entity.amount - alreadyPaid, 0);
    if (parsed.amount > outstandingBefore + 0.000001) {
      throw new Error("Payment amount cannot exceed outstanding amount");
    }

    const payment = await tx.payment.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId ?? null,
        entityType: parsed.entityType,
        entityId: parsed.entityId,
        currencyCode: parsed.currencyCode,
        amount: parsed.amount,
        paymentDate,
        method: parsed.method?.trim() ? parsed.method.trim() : null,
        reference: parsed.reference?.trim() ? parsed.reference.trim() : null,
        notes: parsed.notes?.trim() ? parsed.notes.trim() : null,
        createdById: input.actor.actorId,
        ...(parsed.entityType === PaymentEntityType.INVOICE
          ? { invoiceId: parsed.entityId }
          : parsed.entityType === PaymentEntityType.SHIPMENT_COST
            ? { shipmentCostId: parsed.entityId }
            : parsed.entityType === PaymentEntityType.EXPENSE
              ? { expenseId: parsed.entityId }
              : { generalExpenseId: parsed.entityId }),
      },
      select: {
        id: true,
        amount: true,
      },
    });

    const paidAfter = alreadyPaid + toNumber(payment.amount);
    const outstandingAfter = Math.max(entity.amount - paidAfter, 0);

    if (parsed.entityType === PaymentEntityType.INVOICE) {
      await tx.invoice.update({
        where: { id: parsed.entityId },
        data: {
          status: outstandingAfter <= 0 ? "PAID" : paidAfter > 0 ? "ISSUED" : "READY_TO_ISSUE",
        },
      });
    } else if (parsed.entityType === PaymentEntityType.SHIPMENT_COST) {
      await tx.shipmentCost.update({
        where: { id: parsed.entityId },
        data: {
          status: outstandingAfter <= 0 ? "PAID" : paidAfter > 0 ? "CONFIRMED" : "PENDING",
        },
      });
    } else if (parsed.entityType === PaymentEntityType.EXPENSE) {
      await tx.expense.update({
        where: { id: parsed.entityId },
        data: {
          status: outstandingAfter <= 0 ? "PAID" : "PENDING",
        },
      });
    } else {
      await tx.generalExpense.update({
        where: { id: parsed.entityId },
        data: {
          status: outstandingAfter <= 0 ? "PAID" : "PENDING",
        },
      });
    }

    await recordAuditEvent(
      {
        companyId: input.companyId,
        entityType: entity.entityType,
        entityId: parsed.entityId,
        action: ActivityAction.MARK_PAID,
        shipmentId: entity.shipmentId,
        customerId: entity.customerId,
        summary: `Payment of ${parsed.amount.toFixed(2)} ${parsed.currencyCode} registered for ${entity.referenceLabel}.`,
        metadata: {
          paymentId: payment.id,
          paymentEntityType: parsed.entityType,
          amount: parsed.amount,
          currencyCode: parsed.currencyCode,
          paidAmountAfter: paidAfter,
          outstandingAmountAfter: outstandingAfter,
          paymentDate: paymentDate.toISOString(),
          method: parsed.method ?? null,
          reference: parsed.reference ?? null,
        },
        actor: {
          actorType: ActivityActorType.USER,
          actorId: input.actor.actorId,
          actorName: input.actor.actorName ?? null,
        },
      },
      tx,
    );

    return {
      paymentId: payment.id,
      paidAmount: paidAfter,
      outstandingAmount: outstandingAfter,
    };
  });
}
