export default function CustomersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
