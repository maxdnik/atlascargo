import Link from "next/link";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { Building2, Search } from "lucide-react";
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
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">
            Corporate customers with branch-scoped freight operations.
          </p>
        </div>
        <Link
          href="/customers/new"
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500"
        >
          New Customer
        </Link>
      </div>

      <form className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Search
        </label>
        <div className="flex gap-2">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Name, code, tax ID..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Filter
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/80">
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
                <td className="px-4 py-12 text-center text-sm text-slate-500" colSpan={6}>
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <Building2 className="h-5 w-5 text-slate-400" />
                    <p className="font-medium text-slate-700">No customers found</p>
                    <p className="text-xs text-slate-500">
                      Add your first customer record to begin quoting and operations.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="cursor-pointer text-sm text-slate-700 transition hover:bg-slate-50/70"
                >
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
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        Edit
                      </Link>
                      <form action={deleteCustomerDirectAction}>
                        <input type="hidden" name="id" value={customer.id} />
                        <button
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                          type="submit"
                        >
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
