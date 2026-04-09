import { PermissionAction, PermissionResource, UserRole } from "@prisma/client";

export const permissionResources = [
  PermissionResource.DASHBOARD,
  PermissionResource.CUSTOMERS,
  PermissionResource.QUOTES,
  PermissionResource.SHIPMENTS,
  PermissionResource.DOCUMENTS,
  PermissionResource.REVENUE,
  PermissionResource.EXPENSES,
  PermissionResource.REPORTS,
  PermissionResource.ADMIN,
] as const;

export const permissionActions = [
  PermissionAction.VIEW,
  PermissionAction.CREATE,
  PermissionAction.EDIT,
  PermissionAction.DELETE,
  PermissionAction.APPROVE,
  PermissionAction.VIEW_FINANCIALS,
] as const;

export const moduleLabels: Record<PermissionResource, string> = {
  [PermissionResource.DASHBOARD]: "Dashboard",
  [PermissionResource.CUSTOMERS]: "Customers",
  [PermissionResource.QUOTES]: "Quotes",
  [PermissionResource.SHIPMENTS]: "Shipments",
  [PermissionResource.DOCUMENTS]: "Documents",
  [PermissionResource.REVENUE]: "Revenue",
  [PermissionResource.EXPENSES]: "Expenses",
  [PermissionResource.REPORTS]: "Reports",
  [PermissionResource.ADMIN]: "Admin",
};

export const actionLabels: Record<PermissionAction, string> = {
  [PermissionAction.VIEW]: "View",
  [PermissionAction.CREATE]: "Create",
  [PermissionAction.EDIT]: "Edit",
  [PermissionAction.DELETE]: "Delete",
  [PermissionAction.APPROVE]: "Approve",
  [PermissionAction.VIEW_FINANCIALS]: "View Financials",
};

export const roleDisplayName: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "Super Admin",
  [UserRole.MANAGEMENT]: "Management",
  [UserRole.SALES]: "Sales",
  [UserRole.OPERATIONS]: "Operations",
  [UserRole.CUSTOMER_SERVICE]: "Customer Service",
  [UserRole.ADMINISTRATION]: "Administration",
  [UserRole.FINANCE]: "Finance",
};

export type PermissionTuple = readonly [PermissionResource, PermissionAction];

const fullAccess: PermissionTuple[] = permissionResources.flatMap((resource) =>
  permissionActions.map((action) => [resource, action] as const),
);

