"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  LayoutDashboard,
  Package,
  ReceiptText,
  ShipWheel,
  Users2,
} from "lucide-react";

const iconMap = {
  dashboard: LayoutDashboard,
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
};

export type { SidebarNavItem };

type SidebarProps = {
  items?: SidebarNavItem[];
};

const defaultNavItems: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", section: "dashboard", match: "prefix" },
  { href: "/shipments", label: "Shipments", icon: "shipments", section: "shipments", match: "prefix" },
  { href: "/quotes", label: "Quotes", icon: "quotes", section: "quotes", match: "prefix" },
  { href: "/customers", label: "Customers", icon: "customers", section: "customers", match: "prefix" },
  { href: "/finance", label: "Finance", icon: "finance", section: "finance", match: "prefix" },
  { href: "/finance/invoices", label: "Invoices", icon: "finance", section: "finance", match: "prefix" },
  { href: "/finance/expenses", label: "Expenses", icon: "finance", section: "finance", match: "prefix" },
  { href: "/reports", label: "Reports", icon: "reports", section: "reports", match: "prefix" },
  { href: "/admin/users", label: "Admin", icon: "admin", section: "admin", match: "prefix" },
];

export function Sidebar({ items = defaultNavItems }: SidebarProps) {
  const pathname = usePathname();

  const normalizedPathname =
    pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const activeItemId =
    items
      .map((item, index) => {
        const normalizedHref = item.href.endsWith("/") && item.href !== "/" ? item.href.slice(0, -1) : item.href;
        const matchMode = item.match ?? "prefix";
        const isExactMatch = normalizedPathname === normalizedHref;
        const isPrefixMatch =
          normalizedPathname.startsWith(`${normalizedHref}/`) && matchMode === "prefix";
        if (!isExactMatch && !isPrefixMatch) {
          return { id: item.id ?? `${item.href}-${item.label}`, score: -1, index };
        }
        const score = isExactMatch ? normalizedHref.length + 10_000 : normalizedHref.length;
        return { id: item.id ?? `${item.href}-${item.label}`, score, index };
      })
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => (a.score === b.score ? a.index - b.index : b.score - a.score))[0]?.id ?? null;

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
          const isActive = itemId === activeItemId;
          const Icon = iconMap[item.icon];

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
