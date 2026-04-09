"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FinanceNavItem } from "@/lib/finance-navigation";

type FinanceSubnavProps = {
  items: FinanceNavItem[];
};

export function FinanceSubnav({ items }: FinanceSubnavProps) {
  const pathname = usePathname();

  return (
    <nav className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
      <ul className="flex flex-wrap gap-1">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/finance" && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`inline-flex rounded-xl px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
