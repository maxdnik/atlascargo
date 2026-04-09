"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
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
  children?: SidebarNavChildItem[];
};

type SidebarNavChildItem = {
  id?: string;
  href: string;
  label: string;
  match?: "exact" | "prefix";
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
  { href: "/shipments", label: "Shipments", icon: "shipments", section: "shipments", match: "prefix" },
  { href: "/quotes", label: "Quotes", icon: "quotes", section: "quotes", match: "prefix" },
  { href: "/customers", label: "Customers", icon: "customers", section: "customers", match: "prefix" },
  {
    id: "finance",
    href: "/finance",
    label: "Finance",
    icon: "finance",
    section: "finance",
    match: "prefix",
    children: [
      { id: "invoices", href: "/finance/invoices", label: "Invoices", match: "prefix" },
      { id: "general-expenses", href: "/finance/expenses", label: "General Expenses", match: "prefix" },
      { id: "finance-ar", href: "/finance/ar", label: "Accounts Receivable", match: "prefix" },
      { id: "finance-ap", href: "/finance/ap", label: "Accounts Payable", match: "prefix" },
      {
        id: "finance-profitability",
        href: "/finance/profitability",
        label: "Shipment Profitability",
        match: "prefix",
      },
      { id: "finance-forecast", href: "/finance/forecast", label: "Cash Forecast", match: "prefix" },
    ],
  },
  { href: "/reports", label: "Reports", icon: "reports", section: "reports", match: "prefix" },
  { href: "/admin/users", label: "Admin", icon: "admin", section: "admin", match: "prefix" },
];

function normalizePath(path: string) {
  return path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
}

function isPathMatch(pathname: string, href: string, match: "exact" | "prefix" = "prefix") {
  const normalizedHref = normalizePath(href);
  const isExact = pathname === normalizedHref;
  const isPrefix = match === "prefix" && pathname.startsWith(`${normalizedHref}/`);
  return isExact || isPrefix;
}

export function Sidebar({ items = defaultNavItems }: SidebarProps) {
  const pathname = usePathname();
  const normalizedPathname = normalizePath(pathname);
  const isFinanceRoute = normalizedPathname === "/finance" || normalizedPathname.startsWith("/finance/");
  const [isFinanceExpanded, setIsFinanceExpanded] = useState(false);

  const activeChildByParent = useMemo(() => {
    const active = new Map<string, string | null>();
    for (const item of items) {
      if (!item.children || item.children.length === 0) continue;
      const parentId = item.id ?? `${item.href}-${item.label}`;
      const childMatch = [...item.children]
        .sort((a, b) => b.href.length - a.href.length)
        .find((child) => isPathMatch(normalizedPathname, child.href, child.match ?? "prefix"));
      const childId = childMatch ? childMatch.id ?? `${childMatch.href}-${childMatch.label}` : null;
      active.set(parentId, childId);
    }
    return active;
  }, [items, normalizedPathname]);

  return (
    <aside className="z-30 hidden h-screen w-72 shrink-0 border-r border-slate-800 bg-slate-950 lg:sticky lg:top-0 lg:block">
      <div className="border-b border-slate-800 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          AtlasCargo
        </p>
        <h1 className="mt-2 text-lg font-semibold text-slate-100">Operations Control Center</h1>
        <p className="mt-1 text-xs text-slate-400">Freight forwarding live workspace</p>
      </div>
      <nav className="space-y-1 p-4">
        {items.map((item) => {
          const itemId = item.id ?? `${item.href}-${item.label}`;
          const hasChildren = Boolean(item.children && item.children.length > 0);
          const isChildActive = Boolean(activeChildByParent.get(itemId));
          const isDirectActive = isPathMatch(normalizedPathname, item.href, item.match ?? "prefix");
          const isActive = isDirectActive || isChildActive;
          const Icon = iconMap[item.icon];
          const isFinanceParent = itemId === "finance" && hasChildren;
          const isExpanded = isFinanceParent ? isFinanceRoute || isFinanceExpanded : false;

          if (hasChildren) {
            return (
              <div key={itemId} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setIsFinanceExpanded((prev) => !prev)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
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
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronRight
                    className={`h-4 w-4 transition-transform duration-200 ${
                      isExpanded ? "rotate-90 text-blue-300" : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />
                </button>

                <div
                  className={`overflow-hidden transition-all duration-200 ease-out ${
                    isExpanded ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="space-y-1 pl-10">
                    {item.children!.map((child) => {
                      const childId = child.id ?? `${child.href}-${child.label}`;
                      const childActive = childId === activeChildByParent.get(itemId);
                      return (
                        <Link
                          key={childId}
                          href={child.href}
                          className={`block rounded-lg px-3 py-2 text-xs font-medium transition ${
                            childActive
                              ? "bg-blue-600/20 text-blue-200 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.45)]"
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
            );
          }

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
      <div className="absolute inset-x-4 bottom-4 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
        <p className="text-xs font-medium text-slate-300">Realtime board</p>
        <p className="mt-1 text-xs text-slate-500">Track movements, finance, and incidents.</p>
      </div>
    </aside>
  );
}
