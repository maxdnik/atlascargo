import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { CustomerForm } from "@/components/customers/customer-form";
import { createCustomerAction } from "../actions";

export default async function NewCustomerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New customer</h1>
        <p className="text-sm text-slate-600">
          Register a corporate account to start quoting and operating shipments.
        </p>
      </div>
      <CustomerForm action={createCustomerAction} submitLabel="Create customer" />
    </div>
  );
}
