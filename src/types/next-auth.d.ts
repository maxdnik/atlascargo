import { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      companyId: string;
      branchId?: string | null;
      branchCode?: string | null;
      companyName?: string;
      role: UserRole;
      name?: string | null;
      email?: string | null;
    };
  }

  interface User {
    id: string;
    companyId: string;
    branchId?: string | null;
    branchCode?: string | null;
    companyName?: string;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    companyId: string;
    branchId?: string | null;
    branchCode?: string | null;
    companyName?: string;
    role: UserRole;
  }
}
