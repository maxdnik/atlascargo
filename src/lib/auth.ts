import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PermissionAction, PermissionResource, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { baseRolePermissionMatrix } from "@/lib/permission-config";

const authSecret =
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV !== "production" ? "local-dev-nextauth-secret" : undefined);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type ExtendedAuthUser = {
  id: string;
  role: UserRole;
  companyId: string;
  companyName?: string;
  branchId?: string | null;
  branchCode?: string | null;
  isPortalUser?: boolean;
  portalCustomerIds?: string[];
};

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  secret: authSecret,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findFirst({
          where: {
            email,
            isActive: true,
          },
          include: {
            company: true,
            branchAccesses: {
              include: {
                branch: true,
              },
              orderBy: {
                createdAt: "asc",
              },
              take: 1,
            },
          },
        });

        if (!user) return null;

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) return null;

        const defaultBranch = user.branchAccesses[0]?.branch;
        const portalAccesses = await prisma.customerPortalAccess.findMany({
          where: {
            userId: user.id,
            companyId: user.companyId,
            isActive: true,
          },
          select: {
            customerId: true,
          },
        });
        const portalCustomerIds = portalAccesses.map((entry) => entry.customerId);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
          companyId: user.companyId,
          companyName: user.company.tradeName ?? user.company.legalName,
          branchId: defaultBranch?.id ?? null,
          branchCode: defaultBranch?.code ?? null,
          isPortalUser: user.isPortalUser,
          portalCustomerIds,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as ExtendedAuthUser;
        token.id = authUser.id;
        token.role = authUser.role;
        token.companyId = authUser.companyId;
        token.companyName = authUser.companyName;
        token.branchId = authUser.branchId;
        token.branchCode = authUser.branchCode;
        token.isPortalUser = authUser.isPortalUser ?? false;
        token.portalCustomerIds = authUser.portalCustomerIds ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? token.sub ?? "";
        session.user.role = (token.role as UserRole | undefined) ?? UserRole.OPERATIONS;
        session.user.companyId = (token.companyId as string | undefined) ?? "";
        session.user.companyName = (token.companyName as string | undefined) ?? "";
        session.user.branchId = (token.branchId as string | null | undefined) ?? null;
        session.user.branchCode = (token.branchCode as string | null | undefined) ?? null;
        session.user.isPortalUser = Boolean(token.isPortalUser);
        session.user.portalCustomerIds = Array.isArray(token.portalCustomerIds)
          ? token.portalCustomerIds
          : [];
      }
      return session;
    },
  },
};

export function hasPermission(
  role: UserRole,
  resource: PermissionResource,
  action: PermissionAction,
) {
  const permissions = baseRolePermissionMatrix[role] ?? [];
  return permissions.some(([r, a]) => r === resource && a === action);
}

export function canViewModule(role: UserRole, resource: PermissionResource) {
  return hasPermission(role, resource, PermissionAction.VIEW);
}

export function getRolePermissionMatrix() {
  return baseRolePermissionMatrix;
}

