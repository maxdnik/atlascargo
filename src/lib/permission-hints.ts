import { PermissionAction, PermissionResource } from "@prisma/client";

export const resourceActionHints: Record<PermissionResource, PermissionAction[]> = {
  [PermissionResource.DASHBOARD]: [PermissionAction.VIEW],
  [PermissionResource.CUSTOMERS]: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
  ],
  [PermissionResource.QUOTES]: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
    PermissionAction.APPROVE,
  ],
  [PermissionResource.SHIPMENTS]: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
  ],
  [PermissionResource.DOCUMENTS]: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
  ],
  [PermissionResource.REVENUE]: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
    PermissionAction.VIEW_FINANCIALS,
  ],
  [PermissionResource.EXPENSES]: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
    PermissionAction.VIEW_FINANCIALS,
  ],
  [PermissionResource.REPORTS]: [
    PermissionAction.VIEW,
    PermissionAction.APPROVE,
    PermissionAction.VIEW_FINANCIALS,
  ],
  [PermissionResource.ADMIN]: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
  ],
};
