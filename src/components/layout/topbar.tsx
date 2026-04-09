import Link from "next/link";
import { Bell, Filter, Search, Settings2 } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { prisma } from "@/lib/prisma";
import { listOpenAlertsForUser } from "@/lib/alerts";

export async function Topbar() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const [unreadCount, recentNotifications, openAlerts] = userId
    ? await Promise.all([
        prisma.notification.count({
          where: {
            userId,
            readAt: null,
          },
        }),
        prisma.notification.findMany({
          where: { userId },
          orderBy: [{ createdAt: "desc" }],
          take: 5,
          select: {
            id: true,
            title: true,
            body: true,
            link: true,
            createdAt: true,
          },
        }),
        listOpenAlertsForUser(userId, 5),
      ])
    : [0, [], []];

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
          <div className="group relative">
            <button
              type="button"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-700"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>
            <div className="absolute right-0 top-12 z-30 hidden w-96 rounded-xl border border-slate-200 bg-white p-3 shadow-xl group-hover:block">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">In-app notifications</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {unreadCount} unread
                </span>
              </div>
              <div className="mb-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Open alerts
                </p>
                <div className="space-y-2">
                  {openAlerts.length === 0 ? (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs text-emerald-700">
                      No open alerts.
                    </p>
                  ) : (
                    openAlerts.map((alert) => (
                      <Link
                        key={alert.id}
                        href={alert.ctaHref}
                        className={`block rounded-lg border px-2 py-2 ${
                          alert.severity === "HIGH"
                            ? "border-rose-200 bg-rose-50"
                            : alert.severity === "MEDIUM"
                              ? "border-amber-200 bg-amber-50"
                              : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <p className="text-xs font-semibold text-slate-900">
                          {alert.shipmentNumber ? `${alert.shipmentNumber} · ` : ""}
                          {alert.customerName ?? "Alert"}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-700">{alert.message}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {recentNotifications.length === 0 ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">
                    No notifications yet.
                  </p>
                ) : (
                  recentNotifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href={notification.link ?? "/dashboard/action-center"}
                      className="block rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 hover:bg-slate-100"
                    >
                      <p className="text-xs font-semibold text-slate-900">{notification.title}</p>
                      {notification.body ? (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">{notification.body}</p>
                      ) : null}
                      <p className="mt-1 text-[10px] text-slate-500">{notification.createdAt.toLocaleString()}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
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
