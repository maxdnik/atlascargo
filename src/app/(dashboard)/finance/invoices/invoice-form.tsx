"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceLineType } from "@prisma/client";
import type { FinanceActionState } from "@/app/(dashboard)/finance/actions";

type ShipmentOption = {
  id: string;
  shipmentNumber: string;
  customerName: string;
  status: string;
};

type InvoiceLineInput = {
  id: string;
  description: string;
  amount: string;
  type: InvoiceLineType;
};

type InvoiceFormProps = {
  mode: "create" | "edit";
  shipments: ShipmentOption[];
  initial?: {
    invoiceId: string;
    shipmentId: string;
    invoiceNumber: string;
    currencyCode: "USD" | "EUR" | "ARS";
    issueDate: string;
    dueDate: string;
    notes: string;
    lines: Array<{ description: string; amount: number; type: InvoiceLineType }>;
  };
  submitAction: (
    prevState: FinanceActionState,
    formData: FormData,
  ) => Promise<FinanceActionState>;
  submitLabel: string;
};

const initialActionState: FinanceActionState = { success: false };

function lineId() {
  return Math.random().toString(36).slice(2);
}

function lineTemplate(): InvoiceLineInput {
  return {
    id: lineId(),
    description: "",
    amount: "",
    type: InvoiceLineType.FREIGHT,
  };
}

export function InvoiceForm({
  mode,
  shipments,
  initial,
  submitAction,
  submitLabel,
}: InvoiceFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState<FinanceActionState, FormData>(
    async (_prev, formData) => {
      const result = await submitAction(initialActionState, formData);
      if (result.success) {
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  const [selectedShipmentId, setSelectedShipmentId] = useState(
    initial?.shipmentId ?? shipments[0]?.id ?? "",
  );
  const [lines, setLines] = useState<InvoiceLineInput[]>(
    initial?.lines.length
      ? initial.lines.map((line) => ({
          id: lineId(),
          description: line.description,
          amount: String(line.amount),
          type: line.type,
        }))
      : [lineTemplate()],
  );

  const selectedShipment = useMemo(
    () => shipments.find((shipment) => shipment.id === selectedShipmentId) ?? null,
    [shipments, selectedShipmentId],
  );

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      {mode === "edit" && initial ? <input type="hidden" name="invoiceId" value={initial.invoiceId} /> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Shipment
          </label>
          <select
            name="shipmentId"
            value={selectedShipmentId}
            onChange={(event) => setSelectedShipmentId(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
            required
          >
            {shipments.length === 0 ? <option value="">No shipment available</option> : null}
            {shipments.map((shipment) => (
              <option key={shipment.id} value={shipment.id}>
                {shipment.shipmentNumber} · {shipment.customerName} · {shipment.status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Customer (linked from shipment)
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {selectedShipment ? selectedShipment.customerName : "-"}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Invoice number
          </label>
          <input
            name="invoiceNumber"
            defaultValue={initial?.invoiceNumber ?? ""}
            placeholder="INV-2026-0001"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Currency
          </label>
          <select
            name="currencyCode"
            defaultValue={initial?.currencyCode ?? "USD"}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="ARS">ARS</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Issue date
          </label>
          <input
            type="date"
            name="issueDate"
            defaultValue={initial?.issueDate ?? ""}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Due date
          </label>
          <input
            type="date"
            name="dueDate"
            defaultValue={initial?.dueDate ?? ""}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Notes
        </label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ""}
          placeholder="Internal notes for finance and AFIP flow"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
        />
      </div>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice lines</p>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, lineTemplate()])}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Add line
          </button>
        </div>
        {lines.map((line, index) => (
          <div key={line.id} className="grid gap-2 md:grid-cols-[1fr_140px_180px_auto]">
            <input
              required
              name="lineDescription"
              value={line.description}
              onChange={(event) =>
                setLines((prev) =>
                  prev.map((row) =>
                    row.id === line.id ? { ...row, description: event.target.value } : row,
                  ),
                )
              }
              placeholder="Description"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              name="lineAmount"
              value={line.amount}
              onChange={(event) =>
                setLines((prev) =>
                  prev.map((row) =>
                    row.id === line.id ? { ...row, amount: event.target.value } : row,
                  ),
                )
              }
              placeholder="Amount"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <select
              name="lineType"
              value={line.type}
              onChange={(event) =>
                setLines((prev) =>
                  prev.map((row) =>
                    row.id === line.id
                      ? { ...row, type: event.target.value as InvoiceLineType }
                      : row,
                  ),
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {Object.values(InvoiceLineType).map((lineType) => (
                <option key={lineType} value={lineType}>
                  {lineType}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                setLines((prev) => {
                  if (prev.length === 1) return prev;
                  return prev.filter((row) => row.id !== line.id);
                })
              }
              className="rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
              disabled={lines.length === 1}
            >
              Remove
            </button>
            {index === 0 ? null : null}
          </div>
        ))}
      </section>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
        >
          {submitLabel}
        </button>
        {state.error && !state.success ? (
          <p className="text-sm text-rose-700">{state.error}</p>
        ) : null}
      </div>
    </form>
  );
}
