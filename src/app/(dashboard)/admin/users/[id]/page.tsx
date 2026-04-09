import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";

import {
  resetAdminUserPasswordAction,
  toggleAdminUserActiveAction,
  updateAdminUserAction,
} from "@/app/(dashboard)/admin/actions";
import { AdminUserForm } from "@/components/admin/admin-user-form";
import { PasswordResetForm } from "@/components/admin/password-reset-form";
import { getCompanyUserById } from "@/lib/admin";
import { roleDisplayName } from "@/lib/permission-config";
import { enforcePagePermission } from "@/lib/permissions";

type AdminUserEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const roleBadgeClass: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-violet-100 text-violet-700",
  MANAGEMENT: "bg-blue-100 text-blue-700",
  SALES: "bg-amber-100 text-amber-800",
  OPERATIONS: "bg-emerald-100 text-emerald-700",
  CUSTOMER_SERVICE: "bg-cyan-100 text-cyan-700",
  ADMINISTRATION: "bg-orange-100 text-orange-700",
  FINANCE: "bg-slate-200 text-slate-800",
};

export default async function AdminUserEditPage({ params }: AdminUserEditPageProps) {
  const session = await enforcePagePermission("ADMIN", "EDIT");
  const { id } = await params;

  const user = await getCompanyUserById(session.companyId, id);
  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Edit User</h1>
          <p className="text-sm text-slate-600">Update role, status, and access profile.</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClass[user.role]}`}
          >
            {roleDisplayName[user.role]}
          </span>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
              user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {user.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <AdminUserForm
        action={updateAdminUserAction}
        submitLabel="Update user"
        defaults={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={toggleAdminUserActiveAction} className="rounded-xl border border-slate-200 bg-white p-4">
          <input type="hidden" name="id" value={user.id} />
          <h3 className="text-sm font-semibold text-slate-900">Activation</h3>
          <p className="mt-1 text-xs text-slate-500">
            {user.isActive
              ? "Deactivate to immediately block login and access."
              : "Activate to allow this user to log in again."}
          </p>
          <button
            type="submit"
            className={`mt-3 rounded-md px-4 py-2 text-sm font-medium ${
              user.isActive
                ? "border border-rose-200 text-rose-700 hover:bg-rose-50"
                : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            {user.isActive ? "Deactivate user" : "Activate user"}
          </button>
        </form>

        <PasswordResetForm userId={user.id} action={resetAdminUserPasswordAction} />
      </div>
    </div>
  );
}
