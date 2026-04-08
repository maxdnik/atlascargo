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
};

export type { SidebarNavItem };

type SidebarProps = {
  items?: SidebarNavItem[];
};

const defaultNavItems: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/shipments", label: "Shipments", icon: "shipments" },
  { href: "/quotes", label: "Quotes", icon: "quotes" },
  { href: "/customers", label: "Customers", icon: "customers" },
  { href: "/shipments?status=IN_TRANSIT", label: "Finance", icon: "finance" },
  { href: "/quotes?status=APPROVED", label: "Reports", icon: "reports" },
  { href: "/admin/users", label: "Admin", icon: "admin" },
];

export function Sidebar({ items = defaultNavItems }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 z-30 hidden w-72 border-r border-slate-800 bg-slate-950 lg:block">
      <div className="border-b border-slate-800 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          AtlasCargo
        </p>
        <h1 className="mt-2 text-lg font-semibold text-slate-100">Operations Control Center</h1>
        <p className="mt-1 text-xs text-slate-400">Freight forwarding live workspace</p>
      </div>
      <nav className="space-y-1 p-4">
        {items.map((item) => {
          const [itemPath] = item.href.split("?");
          const isActive =
            pathname === itemPath || pathname.startsWith(`${itemPath}/`);
          const Icon = iconMap[item.icon];

          return (
            <Link
              key={item.id ?? `${item.href}-${item.label}`}
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
