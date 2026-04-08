import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PermissionAction, PermissionResource, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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
};

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
          companyId: user.companyId,
          companyName: user.company.tradeName ?? user.company.legalName,
          branchId: defaultBranch?.id ?? null,
          branchCode: defaultBranch?.code ?? null,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? token.sub ?? "";
        session.user.role = (token.role as UserRole | undefined) ?? UserRole.BRANCH_USER;
        session.user.companyId = (token.companyId as string | undefined) ?? "";
        session.user.companyName = (token.companyName as string | undefined) ?? "";
        session.user.branchId = (token.branchId as string | null | undefined) ?? null;
        session.user.branchCode = (token.branchCode as string | null | undefined) ?? null;
      }
      return session;
    },
  },
};

const rolePermissions: Record<UserRole, Array<[PermissionResource, PermissionAction]>> = {
  [UserRole.SUPER_ADMIN]: [
    [PermissionResource.DASHBOARD, PermissionAction.READ],
    [PermissionResource.CUSTOMERS, PermissionAction.READ],
    [PermissionResource.CUSTOMERS, PermissionAction.CREATE],
    [PermissionResource.CUSTOMERS, PermissionAction.UPDATE],
    [PermissionResource.CUSTOMERS, PermissionAction.DELETE],
    [PermissionResource.QUOTES, PermissionAction.READ],
    [PermissionResource.QUOTES, PermissionAction.CREATE],
    [PermissionResource.QUOTES, PermissionAction.UPDATE],
    [PermissionResource.QUOTES, PermissionAction.APPROVE],
    [PermissionResource.SHIPMENTS, PermissionAction.READ],
    [PermissionResource.SHIPMENTS, PermissionAction.CREATE],
    [PermissionResource.SHIPMENTS, PermissionAction.UPDATE],
    [PermissionResource.SHIPMENTS, PermissionAction.DELETE],
    [PermissionResource.MILESTONES, PermissionAction.READ],
    [PermissionResource.MILESTONES, PermissionAction.UPDATE],
    [PermissionResource.FINANCE, PermissionAction.VIEW_FINANCE],
    [PermissionResource.FINANCE, PermissionAction.VIEW_MARGIN],
  ],
  [UserRole.DIRECTOR]: [
    [PermissionResource.DASHBOARD, PermissionAction.READ],
    [PermissionResource.CUSTOMERS, PermissionAction.READ],
    [PermissionResource.CUSTOMERS, PermissionAction.UPDATE],
    [PermissionResource.QUOTES, PermissionAction.READ],
    [PermissionResource.SHIPMENTS, PermissionAction.READ],
    [PermissionResource.FINANCE, PermissionAction.VIEW_FINANCE],
    [PermissionResource.FINANCE, PermissionAction.VIEW_MARGIN],
  ],
  [UserRole.SALES]: [
    [PermissionResource.DASHBOARD, PermissionAction.READ],
    [PermissionResource.CUSTOMERS, PermissionAction.READ],
    [PermissionResource.CUSTOMERS, PermissionAction.CREATE],
    [PermissionResource.CUSTOMERS, PermissionAction.UPDATE],
    [PermissionResource.QUOTES, PermissionAction.READ],
    [PermissionResource.QUOTES, PermissionAction.CREATE],
    [PermissionResource.QUOTES, PermissionAction.UPDATE],
  ],
  [UserRole.PRICING]: [
    [PermissionResource.DASHBOARD, PermissionAction.READ],
    [PermissionResource.QUOTES, PermissionAction.READ],
    [PermissionResource.QUOTES, PermissionAction.UPDATE],
    [PermissionResource.QUOTES, PermissionAction.APPROVE],
  ],
  [UserRole.OPERATIONS]: [
    [PermissionResource.DASHBOARD, PermissionAction.READ],
    [PermissionResource.SHIPMENTS, PermissionAction.READ],
    [PermissionResource.SHIPMENTS, PermissionAction.CREATE],
    [PermissionResource.SHIPMENTS, PermissionAction.UPDATE],
    [PermissionResource.MILESTONES, PermissionAction.READ],
    [PermissionResource.MILESTONES, PermissionAction.UPDATE],
  ],
  [UserRole.CUSTOMER_SERVICE]: [
    [PermissionResource.DASHBOARD, PermissionAction.READ],
    [PermissionResource.CUSTOMERS, PermissionAction.READ],
    [PermissionResource.SHIPMENTS, PermissionAction.READ],
    [PermissionResource.MILESTONES, PermissionAction.READ],
  ],
  [UserRole.ADMIN]: [
    [PermissionResource.DASHBOARD, PermissionAction.READ],
    [PermissionResource.CUSTOMERS, PermissionAction.READ],
    [PermissionResource.CUSTOMERS, PermissionAction.UPDATE],
    [PermissionResource.FINANCE, PermissionAction.READ],
  ],
  [UserRole.FINANCE]: [
    [PermissionResource.DASHBOARD, PermissionAction.READ],
    [PermissionResource.FINANCE, PermissionAction.READ],
    [PermissionResource.FINANCE, PermissionAction.CREATE],
    [PermissionResource.FINANCE, PermissionAction.UPDATE],
    [PermissionResource.FINANCE, PermissionAction.VIEW_FINANCE],
    [PermissionResource.FINANCE, PermissionAction.VIEW_MARGIN],
  ],
  [UserRole.BRANCH_USER]: [
    [PermissionResource.DASHBOARD, PermissionAction.READ],
    [PermissionResource.CUSTOMERS, PermissionAction.READ],
    [PermissionResource.SHIPMENTS, PermissionAction.READ],
  ],
  [UserRole.CUSTOMER_PORTAL]: [
    [PermissionResource.SHIPMENTS, PermissionAction.READ],
    [PermissionResource.DOCUMENTS, PermissionAction.READ],
    [PermissionResource.MILESTONES, PermissionAction.READ],
  ],
};

export function hasPermission(
  role: UserRole,
  resource: PermissionResource,
  action: PermissionAction,
) {
  const permissions = rolePermissions[role] ?? [];
  return permissions.some(([r, a]) => r === resource && a === action);
}

