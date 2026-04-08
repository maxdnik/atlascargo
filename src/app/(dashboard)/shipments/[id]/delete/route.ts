import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { deleteShipmentById } from "@/lib/shipments";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.companyId) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  }

  const { id } = await params;
  await deleteShipmentById(session.user.companyId, id);

  return NextResponse.redirect(
    new URL("/shipments", process.env.NEXTAUTH_URL || "http://localhost:3000"),
  );
}
