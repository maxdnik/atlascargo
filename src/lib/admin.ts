import { PermissionAction, PermissionResource, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function listCompanyUsers(companyId: string) {
  return prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          branchAccesses: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getCompanyUserById(companyId: string, userId: string) {
  return prisma.user.findFirst({
    where: {
      id: userId,
      companyId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getCompanyRolesWithPermissions(companyId: string) {
  return prisma.role.findMany({
    where: { companyId },
    orderBy: { code: "asc" },
    include: {
      permissions: {
        include: {
          permission: {
            select: {
              resource: true,
              action: true,
            },
          },
        },
      },
    },
  });
}

export async function getPermittedModulesForRole(
  companyId: string,
  role: UserRole,
): Promise<Set<PermissionResource>> {
  const roleRecord = await prisma.role.findUnique({
    where: {
      companyId_code: {
        companyId,
        code: role,
      },
    },
    select: {
      permissions: {
        include: {
          permission: {
            select: {
              resource: true,
              action: true,
            },
          },
        },
      },
    },
  });

  if (!roleRecord) {
    return new Set();
  }

  const visible = roleRecord.permissions
    .filter((entry) => entry.permission.action === PermissionAction.VIEW)
    .map((entry) => entry.permission.resource);

  return new Set(visible);
}

export async function findRoleByCode(companyId: string, code: UserRole) {
  return prisma.role.findUnique({
    where: {
      companyId_code: {
        companyId,
        code,
      },
    },
    select: { id: true, code: true },
  });
}

export type RolePermissionSet = Set<string>;

export function toPermissionSet(
  permissions: Array<{ permission: { resource: PermissionResource; action: PermissionAction } }>,
): RolePermissionSet {
  return new Set(permissions.map((entry) => `${entry.permission.resource}:${entry.permission.action}`));
}

