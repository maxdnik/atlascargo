import { PermissionAction, PermissionResource, type UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { baseRolePermissionMatrix } from "@/lib/permission-config";
import { prisma } from "@/lib/prisma";

type SessionUser = {
  id: string;
  role: UserRole;
  companyId: string;
};

function roleHasPermission(
  role: UserRole,
  resource: PermissionResource,
  action: PermissionAction,
) {
  const matrix = baseRolePermissionMatrix[role] ?? [];
  return matrix.some(([r, a]) => r === resource && a === action);
}

function mapActionForLegacy(action: PermissionAction): PermissionAction {
  return action;
}

async function findPermissionId(resource: PermissionResource, action: PermissionAction) {
  const mapped = mapActionForLegacy(action);
  try {
    const record = await prisma.permission.findUnique({
      where: {
        resource_action: {
          resource,
          action: mapped,
        },
      },
      select: { id: true },
    });
    return record?.id ?? null;
  } catch {
    return null;
  }
}

async function hasDbPermission(
  user: SessionUser,
  resource: PermissionResource,
  action: PermissionAction,
) {
  const permissionId = await findPermissionId(resource, action);
  if (!permissionId) {
    return roleHasPermission(user.role, resource, action);
  }

  const override = await prisma.userPermissionOverride.findUnique({
    where: {
      userId_permissionId: {
        userId: user.id,
        permissionId,
      },
    },
    select: { allowed: true },
  });

  if (override) {
    return override.allowed;
  }

  const role = await prisma.role.findUnique({
    where: {
      companyId_code: {
        companyId: user.companyId,
        code: user.role,
      },
    },
    select: {
      id: true,
      permissions: {
        where: { permissionId },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!role) {
    return roleHasPermission(user.role, resource, action);
  }

  return role.permissions.length > 0;
}

export async function canUser(
  user: SessionUser,
  resource: PermissionResource,
  action: PermissionAction,
) {
  return hasDbPermission(user, resource, action);
}

export async function getRequiredSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.companyId) {
    redirect("/login");
  }

  return {
    userId: session.user.id,
    role: session.user.role,
    companyId: session.user.companyId,
    branchId: session.user.branchId,
  };
}

export async function enforcePagePermission(
  resource: PermissionResource,
  action: PermissionAction = PermissionAction.VIEW,
) {
  const user = await getRequiredSession();
  const allowed = await canUser(
    {
      id: user.userId,
      role: user.role,
      companyId: user.companyId,
    },
    resource,
    action,
  );

  if (!allowed) {
    redirect("/dashboard");
  }

  return user;
}

export async function enforceActionPermission(
  resource: PermissionResource,
  action: PermissionAction,
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.companyId) {
    throw new Error("Unauthorized");
  }

  const allowed = await canUser(
    {
      id: session.user.id,
      role: session.user.role,
      companyId: session.user.companyId,
    },
    resource,
    action,
  );

  if (!allowed) {
    throw new Error("Insufficient permissions");
  }

  return {
    userId: session.user.id,
    companyId: session.user.companyId,
    branchId: session.user.branchId,
    role: session.user.role,
  };
}

export async function getVisibleModulesForCurrentUser(
  user?: {
    id: string;
    role: UserRole;
    companyId: string;
  },
) {
  const resolvedUser = user
    ? user
    : await (async () => {
        const current = await getServerSession(authOptions);
        if (!current?.user?.id || !current.user.companyId) {
          return null;
        }
        return {
          id: current.user.id,
          role: current.user.role,
          companyId: current.user.companyId,
        };
      })();

  if (!resolvedUser) {
    return new Set<PermissionResource>();
  }

  const moduleChecks = await Promise.all(
    Object.values(PermissionResource).map(async (resource) => {
      const allowed = await canUser(
        {
          id: resolvedUser.id,
          role: resolvedUser.role,
          companyId: resolvedUser.companyId,
        },
        resource,
        PermissionAction.VIEW,
      );
      return { resource, allowed };
    }),
  );

  return new Set(moduleChecks.filter((entry) => entry.allowed).map((entry) => entry.resource));
}
