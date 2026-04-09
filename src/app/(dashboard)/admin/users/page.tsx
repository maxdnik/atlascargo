import Link from "next/link";
import { PermissionAction, PermissionResource } from "@prisma/client";

import { roleDisplayName } from "@/lib/permission-config";
import { listCompanyUsers } from "@/lib/admin";
import { enforcePagePermission } from "@/lib/permissions";
import { toggleAdminUserActiveAction } from "@/app/(dashboard)/admin/actions";

function roleBadgeClass(role: string) {
  if (role === "SUPER_ADMIN") return "bg-violet-100 text-violet-700";
  if (role === "MANAGEMENT") return "bg-indigo-100 text-indigo-700";
  if (role === "FINANCE") return "bg-emerald-100 text-emerald-700";
  if (role === "OPERATIONS") return "bg-blue-100 text-blue-700";
  if (role === "SALES") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export default async function AdminUsersPage() {
  const sessionUser = await enforcePagePermission(PermissionResource.ADMIN, PermissionAction.VIEW);
  const users = await listCompanyUsers(sessionUser.companyId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin · Users</h1>
          <p className="text-sm text-slate-500">Manage internal users, role assignments, and account status.</p>
        </div>
        <Link
          href="/admin/users/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New user
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={6}>
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="text-sm text-slate-700">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClass(
                        user.role,
                      )}`}
                    >
                      {roleDisplayName[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link href={`/admin/users/${user.id}`} className="text-slate-700 hover:underline">
                        Edit
                      </Link>
                      <form action={toggleAdminUserActiveAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <button className="text-slate-700 hover:underline" type="submit">
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
