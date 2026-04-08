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
    navItems.push({
      id: "dashboard",
      href: "/dashboard",
      label: "Dashboard",
      icon: "dashboard",
      section: "dashboard",
    });
  }
  if (visibleModules.has(PermissionResource.REPORTS)) {
    navItems.push({
      id: "reports",
      href: "/reports",
      label: "Reports",
      icon: "reports",
      section: "reports",
    });
  }
  if (visibleModules.has(PermissionResource.CUSTOMERS)) {
    navItems.push({
      id: "customers",
      href: "/customers",
      label: "Customers",
      icon: "customers",
      section: "customers",
    });
  }
  if (visibleModules.has(PermissionResource.SHIPMENTS)) {
    navItems.push({
      id: "shipments",
      href: "/shipments",
      label: "Shipments",
      icon: "shipments",
      section: "shipments",
    });
  }
  if (visibleModules.has(PermissionResource.QUOTES)) {
    navItems.push({
      id: "quotes",
      href: "/quotes",
      label: "Quotes",
      icon: "quotes",
      section: "quotes",
    });
  }
  if (
    visibleModules.has(PermissionResource.REVENUE) ||
    visibleModules.has(PermissionResource.EXPENSES)
  ) {
    navItems.push({
      id: "finance",
      href: "/finance",
      label: "Finance",
      icon: "finance",
      section: "finance",
      match: "exact",
    });
  }
  if (visibleModules.has(PermissionResource.REVENUE)) {
    navItems.push({
      id: "invoices",
      href: "/finance/invoices",
      label: "Invoices",
      icon: "finance",
      section: "finance",
      match: "prefix",
    });
  }
  if (visibleModules.has(PermissionResource.EXPENSES)) {
    navItems.push({
      id: "general-expenses",
      href: "/finance/expenses",
      label: "General Expenses",
      icon: "finance",
      section: "finance",
      match: "prefix",
    });
  }
  if (visibleModules.has(PermissionResource.ADMIN)) {
    navItems.push({
      id: "admin",
      href: "/admin/users",
      label: "Admin",
      icon: "admin",
      section: "admin",
      match: "prefix",
    });
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
