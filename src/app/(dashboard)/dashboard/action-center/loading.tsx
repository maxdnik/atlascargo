export default function ActionCenterLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-[30rem] max-w-full animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="h-24 animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-56 animate-pulse rounded-2xl bg-slate-200" />
        </div>
        <div className="space-y-5 xl:col-span-4">
          <div className="h-52 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-52 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-52 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
