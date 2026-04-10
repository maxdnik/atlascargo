"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  LayoutDashboard,
  Package,
  ReceiptText,
  ShipWheel,
  Users2,
} from "lucide-react";

const iconMap = {
  dashboard: LayoutDashboard,
  actionCenter: AlertTriangle,
  shipments: ShipWheel,
  quotes: Package,
  customers: Users2,
  finance: ReceiptText,
  reports: BarChart3,
  admin: BriefcaseBusiness,
} as const;

type SidebarNavItem = {
  id?: string;
  href: string;
  label: string;
  icon: keyof typeof iconMap;
  section: string;
  match?: "exact" | "prefix";
  children?: SidebarNavItem[];
};

export type { SidebarNavItem };

type SidebarProps = {
  items?: SidebarNavItem[];
};

const defaultNavItems: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", section: "dashboard", match: "prefix" },
  {
    href: "/dashboard/action-center",
    label: "Action Center",
    icon: "actionCenter",
    section: "dashboard",
    match: "prefix",
  },
  { href: "/reports", label: "Reports", icon: "reports", section: "reports", match: "prefix" },
  { href: "/customers", label: "Customers", icon: "customers", section: "customers", match: "prefix" },
  { href: "/shipments", label: "Shipments", icon: "shipments", section: "shipments", match: "prefix" },
  { href: "/quotes", label: "Quotes", icon: "quotes", section: "quotes", match: "prefix" },
  {
    href: "/finance",
    label: "Finance",
    icon: "finance",
    section: "finance",
    match: "prefix",
    children: [
      {
        href: "/finance/invoices",
        label: "Invoices",
        icon: "finance",
        section: "finance",
        match: "prefix",
      },
      {
        href: "/finance/expenses",
        label: "General Expenses",
        icon: "finance",
        section: "finance",
        match: "prefix",
      },
      {
        href: "/finance/ar",
        label: "Accounts Receivable",
        icon: "finance",
        section: "finance",
        match: "prefix",
      },
      {
        href: "/finance/ap",
        label: "Accounts Payable",
        icon: "finance",
        section: "finance",
        match: "prefix",
      },
      {
        href: "/finance/profitability",
        label: "Shipment Profitability",
        icon: "finance",
        section: "finance",
        match: "prefix",
      },
      {
        href: "/finance/forecast",
        label: "Cash Forecast",
        icon: "finance",
        section: "finance",
        match: "prefix",
      },
    ],
  },
  { href: "/admin/users", label: "Admin", icon: "admin", section: "admin", match: "prefix" },
];

export function Sidebar({ items = defaultNavItems }: SidebarProps) {
  const pathname = usePathname();

  const normalizedPathname =
    pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const financeRouteActive = normalizedPathname === "/finance" || normalizedPathname.startsWith("/finance/");
  const [financeExpanded, setFinanceExpanded] = useState<boolean>(financeRouteActive);

  useEffect(() => {
    if (financeRouteActive) {
      setFinanceExpanded(true);
    }
  }, [financeRouteActive]);

  const getItemId = (item: SidebarNavItem) => item.id ?? `${item.href}-${item.label}`;

  const activeItemId = useMemo(() => {
    const scored: Array<{ id: string; score: number; order: number }> = [];
    let order = 0;
    const collect = (entry: SidebarNavItem) => {
      const id = getItemId(entry);
      const normalizedHref =
        entry.href.endsWith("/") && entry.href !== "/" ? entry.href.slice(0, -1) : entry.href;
      const entryHref =
        entry.href.endsWith("/") && entry.href !== "/" ? entry.href.slice(0, -1) : entry.href;
      const entryMatchMode = entry.match ?? "prefix";
      const entryMatched =
        normalizedPathname === entryHref ||
        (entryMatchMode === "prefix" ? normalizedPathname.startsWith(`${entryHref}/`) : false);
      if (entryMatched) {
        const isExact = normalizedPathname === normalizedHref;
        scored.push({
          id,
          score: isExact ? normalizedHref.length + 10_000 : normalizedHref.length,
          order: order++,
        });
      }
      entry.children?.forEach((child) => {
        const childId = getItemId(child);
        const childHref = child.href.endsWith("/") && child.href !== "/" ? child.href.slice(0, -1) : child.href;
        const childMatchMode = child.match ?? "prefix";
        const childMatched =
          normalizedPathname === childHref ||
          (childMatchMode === "prefix" ? normalizedPathname.startsWith(`${childHref}/`) : false);
        if (childMatched) {
          const childExact = normalizedPathname === childHref;
          scored.push({
            id: childId,
            score: childExact ? childHref.length + 10_000 : childHref.length,
            order: order++,
          });
        }
      });
    };
    items.forEach(collect);
    return scored.sort((a, b) => (a.score === b.score ? a.order - b.order : b.score - a.score))[0]?.id ?? null;
  }, [items, normalizedPathname]);

  return (
    <aside className="z-30 hidden h-screen w-72 shrink-0 border-r border-slate-800 bg-slate-950 lg:sticky lg:top-0 lg:block">
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-slate-800 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">AtlasCargo</p>
          <h1 className="mt-2 text-lg font-semibold text-slate-100">Operations Control Center</h1>
          <p className="mt-1 text-xs text-slate-400">Freight forwarding live workspace</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4 pr-2">
          {items.map((item) => {
            const itemId = getItemId(item);
            const Icon = iconMap[item.icon];
            const hasChildren = Boolean(item.children?.length);

            if (hasChildren) {
              const parentActive = itemId === activeItemId;

              return (
                <div key={itemId} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setFinanceExpanded((prev) => !prev)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      parentActive
                        ? "bg-blue-600/20 text-blue-200 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.45)]"
                        : "text-slate-300 hover:bg-slate-900 hover:text-slate-100"
                    }`}
                    aria-expanded={financeExpanded}
                    aria-controls="finance-submenu"
                  >
                    <Icon
                      className={`h-4 w-4 transition ${
                        parentActive ? "text-blue-300" : "text-slate-400 group-hover:text-slate-200"
                      }`}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronRight
                      className={`h-4 w-4 transition-transform duration-200 ${
                        financeExpanded ? "rotate-90 text-slate-200" : "text-slate-500"
                      }`}
                    />
                  </button>

                  <div
                    id="finance-submenu"
                    className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
                      financeExpanded ? "max-h-[32rem] opacity-100" : "pointer-events-none max-h-0 opacity-0"
                    }`}
                    style={{ display: financeExpanded ? "block" : "none" }}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-1 pl-9">
                        {item.children?.map((child) => {
                          const childId = getItemId(child);
                          const childIsActive = childId === activeItemId;
                          return (
                            <Link
                              key={childId}
                              href={child.href}
                              className={`block rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                                childIsActive
                                  ? "bg-blue-500/20 text-blue-200 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.35)]"
                                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                              }`}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const isActive = itemId === activeItemId;
            return (
              <Link
                key={itemId}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-600/20 text-blue-200 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.45)]"
                    : "text-slate-300 hover:bg-slate-900 hover:text-slate-100"
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition ${
                    isActive ? "text-blue-300" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="m-4 mt-2 shrink-0 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <p className="text-xs font-medium text-slate-300">Realtime board</p>
          <p className="mt-1 text-xs text-slate-500">Track movements, finance, and incidents.</p>
        </div>
      </div>
    </aside>
  );
}
