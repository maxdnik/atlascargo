import { PermissionAction, PermissionResource } from "@prisma/client";

import { actionLabels, moduleLabels, roleDisplayName } from "@/lib/permission-config";
import { getCompanyRolesWithPermissions, toPermissionSet } from "@/lib/admin";
import { enforcePagePermission } from "@/lib/permissions";

const orderedResources: PermissionResource[] = [
  PermissionResource.DASHBOARD,
  PermissionResource.CUSTOMERS,
  PermissionResource.QUOTES,
  PermissionResource.SHIPMENTS,
  PermissionResource.DOCUMENTS,
  PermissionResource.REVENUE,
  PermissionResource.EXPENSES,
  PermissionResource.REPORTS,
  PermissionResource.ADMIN,
];

const orderedActions: PermissionAction[] = [
  PermissionAction.VIEW,
  PermissionAction.CREATE,
  PermissionAction.EDIT,
  PermissionAction.DELETE,
  PermissionAction.APPROVE,
  PermissionAction.VIEW_FINANCIALS,
];

export default async function AdminPermissionsPage() {
  const session = await enforcePagePermission("ADMIN", "VIEW");
  const roles = await getCompanyRolesWithPermissions(session.companyId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Role Permissions Matrix</h1>
        <p className="text-sm text-slate-500">
          Practical module-level controls for operations, commercial, and finance teams.
        </p>
      </div>

      <div className="space-y-4">
        {roles.map((role) => {
          const permissionSet = toPermissionSet(role.permissions);

          return (
            <section
              key={role.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  {roleDisplayName[role.code]}{" "}
                  <span className="text-xs font-normal text-slate-500">({role.code})</span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Module</th>
                      {orderedActions.map((action) => (
                        <th key={action} className="px-4 py-3">
                          {actionLabels[action]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {orderedResources.map((resource) => (
                      <tr key={resource}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {moduleLabels[resource]}
                        </td>
                        {orderedActions.map((action) => {
                          const enabled = permissionSet.has(`${resource}:${action}`);
                          return (
                            <td key={`${resource}-${action}`} className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  enabled
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {enabled ? "Yes" : "No"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
