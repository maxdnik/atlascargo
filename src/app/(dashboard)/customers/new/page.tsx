import { CustomerForm } from "@/components/customers/customer-form";
import { createCustomerAction } from "../actions";
import { enforcePagePermission } from "@/lib/permissions";
import { PermissionAction, PermissionResource } from "@prisma/client";

export default async function NewCustomerPage() {
  await enforcePagePermission(PermissionResource.CUSTOMERS, PermissionAction.CREATE);

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
