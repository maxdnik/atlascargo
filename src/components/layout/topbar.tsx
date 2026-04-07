import { Bell } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/layout/sign-out-button";

export async function Topbar() {
  const session = await getServerSession(authOptions);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div>
          <p className="text-sm text-slate-500">AtlasCargo Platform</p>
          <p className="text-base font-semibold text-slate-900">Operations Console</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{session?.user?.name}</p>
            <p className="text-xs text-slate-500">{session?.user?.role}</p>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
