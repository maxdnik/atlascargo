import { notFound } from "next/navigation";
import { PermissionAction, PermissionResource } from "@prisma/client";

import { getCustomerById } from "@/lib/customers";
import { CustomerForm } from "@/components/customers/customer-form";
import { updateCustomerAction } from "@/app/(dashboard)/customers/actions";
import { enforcePagePermission } from "@/lib/permissions";

type CustomerEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerEditPage({ params }: CustomerEditPageProps) {
  const session = await enforcePagePermission(PermissionResource.CUSTOMERS, PermissionAction.EDIT);
  const { id } = await params;

  const customer = await getCustomerById(session.companyId, id);
  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Edit Customer</h1>
        <p className="text-sm text-slate-500">Update company data and financial terms.</p>
      </div>
      <CustomerForm
        action={updateCustomerAction}
        submitLabel="Update customer"
        defaults={{
          id: customer.id,
          code: customer.code,
          legalName: customer.legalName,
          tradeName: customer.tradeName ?? "",
          taxId: customer.taxId ?? "",
          country: customer.country ?? "",
          city: customer.city ?? "",
          address: customer.address ?? "",
          paymentTermsDays: customer.paymentTermsDays,
          isActive: customer.isActive,
        }}
      />
    </div>
  );
}
