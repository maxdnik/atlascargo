import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDashboardKpis } from "@/lib/dashboard";
import { formatNumber, formatMoney } from "@/lib/format";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const companyId = session?.user?.companyId ?? "";
  const kpiData = await getDashboardKpis(companyId);

  const kpis = [
    { label: "Open Shipments", value: formatNumber(kpiData.openShipments) },
    { label: "Delayed Milestones", value: formatNumber(kpiData.delayedMilestones) },
    { label: "Total Quotes", value: formatNumber(kpiData.totalQuotes) },
    { label: "Approval Rate", value: `${kpiData.approvalRate}%` },
    {
      label: "Approved Margin",
      value: formatMoney(kpiData.totalApprovedMargin),
      highlight: kpiData.totalApprovedMargin > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Operational overview for freight forwarding operations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{kpi.label}</p>
            <p
              className={`mt-3 text-2xl font-semibold tabular-nums ${
                "highlight" in kpi && kpi.highlight
                  ? "text-emerald-700"
                  : "text-slate-900"
              }`}
            >
              {kpi.value}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
