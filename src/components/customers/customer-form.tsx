"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CustomerActionState } from "@/app/(dashboard)/customers/actions";

type CustomerDefaults = {
  id?: string;
  code?: string;
  legalName?: string;
  tradeName?: string;
  taxId?: string;
  country?: string;
  city?: string;
  address?: string;
  paymentTermsDays?: number;
  isActive?: boolean;
};

type CustomerFormProps = {
  action: (
    prevState: CustomerActionState,
    formData: FormData,
  ) => Promise<CustomerActionState>;
  defaults?: CustomerDefaults;
  submitLabel: string;
};

const initialState: CustomerActionState = { success: false };

export function CustomerForm({ action, defaults, submitLabel }: CustomerFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.push("/customers");
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Code *</label>
          <input
            name="code"
            required
            defaultValue={defaults?.code ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Legal name *</label>
          <input
            name="legalName"
            required
            defaultValue={defaults?.legalName ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Trade name</label>
          <input
            name="tradeName"
            defaultValue={defaults?.tradeName ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tax ID</label>
          <input
            name="taxId"
            defaultValue={defaults?.taxId ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Country</label>
          <input
            name="country"
            defaultValue={defaults?.country ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">City</label>
          <input
            name="city"
            defaultValue={defaults?.city ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Payment terms (days) *
          </label>
          <input
            type="number"
            min={0}
            name="paymentTermsDays"
            required
            defaultValue={defaults?.paymentTermsDays ?? 30}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={defaults?.isActive ?? true}
              className="h-4 w-4 rounded border-slate-300"
            />
            Active customer
          </label>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
        <input
          name="address"
          defaultValue={defaults?.address ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-600">Saved successfully.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
