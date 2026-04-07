import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCustomerById } from "@/lib/customers";
import { CustomerForm } from "@/components/customers/customer-form";
import { updateCustomerAction } from "@/app/(dashboard)/customers/actions";

type CustomerEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerEditPage({ params }: CustomerEditPageProps) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session?.user?.companyId) {
    notFound();
  }

  const customer = await getCustomerById(session.user.companyId, id);
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
