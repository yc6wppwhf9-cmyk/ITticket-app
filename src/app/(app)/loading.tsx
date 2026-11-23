/**
 * Shown the instant a link is clicked, while the next page's data loads.
 * Next.js prefetches this for every visible menu link, so navigation always
 * responds immediately even when the database is a few hundred ms away.
 */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-6 space-y-2">
        <div className="h-3 w-24 rounded-full bg-indigo-100" />
        <div className="h-7 w-56 rounded-lg bg-slate-200" />
        <div className="h-4 w-80 max-w-full rounded-full bg-slate-100" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-[92px] p-4">
            <div className="h-3 w-16 rounded-full bg-slate-100" />
            <div className="mt-3 h-7 w-12 rounded-lg bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <div className="h-10 rounded-xl bg-slate-100" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-50 px-4 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded-full bg-indigo-100" />
              <div className="h-4 w-3/5 rounded-full bg-slate-200" />
            </div>
            <div className="hidden h-6 w-20 rounded-full bg-slate-100 sm:block" />
            <div className="hidden h-7 w-7 rounded-full bg-slate-200 md:block" />
            <div className="hidden h-4 w-24 rounded-full bg-slate-100 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
