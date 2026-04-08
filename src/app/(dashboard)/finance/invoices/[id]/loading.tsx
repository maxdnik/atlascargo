export default function FinanceInvoiceDetailLoading() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="h-8 w-72 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200/80 bg-white xl:col-span-2" />
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200/80 bg-white" />
      </div>
    </div>
  );
}
