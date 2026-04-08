"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Package, ShipWheel } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Building2 },
  { href: "/quotes", label: "Quotes", icon: Package },
  { href: "/shipments", label: "Shipments", icon: ShipWheel },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 border-r border-zinc-200 bg-white lg:block">
      <div className="border-b border-zinc-200 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          AtlasCargo
        </p>
        <h1 className="text-lg font-semibold text-zinc-900">Freight Platform</h1>
      </div>
      <nav className="space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
