import { Bell, Filter, Search, Settings2 } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/layout/sign-out-button";

export async function Topbar() {
  const session = await getServerSession(authOptions);
  const initial =
    session?.user?.name
      ?.split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-gradient-to-r from-white via-slate-50 to-blue-50/30 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500">AtlasCargo Platform</p>
          <p className="truncate text-base font-semibold text-slate-900">Logistics Operations Control Center</p>
        </div>
        <div className="hidden max-w-md flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm md:flex">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            readOnly
            value="Search shipments, refs, customers..."
            className="w-full bg-transparent text-sm text-slate-500 outline-none"
            aria-label="Global search placeholder"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Quick filters"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Settings"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold text-slate-900">{session?.user?.name}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">{session?.user?.role}</p>
          </div>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-sm">
            {initial}
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
