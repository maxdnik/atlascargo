import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { DocumentRecordStatus, FinancialRecordStatus } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { getShipmentById } from "@/lib/shipments";
import { listCustomers } from "@/lib/customers";
import { ShipmentForm } from "@/components/shipments/shipment-form";
import { MilestoneTimeline } from "@/components/shipments/milestone-timeline";
import {
  deleteExpenseAction,
  deleteRevenueAction,
  deleteShipmentDocumentAction,
  updateShipmentAction,
  upsertExpenseAction,
  upsertRevenueAction,
  upsertShipmentDocumentAction,
} from "@/app/(dashboard)/shipments/actions";

type ShipmentEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ShipmentEditPage({ params }: ShipmentEditPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  const { id } = await params;
  const shipment = await getShipmentById(session.user.companyId, id);
  const customers = await listCustomers(session.user.companyId);
  if (!shipment) {
    notFound();
  }

  const operationalSummary = [
    { label: "Mode", value: shipment.mode },
    { label: "Direction", value: shipment.direction },
    { label: "Status", value: shipment.status },
    {
      label: "Routing",
      value:
        shipment.originCode || shipment.destinationCode
          ? `${shipment.originCode ?? "-"} → ${shipment.destinationCode ?? "-"}`
          : "-",
    },
  ];
  const totalRevenue = shipment.revenues.reduce((sum, row) => sum + Number(row.amountBase), 0);
  const totalExpense = shipment.expenses.reduce((sum, row) => sum + Number(row.amountBase), 0);
  const grossProfit = totalRevenue - totalExpense;
  const actualMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : null;
  const quotedSell = shipment.quote ? Number(shipment.quote.totalSell) : null;
  const quotedCost = shipment.quote ? Number(shipment.quote.totalBuy) : null;
  const quotedMarginAmount = shipment.quote ? Number(shipment.quote.marginAmount) : null;
  const quotedMarginPct = shipment.quote ? Number(shipment.quote.marginPct) * 100 : null;
  const hasFinancials = shipment.revenues.length > 0 || shipment.expenses.length > 0;
  const marginDeteriorated =
    quotedMarginAmount !== null && hasFinancials && grossProfit < quotedMarginAmount;

  const documentStatusBadge: Record<DocumentRecordStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    RECEIVED: "bg-blue-100 text-blue-700",
    VERIFIED: "bg-emerald-100 text-emerald-700",
  };
  const financeStatusBadge: Record<FinancialRecordStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    INVOICED: "bg-blue-100 text-blue-700",
    PAID: "bg-emerald-100 text-emerald-700",
  };
  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  const toDateInput = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "");
  const marginLabel = (value: number | null) => (value === null ? "-" : `${value.toFixed(2)}%`);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Edit shipment</h1>
        <p className="text-sm text-slate-600">
          Update operational references, routing dates and responsible data.
        </p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Header summary
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <article className="rounded-md border border-slate-200 p-3">
            <p className="text-xs uppercase text-slate-500">Shipment #</p>
            <p className="text-sm font-semibold text-slate-900">{shipment.shipmentNumber}</p>
          </article>
          {operationalSummary.map((item) => (
            <article key={item.label} className="rounded-md border border-slate-200 p-3">
              <p className="text-xs uppercase text-slate-500">{item.label}</p>
              <p className="text-sm font-semibold text-slate-900">{item.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Quote reference</h2>
        {shipment.quote ? (
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Commercial source:</span>{" "}
              {shipment.quote.quoteNumber} ({shipment.quote.status})
            </p>
            <p>
              <span className="font-medium text-slate-900">Customer:</span>{" "}
              {shipment.quote.customer.legalName}
            </p>
            <p>
              <span className="font-medium text-slate-900">Quoted lane:</span>{" "}
              {(shipment.quote.originCode ?? "-") + " → " + (shipment.quote.destinationCode ?? "-")}
            </p>
            <p>
              <span className="font-medium text-slate-900">Quoted incoterm:</span>{" "}
              {shipment.quote.incotermCode ?? "-"}
            </p>
            <p>
              <span className="font-medium text-slate-900">Quoted commodity:</span>{" "}
              {shipment.quote.commodity ?? "-"}
            </p>
            <p>
              <span className="font-medium text-slate-900">Margin reference:</span>{" "}
              {shipment.quote.marginAmount.toString()} ({shipment.quote.marginPct.toString()})
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No linked quote.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Customer and parties
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Customer:</span>{" "}
            {shipment.customer.legalName}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Shipper:</span> {shipment.shipperName ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Consignee:</span>{" "}
            {shipment.consigneeName ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Notify Party:</span>{" "}
            {shipment.notifyPartyName ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Origin Agent:</span>{" "}
            {shipment.agentOriginName ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Destination Agent:</span>{" "}
            {shipment.agentDestinationName ?? "-"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Routing</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Origin / Destination:</span>{" "}
            {(shipment.originCode ?? "-") + " / " + (shipment.destinationCode ?? "-")}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">POL / POD:</span> {shipment.pol ?? "-"} /{" "}
            {shipment.pod ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Airport O/D:</span>{" "}
            {shipment.airportOrigin ?? "-"} / {shipment.airportDestination ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Place of receipt/delivery:</span>{" "}
            {(shipment.placeOfReceipt ?? "-") + " / " + (shipment.placeOfDelivery ?? "-")}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Transport references
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Carrier:</span> {shipment.carrierName ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Vessel / Flight:</span>{" "}
            {shipment.vesselOrFlight ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Booking Ref:</span> {shipment.bookingRef ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">House Ref:</span> {shipment.houseRef ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Master Ref:</span> {shipment.masterRef ?? "-"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Cargo details</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Packages:</span>{" "}
            {(shipment.packageCount ?? "-") + " " + (shipment.packageType ?? "")}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Gross Weight (kg):</span>{" "}
            {shipment.grossWeightKg?.toString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Chargeable Weight (kg):</span>{" "}
            {shipment.chargeableWeightKg?.toString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Volume (m3):</span>{" "}
            {shipment.volumeM3?.toString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Containers:</span>{" "}
            {(shipment.containerCount ?? "-") + " / " + (shipment.containerType ?? "-")}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Operational dates
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Cargo Ready:</span>{" "}
            {shipment.cargoReadyDate?.toLocaleString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">ETD:</span>{" "}
            {shipment.etd?.toLocaleString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">ETA:</span>{" "}
            {shipment.eta?.toLocaleString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">ATD:</span>{" "}
            {shipment.atd?.toLocaleString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">ATA:</span>{" "}
            {shipment.ata?.toLocaleString() ?? "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Delivered At:</span>{" "}
            {shipment.deliveredAt?.toLocaleString() ?? "-"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Notes</h2>
        <p className="mt-2 text-sm text-slate-700">{shipment.notes ?? "-"}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Documents</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">File Name</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Issue Date</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {shipment.documents.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={8}>
                    No documents registered.
                  </td>
                </tr>
              ) : (
                shipment.documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-3 py-2">{doc.docType}</td>
                    <td className="px-3 py-2">{doc.fileName}</td>
                    <td className="px-3 py-2">{doc.referenceNumber ?? "-"}</td>
                    <td className="px-3 py-2">{doc.issueDate?.toLocaleDateString() ?? "-"}</td>
                    <td className="px-3 py-2">{doc.version}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${documentStatusBadge[doc.status]}`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{doc.notes ?? "-"}</td>
                    <td className="px-3 py-2">
                      <form action={deleteShipmentDocumentAction}>
                        <input type="hidden" name="id" value={doc.id} />
                        <button className="text-rose-700 hover:underline" type="submit">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <form action={upsertShipmentDocumentAction} className="space-y-2 rounded-md border border-slate-200 p-3">
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <p className="text-xs font-semibold uppercase text-slate-600">Add document</p>
            <select name="docType" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {[
                "COMMERCIAL_INVOICE",
                "PACKING_LIST",
                "HBL",
                "MBL",
                "HAWB",
                "MAWB",
                "CERTIFICATE",
                "PERMIT",
                "POD",
                "OTHER",
              ].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              name="fileName"
              required
              placeholder="File name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="referenceNumber"
              placeholder="Reference number"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input type="date" name="issueDate" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input
              type="number"
              min={1}
              name="version"
              defaultValue={1}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select name="status" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {Object.values(DocumentRecordStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <textarea
              name="notes"
              rows={2}
              placeholder="Internal notes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Save document
            </button>
          </form>

          <form action={upsertShipmentDocumentAction} className="space-y-2 rounded-md border border-slate-200 p-3">
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <p className="text-xs font-semibold uppercase text-slate-600">Edit document</p>
            <select name="id" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select existing document</option>
              {shipment.documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.docType} - {doc.fileName}
                </option>
              ))}
            </select>
            <select name="docType" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {[
                "COMMERCIAL_INVOICE",
                "PACKING_LIST",
                "HBL",
                "MBL",
                "HAWB",
                "MAWB",
                "CERTIFICATE",
                "PERMIT",
                "POD",
                "OTHER",
              ].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              name="fileName"
              required
              placeholder="File name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="referenceNumber"
              placeholder="Reference number"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input type="date" name="issueDate" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input
              type="number"
              min={1}
              name="version"
              defaultValue={1}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select name="status" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {Object.values(DocumentRecordStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <textarea
              name="notes"
              rows={2}
              placeholder="Internal notes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Update document
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Revenue</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Concept</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Currency</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Amount Base</th>
                <th className="px-3 py-2">Due Date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {shipment.revenues.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={9}>
                    No revenue records yet.
                  </td>
                </tr>
              ) : (
                shipment.revenues.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">{row.concept}</td>
                    <td className="px-3 py-2">{Number(row.amount).toFixed(2)}</td>
                    <td className="px-3 py-2">{row.currencyCode}</td>
                    <td className="px-3 py-2">{row.exchangeRate ? Number(row.exchangeRate).toFixed(4) : "-"}</td>
                    <td className="px-3 py-2">{Number(row.amountBase).toFixed(2)}</td>
                    <td className="px-3 py-2">{row.dueDate?.toLocaleDateString() ?? "-"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${financeStatusBadge[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.notes ?? "-"}</td>
                    <td className="px-3 py-2">
                      <form action={deleteRevenueAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <button className="text-rose-700 hover:underline" type="submit">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <form action={upsertRevenueAction} className="space-y-2 rounded-md border border-slate-200 p-3">
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <p className="text-xs font-semibold uppercase text-slate-600">Add revenue</p>
            <input
              name="concept"
              required
              placeholder="Freight, origin, destination..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                min={0}
                name="amount"
                required
                placeholder="Amount"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <select name="currencyCode" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="ARS">ARS</option>
              </select>
              <input
                type="number"
                step="0.0001"
                min={0}
                name="exchangeRate"
                placeholder="Rate"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <input type="date" name="dueDate" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <select name="status" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {Object.values(FinancialRecordStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <textarea
              name="notes"
              rows={2}
              placeholder="Notes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Save revenue
            </button>
          </form>

          <form action={upsertRevenueAction} className="space-y-2 rounded-md border border-slate-200 p-3">
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <p className="text-xs font-semibold uppercase text-slate-600">Edit revenue</p>
            <select name="id" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select revenue record</option>
              {shipment.revenues.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.concept} - {Number(row.amount).toFixed(2)} {row.currencyCode}
                </option>
              ))}
            </select>
            <input
              name="concept"
              required
              placeholder="Concept"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                min={0}
                name="amount"
                required
                placeholder="Amount"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <select name="currencyCode" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="ARS">ARS</option>
              </select>
              <input
                type="number"
                step="0.0001"
                min={0}
                name="exchangeRate"
                placeholder="Rate"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <input type="date" name="dueDate" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <select name="status" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {Object.values(FinancialRecordStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <textarea
              name="notes"
              rows={2}
              placeholder="Notes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Update revenue
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Expense</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2">Concept</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Currency</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Amount Base</th>
                <th className="px-3 py-2">Due Date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {shipment.expenses.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={10}>
                    No expense records yet.
                  </td>
                </tr>
              ) : (
                shipment.expenses.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">{row.supplierName}</td>
                    <td className="px-3 py-2">{row.concept}</td>
                    <td className="px-3 py-2">{Number(row.amount).toFixed(2)}</td>
                    <td className="px-3 py-2">{row.currencyCode}</td>
                    <td className="px-3 py-2">{row.exchangeRate ? Number(row.exchangeRate).toFixed(4) : "-"}</td>
                    <td className="px-3 py-2">{Number(row.amountBase).toFixed(2)}</td>
                    <td className="px-3 py-2">{row.dueDate?.toLocaleDateString() ?? "-"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${financeStatusBadge[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.notes ?? "-"}</td>
                    <td className="px-3 py-2">
                      <form action={deleteExpenseAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <button className="text-rose-700 hover:underline" type="submit">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <form action={upsertExpenseAction} className="space-y-2 rounded-md border border-slate-200 p-3">
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <p className="text-xs font-semibold uppercase text-slate-600">Add expense</p>
            <input
              name="supplierName"
              required
              placeholder="Supplier name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="concept"
              required
              placeholder="Concept"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                min={0}
                name="amount"
                required
                placeholder="Amount"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <select name="currencyCode" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="ARS">ARS</option>
              </select>
              <input
                type="number"
                step="0.0001"
                min={0}
                name="exchangeRate"
                placeholder="Rate"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <input type="date" name="dueDate" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <select name="status" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {Object.values(FinancialRecordStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <textarea
              name="notes"
              rows={2}
              placeholder="Notes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Save expense
            </button>
          </form>

          <form action={upsertExpenseAction} className="space-y-2 rounded-md border border-slate-200 p-3">
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <p className="text-xs font-semibold uppercase text-slate-600">Edit expense</p>
            <select name="id" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select expense record</option>
              {shipment.expenses.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.supplierName} - {row.concept}
                </option>
              ))}
            </select>
            <input
              name="supplierName"
              required
              placeholder="Supplier name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="concept"
              required
              placeholder="Concept"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                min={0}
                name="amount"
                required
                placeholder="Amount"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <select name="currencyCode" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="ARS">ARS</option>
              </select>
              <input
                type="number"
                step="0.0001"
                min={0}
                name="exchangeRate"
                placeholder="Rate"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <input type="date" name="dueDate" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <select name="status" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {Object.values(FinancialRecordStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <textarea
              name="notes"
              rows={2}
              placeholder="Notes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Update expense
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Financial summary
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <article className="rounded-md border border-slate-200 p-3">
            <p className="text-xs uppercase text-slate-500">From quote</p>
            {shipment.quote ? (
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p>
                  Quoted sell: <span className="font-medium text-slate-900">{formatMoney(quotedSell ?? 0)}</span>
                </p>
                <p>
                  Quoted cost: <span className="font-medium text-slate-900">{formatMoney(quotedCost ?? 0)}</span>
                </p>
                <p>
                  Quoted margin:{" "}
                  <span className="font-medium text-slate-900">
                    {formatMoney(quotedMarginAmount ?? 0)} ({marginLabel(quotedMarginPct)})
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No quote linked.</p>
            )}
          </article>
          <article className="rounded-md border border-slate-200 p-3">
            <p className="text-xs uppercase text-slate-500">Actuals</p>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <p>
                Total revenue: <span className="font-medium text-slate-900">{formatMoney(totalRevenue)}</span>
              </p>
              <p>
                Total expense: <span className="font-medium text-slate-900">{formatMoney(totalExpense)}</span>
              </p>
              <p>
                Gross profit:{" "}
                <span
                  className={`font-medium ${grossProfit < 0 ? "text-rose-700" : "text-slate-900"}`}
                >
                  {formatMoney(grossProfit)}
                </span>
              </p>
              <p>
                Margin %:{" "}
                <span
                  className={`font-medium ${
                    actualMarginPct !== null && actualMarginPct < 0 ? "text-rose-700" : "text-slate-900"
                  }`}
                >
                  {marginLabel(actualMarginPct)}
                </span>
              </p>
            </div>
          </article>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          {!hasFinancials ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
              Incomplete Financials: add revenue and expense records to evaluate shipment margin.
            </p>
          ) : null}
          {marginDeteriorated ? (
            <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-rose-800">
              Warning: actual gross profit is below quoted margin.
            </p>
          ) : null}
        </div>
      </section>

      <ShipmentForm
        action={updateShipmentAction}
        customers={customers}
        submitLabel="Update shipment"
        defaults={{
          id: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          customerId: shipment.customerId,
          quoteId: shipment.quoteId ?? undefined,
          quoteNumber: shipment.quote?.quoteNumber,
          mode: shipment.mode,
          direction: shipment.direction,
          status: shipment.status,
          incotermCode: shipment.incotermCode ?? "",
          serviceLevel: shipment.serviceLevel ?? "",
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
          referenceClient: shipment.referenceClient ?? "",
          referenceInternal: shipment.referenceInternal ?? "",
          bookingRef: shipment.bookingRef ?? "",
          houseRef: shipment.houseRef ?? "",
          masterRef: shipment.masterRef ?? "",
          commodity: shipment.commodity ?? "",
          packageCount: shipment.packageCount ?? undefined,
          packageType: shipment.packageType ?? "",
          grossWeightKg: shipment.grossWeightKg?.toString() ?? "",
          chargeableWeightKg: shipment.chargeableWeightKg?.toString() ?? "",
          volumeM3: shipment.volumeM3?.toString() ?? "",
          containerCount: shipment.containerCount ?? undefined,
          containerType: shipment.containerType ?? "",
          cargoReadyDate: shipment.cargoReadyDate
            ? shipment.cargoReadyDate.toISOString().slice(0, 16)
            : "",
          etd: shipment.etd ? shipment.etd.toISOString().slice(0, 16) : "",
          eta: shipment.eta ? shipment.eta.toISOString().slice(0, 16) : "",
          atd: shipment.atd ? shipment.atd.toISOString().slice(0, 16) : "",
          ata: shipment.ata ? shipment.ata.toISOString().slice(0, 16) : "",
          deliveredAt: shipment.deliveredAt ? shipment.deliveredAt.toISOString().slice(0, 16) : "",
          notes: shipment.notes ?? "",
        }}
      />

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Milestones timeline
        </h2>
        <p className="mb-3 mt-1 text-sm text-slate-600">
          Update expected/actual dates and operational notes by milestone.
        </p>
        <MilestoneTimeline
          shipmentId={shipment.id}
          milestones={shipment.milestones.map((milestone) => ({
            id: milestone.id,
            code: milestone.code,
            label: milestone.label,
            expectedAt: milestone.expectedAt ? milestone.expectedAt.toISOString() : null,
            actualAt: milestone.actualAt ? milestone.actualAt.toISOString() : null,
            status: milestone.status,
            comment: milestone.comment,
          }))}
        />
      </section>
    </div>
  );
}
