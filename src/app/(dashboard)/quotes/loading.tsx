export default function QuotesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-44 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-80 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-10 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="h-12 animate-pulse bg-slate-100" />
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-9 animate-pulse rounded bg-slate-50" />
          ))}
        </div>
      </div>
    </div>
  );
}
