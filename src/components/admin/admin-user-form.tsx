"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";

import { roleDisplayName } from "@/lib/permission-config";
import type { AdminUserActionState } from "@/app/(dashboard)/admin/actions";

type AdminUserDefaults = {
  id?: string;
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
};

type AdminUserFormProps = {
  action: (
    prevState: AdminUserActionState,
    formData: FormData,
  ) => Promise<AdminUserActionState>;
  submitLabel: string;
  defaults?: AdminUserDefaults;
  includePassword?: boolean;
};

const initialState: AdminUserActionState = { success: false };

export function AdminUserForm({
  action,
  submitLabel,
  defaults,
  includePassword = false,
}: AdminUserFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.push("/admin/users");
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
          <input
            name="name"
            required
            defaultValue={defaults?.name ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
          <input
            type="email"
            name="email"
            required
            defaultValue={defaults?.email ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {includePassword ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Password *</label>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">Minimum 8 characters.</p>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Role *</label>
          <select
            name="role"
            defaultValue={defaults?.role ?? UserRole.OPERATIONS}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {Object.values(UserRole).map((role) => (
              <option key={role} value={role}>
                {roleDisplayName[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={defaults?.isActive ?? true}
              className="h-4 w-4 rounded border-slate-300"
            />
            Active user
          </label>
        </div>
      </div>
      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
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
