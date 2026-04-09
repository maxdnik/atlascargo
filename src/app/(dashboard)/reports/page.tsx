import { BarChart3, ClipboardList, LineChart, PlaneTakeoff, ShipWheel, Truck } from "lucide-react";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { enforcePagePermission } from "@/lib/permissions";

export default async function ReportsPage() {
  await enforcePagePermission(PermissionResource.REPORTS, PermissionAction.VIEW);

  const placeholders = [
    {
      title: "Operational KPIs",
      description: "Service level, transit times, and milestone completion by mode.",
      icon: BarChart3,
    },
    {
      title: "Mode Performance",
      description: "Comparative execution quality for air, ocean, and road flows.",
      icon: LineChart,
    },
    {
      title: "Lane Insights",
      description: "Origin-destination trends and bottleneck detection.",
      icon: ClipboardList,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Reports Hub</h1>
        <p className="mt-1 text-sm text-slate-500">
          Operational intelligence and management reporting workspace.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AIR</p>
          <div className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <PlaneTakeoff className="h-4 w-4 text-sky-600" />
            Performance dashboard
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">OCEAN</p>
          <div className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <ShipWheel className="h-4 w-4 text-indigo-600" />
            Performance dashboard
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ROAD</p>
          <div className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <Truck className="h-4 w-4 text-emerald-600" />
            Performance dashboard
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {placeholders.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
