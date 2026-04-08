import { PermissionAction, PermissionResource } from "@prisma/client";
import { getDashboardKpis } from "@/lib/dashboard";
import { formatNumber } from "@/lib/format";
import { enforcePagePermission } from "@/lib/permissions";

export default async function DashboardPage() {
  const session = await enforcePagePermission(PermissionResource.DASHBOARD, PermissionAction.VIEW);
  const companyId = session.companyId;
  const kpiData = await getDashboardKpis(companyId);

  const kpis = [
    { label: "Open Shipments", value: formatNumber(kpiData.openShipments) },
    { label: "Delayed Milestones", value: formatNumber(kpiData.delayedMilestones) },
    { label: "Quotes Sent", value: formatNumber(kpiData.quotesSent) },
    {
      label: "Gross Margin (base)",
      value: formatNumber(kpiData.estimatedGrossMargin),
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{kpi.label}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{kpi.value}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
