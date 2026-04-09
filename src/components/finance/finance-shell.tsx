import { Banknote } from "lucide-react";
import { FinanceSubnav } from "@/components/finance/finance-subnav";
import type { FinanceNavItem } from "@/lib/finance-navigation";

type FinanceShellProps = {
  title: string;
  subtitle: string;
  navItems: FinanceNavItem[];
  children: React.ReactNode;
};

export function FinanceShell({ title, subtitle, navItems, children }: FinanceShellProps) {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Banknote className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          </div>
        </div>
      </header>

      <FinanceSubnav items={navItems} />
      {children}
    </div>
  );
}
