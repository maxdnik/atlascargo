import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDashboardKpis } from "@/lib/dashboard";
import { formatNumber, formatMoney } from "@/lib/format";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const companyId = session?.user?.companyId ?? "";
  const kpi = await getDashboardKpis(companyId);

  const cards = [
    { label: "Open Shipments", value: formatNumber(kpi.openShipments) },
    { label: "Delayed Milestones", value: formatNumber(kpi.delayedMilestones) },
    { label: "Total Quotes", value: formatNumber(kpi.totalQuotes) },
    { label: "Approved", value: formatNumber(kpi.approvedQuotes) },
    { label: "Approval Rate", value: `${kpi.approvalRate}%` },
    {
      label: "Approved Margin",
      value: formatMoney(kpi.totalApprovedMargin),
      highlight: kpi.totalApprovedMargin > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">Operational overview for freight forwarding operations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <article key={c.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className={`mt-3 text-2xl font-semibold tabular-nums ${
              "highlight" in c && c.highlight ? "text-emerald-700" : "text-slate-900"
            }`}>
              {c.value}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
