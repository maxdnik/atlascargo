import { redirect } from "next/navigation";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { enforcePagePermission } from "@/lib/permissions";
type LegacyInvoiceDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LegacyInvoiceDetailPage({ params }: LegacyInvoiceDetailPageProps) {
  await enforcePagePermission(PermissionResource.REVENUE, PermissionAction.VIEW);
  const { id } = await params;
  redirect(`/finance/invoices/${id}`);
}
