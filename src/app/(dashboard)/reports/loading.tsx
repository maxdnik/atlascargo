export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-9 w-64 rounded bg-slate-200" />
        <div className="h-4 w-96 rounded bg-slate-200" />
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-4 h-28 w-full rounded-xl bg-slate-100" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-4 h-20 w-full rounded-xl bg-slate-100" />
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-4 h-20 w-full rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
