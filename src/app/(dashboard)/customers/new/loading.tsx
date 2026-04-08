export default function NewCustomerLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-lg bg-slate-200" />
        <div className="h-4 w-80 rounded bg-slate-200" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="h-10 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 w-20 rounded bg-slate-200" />
          <div className="h-10 rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
