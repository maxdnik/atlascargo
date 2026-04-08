import { PermissionAction, PermissionResource } from "@prisma/client";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CreditCard,
  FileText,
  WalletCards,
} from "lucide-react";
import { enforcePagePermission } from "@/lib/permissions";

const financeCards = [
  {
    title: "Revenue",
    description: "Seguimiento de ingresos por embarque, cliente y servicio.",
    icon: ArrowUpRight,
    tone: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    title: "Expenses",
    description: "Control de costos operativos y gastos por proveedor.",
    icon: ArrowDownRight,
    tone: "text-rose-600",
    bg: "bg-rose-50",
  },
  {
    title: "Shipment profitability",
    description: "Margen bruto real por archivo operativo y comparación contra cotización.",
    icon: FileText,
    tone: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    title: "Accounts receivable",
    description: "Cuentas a cobrar, vencimientos y cobranza pendiente.",
    icon: WalletCards,
    tone: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    title: "Accounts payable",
    description: "Cuentas a pagar, compromisos con agentes y proveedores.",
    icon: CreditCard,
    tone: "text-violet-600",
    bg: "bg-violet-50",
  },
];

export default async function FinancePage() {
  await enforcePagePermission(PermissionResource.REVENUE, PermissionAction.VIEW);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Banknote className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Finance Control Center
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Revenue, expenses, profitability y control financiero operativo por embarque.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {financeCards.map((card) => {
          const Icon = card.icon;
          return (
            <section
              key={card.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              <div className={`inline-flex rounded-xl ${card.bg} p-2`}>
                <Icon className={`h-4 w-4 ${card.tone}`} />
              </div>
              <h2 className="mt-3 text-sm font-semibold text-slate-900">{card.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{card.description}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
