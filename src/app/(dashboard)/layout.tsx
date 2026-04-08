import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { baseRolePermissionMatrix } from "@/lib/permission-config";
import type { SidebarNavItem } from "@/components/layout/sidebar";
import { getVisibleModulesForCurrentUser } from "@/lib/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const moduleAccess = await getVisibleModulesForCurrentUser(session.user);
  const fallbackViewModules = new Set(
    (baseRolePermissionMatrix[session.user.role] ?? [])
      .filter((entry) => entry[1] === PermissionAction.VIEW)
      .map((entry) => entry[0]),
  );
  const visibleModules = moduleAccess.size > 0 ? moduleAccess : fallbackViewModules;
  const navItems: SidebarNavItem[] = [];

  if (visibleModules.has(PermissionResource.DASHBOARD)) {
    navItems.push({ href: "/dashboard", label: "Dashboard", icon: "dashboard" });
  }
  if (visibleModules.has(PermissionResource.CUSTOMERS)) {
    navItems.push({ href: "/customers", label: "Customers", icon: "customers" });
  }
  if (visibleModules.has(PermissionResource.SHIPMENTS)) {
    navItems.push({ href: "/shipments", label: "Shipments", icon: "shipments" });
  }
  if (visibleModules.has(PermissionResource.QUOTES)) {
    navItems.push({ href: "/quotes", label: "Quotes", icon: "quotes" });
  }
  if (
    visibleModules.has(PermissionResource.REVENUE) ||
    visibleModules.has(PermissionResource.EXPENSES)
  ) {
    navItems.push({ href: "/shipments", label: "Finance", icon: "finance" });
  }
  if (visibleModules.has(PermissionResource.REPORTS)) {
    navItems.push({ href: "/dashboard", label: "Reports", icon: "reports" });
  }
  if (visibleModules.has(PermissionResource.ADMIN)) {
    navItems.push({ href: "/admin/users", label: "Admin", icon: "admin" });
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <Sidebar items={navItems} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
