export default function FinanceLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="h-8 w-72 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-slate-200/80 bg-white"
          />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200/80 bg-white" />
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200/80 bg-white" />
      </div>
    </div>
  );
}
