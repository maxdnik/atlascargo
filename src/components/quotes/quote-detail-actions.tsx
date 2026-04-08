"use client";

import { useActionState } from "react";
import { Send, CheckCircle, XCircle, Clock, ArrowRightLeft } from "lucide-react";

import type { QuoteActionState } from "@/app/(dashboard)/quotes/actions";

const init: QuoteActionState = { success: false };

function ActionBtn({
  action, quoteId, label, icon: Icon, className, confirmMsg,
}: {
  action: (prev: QuoteActionState, fd: FormData) => Promise<QuoteActionState>;
  quoteId: string; label: string; icon: React.ElementType; className: string; confirmMsg?: string;
}) {
  const [state, formAction, pending] = useActionState(action, init);
  function handleSubmit(formData: FormData) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    formAction(formData);
  }
  return (
    <form action={handleSubmit}>
      <input type="hidden" name="id" value={quoteId} />
      {state.error && <p className="text-xs text-red-600 mb-1">{state.error}</p>}
      <button type="submit" disabled={pending}
        className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${className}`}>
        <Icon className="h-4 w-4" />
        {pending ? "…" : label}
      </button>
    </form>
  );
}

type Props = {
  quoteId: string;
  status: string;
  hasPricing: boolean;
  hasShipment: boolean;
  sendAction: (prev: QuoteActionState, fd: FormData) => Promise<QuoteActionState>;
  approveAction: (prev: QuoteActionState, fd: FormData) => Promise<QuoteActionState>;
  rejectAction: (prev: QuoteActionState, fd: FormData) => Promise<QuoteActionState>;
  expireAction: (prev: QuoteActionState, fd: FormData) => Promise<QuoteActionState>;
  convertAction: (prev: QuoteActionState, fd: FormData) => Promise<QuoteActionState>;
};

export function QuoteDetailActions({
  quoteId, status, hasPricing, hasShipment,
  sendAction, approveAction, rejectAction, expireAction, convertAction,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <>
          <ActionBtn action={sendAction} quoteId={quoteId} label="Send Quote" icon={Send}
            className="bg-blue-600 text-white hover:bg-blue-700" />
          <ActionBtn action={expireAction} quoteId={quoteId} label="Expire" icon={Clock}
            className="bg-amber-100 text-amber-700 hover:bg-amber-200"
            confirmMsg="Mark this quote as expired?" />
        </>
      )}

      {status === "SENT" && (
        <>
          {hasPricing ? (
            <ActionBtn action={approveAction} quoteId={quoteId} label="Approve" icon={CheckCircle}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              confirmMsg="Approve this quote? This will lock it for editing." />
          ) : (
            <p className="flex items-center text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">
              Cannot approve — no sell pricing defined
            </p>
          )}
          <ActionBtn action={rejectAction} quoteId={quoteId} label="Reject" icon={XCircle}
            className="bg-red-100 text-red-700 hover:bg-red-200"
            confirmMsg="Reject this quote?" />
          <ActionBtn action={expireAction} quoteId={quoteId} label="Expire" icon={Clock}
            className="bg-amber-100 text-amber-700 hover:bg-amber-200"
            confirmMsg="Mark this quote as expired?" />
        </>
      )}

      {status === "APPROVED" && !hasShipment && (
        <ActionBtn action={convertAction} quoteId={quoteId} label="Convert to Shipment" icon={ArrowRightLeft}
          className="bg-indigo-600 text-white hover:bg-indigo-700"
          confirmMsg="Convert this approved quote to a new shipment? You will be redirected to the new shipment." />
      )}

      {status === "APPROVED" && hasShipment && (
        <p className="flex items-center text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2">
          Already converted to shipment
        </p>
      )}
    </div>
  );
}