export const baseRolePermissionMatrix: Record<UserRole, PermissionTuple[]> = {
  [UserRole.SUPER_ADMIN]: fullAccess,
  [UserRole.MANAGEMENT]: [
    [PermissionResource.DASHBOARD, PermissionAction.VIEW],
    [PermissionResource.CUSTOMERS, PermissionAction.VIEW],
    [PermissionResource.QUOTES, PermissionAction.VIEW],
    [PermissionResource.QUOTES, PermissionAction.APPROVE],
    [PermissionResource.SHIPMENTS, PermissionAction.VIEW],
    [PermissionResource.DOCUMENTS, PermissionAction.VIEW],
    [PermissionResource.REVENUE, PermissionAction.VIEW],
    [PermissionResource.REVENUE, PermissionAction.VIEW_FINANCIALS],
    [PermissionResource.EXPENSES, PermissionAction.VIEW],
    [PermissionResource.EXPENSES, PermissionAction.VIEW_FINANCIALS],
    [PermissionResource.REPORTS, PermissionAction.VIEW],
    [PermissionResource.REPORTS, PermissionAction.VIEW_FINANCIALS],
    [PermissionResource.ADMIN, PermissionAction.VIEW],
  ],
  [UserRole.SALES]: [
    [PermissionResource.DASHBOARD, PermissionAction.VIEW],
    [PermissionResource.CUSTOMERS, PermissionAction.VIEW],
    [PermissionResource.CUSTOMERS, PermissionAction.CREATE],
    [PermissionResource.CUSTOMERS, PermissionAction.EDIT],
    [PermissionResource.QUOTES, PermissionAction.VIEW],
    [PermissionResource.QUOTES, PermissionAction.CREATE],
    [PermissionResource.QUOTES, PermissionAction.EDIT],
    [PermissionResource.SHIPMENTS, PermissionAction.VIEW],
    [PermissionResource.DOCUMENTS, PermissionAction.VIEW],
  ],
  [UserRole.OPERATIONS]: [
    [PermissionResource.DASHBOARD, PermissionAction.VIEW],
    [PermissionResource.CUSTOMERS, PermissionAction.VIEW],
    [PermissionResource.QUOTES, PermissionAction.VIEW],
    [PermissionResource.SHIPMENTS, PermissionAction.VIEW],
    [PermissionResource.SHIPMENTS, PermissionAction.CREATE],
    [PermissionResource.SHIPMENTS, PermissionAction.EDIT],
    [PermissionResource.DOCUMENTS, PermissionAction.VIEW],
    [PermissionResource.DOCUMENTS, PermissionAction.CREATE],
    [PermissionResource.DOCUMENTS, PermissionAction.EDIT],
    [PermissionResource.DOCUMENTS, PermissionAction.DELETE],
    [PermissionResource.REVENUE, PermissionAction.VIEW],
    [PermissionResource.EXPENSES, PermissionAction.VIEW],
  ],
  [UserRole.CUSTOMER_SERVICE]: [
    [PermissionResource.DASHBOARD, PermissionAction.VIEW],
    [PermissionResource.CUSTOMERS, PermissionAction.VIEW],
    [PermissionResource.QUOTES, PermissionAction.VIEW],
    [PermissionResource.SHIPMENTS, PermissionAction.VIEW],
    [PermissionResource.DOCUMENTS, PermissionAction.VIEW],
  ],
  [UserRole.ADMINISTRATION]: [
    [PermissionResource.DASHBOARD, PermissionAction.VIEW],
    [PermissionResource.CUSTOMERS, PermissionAction.VIEW],
    [PermissionResource.CUSTOMERS, PermissionAction.CREATE],
    [PermissionResource.CUSTOMERS, PermissionAction.EDIT],
    [PermissionResource.QUOTES, PermissionAction.VIEW],
    [PermissionResource.SHIPMENTS, PermissionAction.VIEW],
    [PermissionResource.DOCUMENTS, PermissionAction.VIEW],
    [PermissionResource.DOCUMENTS, PermissionAction.CREATE],
    [PermissionResource.DOCUMENTS, PermissionAction.EDIT],
    [PermissionResource.REVENUE, PermissionAction.VIEW],
    [PermissionResource.REVENUE, PermissionAction.CREATE],
    [PermissionResource.REVENUE, PermissionAction.EDIT],
    [PermissionResource.EXPENSES, PermissionAction.VIEW],
    [PermissionResource.EXPENSES, PermissionAction.CREATE],
    [PermissionResource.EXPENSES, PermissionAction.EDIT],
    [PermissionResource.REPORTS, PermissionAction.VIEW],
    [PermissionResource.ADMIN, PermissionAction.VIEW],
    [PermissionResource.ADMIN, PermissionAction.CREATE],
    [PermissionResource.ADMIN, PermissionAction.EDIT],
  ],
  [UserRole.FINANCE]: [
    [PermissionResource.DASHBOARD, PermissionAction.VIEW],
    [PermissionResource.CUSTOMERS, PermissionAction.VIEW],
    [PermissionResource.QUOTES, PermissionAction.VIEW],
    [PermissionResource.SHIPMENTS, PermissionAction.VIEW],
    [PermissionResource.DOCUMENTS, PermissionAction.VIEW],
    [PermissionResource.REVENUE, PermissionAction.VIEW],
    [PermissionResource.REVENUE, PermissionAction.CREATE],
    [PermissionResource.REVENUE, PermissionAction.EDIT],
    [PermissionResource.REVENUE, PermissionAction.DELETE],
    [PermissionResource.REVENUE, PermissionAction.VIEW_FINANCIALS],
    [PermissionResource.EXPENSES, PermissionAction.VIEW],
    [PermissionResource.EXPENSES, PermissionAction.CREATE],
    [PermissionResource.EXPENSES, PermissionAction.EDIT],
    [PermissionResource.EXPENSES, PermissionAction.DELETE],
    [PermissionResource.EXPENSES, PermissionAction.VIEW_FINANCIALS],
    [PermissionResource.REPORTS, PermissionAction.VIEW],
    [PermissionResource.REPORTS, PermissionAction.VIEW_FINANCIALS],
  ],
};

