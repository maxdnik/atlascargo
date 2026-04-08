import Link from "next/link";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { listCustomers } from "@/lib/customers";
import { deleteCustomerDirectAction } from "./actions";
import { enforcePagePermission } from "@/lib/permissions";

type CustomersPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const session = await enforcePagePermission(PermissionResource.CUSTOMERS, PermissionAction.VIEW);

  const { q } = await searchParams;
  const customers = await listCustomers(session.companyId, q);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">
            Corporate customers with branch-scoped freight operations.
          </p>
        </div>
        <Link
          href="/customers/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New Customer
        </Link>
      </div>

      <form className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-xs font-medium text-slate-600">Search</label>
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, code, tax ID..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Filter
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Legal Name</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Payment Terms</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={6}>
                  No customers found.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="text-sm text-slate-700">
                  <td className="px-4 py-3 font-medium">{customer.code}</td>
                  <td className="px-4 py-3">{customer.legalName}</td>
                  <td className="px-4 py-3">{customer.city ?? "-"}</td>
                  <td className="px-4 py-3">{customer.paymentTermsDays} days</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        customer.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {customer.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link href={`/customers/${customer.id}`} className="text-slate-700 hover:underline">
                        Edit
                      </Link>
                      <form action={deleteCustomerDirectAction}>
                        <input type="hidden" name="id" value={customer.id} />
                        <button className="text-rose-700 hover:underline" type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
