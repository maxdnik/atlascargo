"use client";

import { useActionState } from "react";

import type { AdminUserActionState } from "@/app/(dashboard)/admin/actions";

const initialState: AdminUserActionState = { success: false };

type PasswordResetFormProps = {
  userId: string;
  action: (
    prevState: AdminUserActionState,
    formData: FormData,
  ) => Promise<AdminUserActionState>;
};

export function PasswordResetForm({ userId, action }: PasswordResetFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <input type="hidden" name="id" value={userId} />
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Reset Password</h3>
        <p className="text-xs text-slate-500">Set a temporary password and share it securely.</p>
      </div>
      <input
        name="newPassword"
        type="password"
        required
        minLength={8}
        placeholder="New temporary password"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-600">Password updated.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}
