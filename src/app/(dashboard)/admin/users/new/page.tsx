import { PermissionAction, PermissionResource } from "@prisma/client";

import { createAdminUserAction } from "@/app/(dashboard)/admin/actions";
import { AdminUserForm } from "@/components/admin/admin-user-form";
import { enforcePagePermission } from "@/lib/permissions";

export default async function NewAdminUserPage() {
  await enforcePagePermission(PermissionResource.ADMIN, PermissionAction.CREATE);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New user</h1>
        <p className="text-sm text-slate-600">Create an internal user and assign operational role access.</p>
      </div>
      <AdminUserForm
        action={createAdminUserAction}
        submitLabel="Create user"
        includePassword
        defaults={{ isActive: true }}
      />
    </div>
  );
}
