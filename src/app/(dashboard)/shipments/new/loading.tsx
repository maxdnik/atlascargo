export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-44 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-4 w-80 animate-pulse rounded bg-slate-200" />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
              <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
