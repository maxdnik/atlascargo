export default function InvoicesListLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-80 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="h-[420px] animate-pulse rounded-2xl border border-slate-200/80 bg-white" />
    </div>
  );
}
