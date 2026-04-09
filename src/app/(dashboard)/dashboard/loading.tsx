export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-36 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
        </div>
        <div>
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}
