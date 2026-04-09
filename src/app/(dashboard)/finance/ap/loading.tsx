export default function FinanceApLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="h-[460px] animate-pulse rounded-2xl border border-slate-200/80 bg-white" />
    </div>
  );
}
