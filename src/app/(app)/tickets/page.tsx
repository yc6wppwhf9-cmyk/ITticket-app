import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isStaff, PRIORITIES, PRIORITY_LABEL, type Category, type Department, type Profile } from "@/lib/types";
import { cleanSearch, STATUS_GROUPS, TICKET_SELECT, type StatusGroup, type TicketRow } from "@/lib/tickets";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { Person } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { ageDays, fmtDateTime, fmtDuration, personName, requestTime } from "@/lib/format";

const PAGE_SIZE = 50;

type View = "mine" | "assigned" | "unassigned" | "all";
type SP = {
  view?: string; status?: string; q?: string; category?: string; priority?: string;
  dept?: string; assignee?: string; page?: string;
};

export default async function TicketsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const staff = isStaff(me.role);
  const supabase = await createClient();

  const views: { key: View; label: string }[] = staff
    ? [
        { key: "assigned", label: "Assigned to me" },
        { key: "unassigned", label: "Unassigned" },
        { key: "all", label: "All tickets" },
        { key: "mine", label: "Raised by me" },
      ]
    : [{ key: "mine", label: "My tickets" }];
  const defaultView: View = !staff ? "mine" : me.role === "admin" ? "all" : "assigned";
  const view = (views.find((v) => v.key === sp.view)?.key ?? defaultView) as View;
  const group = (STATUS_GROUPS.find((g) => g.key === sp.status)?.key ?? "active") as StatusGroup;
  const q = cleanSearch(sp.q ?? "");
  const page = Math.max(1, Number(sp.page) || 1);

  // Every filter except the status group, so the group tabs can show counts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (query: any) => {
    if (view === "mine") query = query.eq("requester_id", me.id);
    if (view === "assigned") query = query.eq("assignee_id", me.id);
    if (view === "unassigned") query = query.is("assignee_id", null);
    if (q) query = query.or(`ticket_no.ilike.*${q}*,title.ilike.*${q}*`);
    if (sp.category) query = query.eq("category_id", sp.category);
    if (sp.priority && (PRIORITIES as string[]).includes(sp.priority)) query = query.eq("priority", sp.priority);
    if (staff && sp.dept) query = query.eq("department_id", sp.dept);
    if (staff && sp.assignee) query = query.eq("assignee_id", sp.assignee);
    return query;
  };

  const groupStatuses = STATUS_GROUPS.find((g) => g.key === group)!.statuses;
  let listQuery = applyFilters(supabase.from("tickets").select(TICKET_SELECT, { count: "exact" }));
  if (groupStatuses) listQuery = listQuery.in("status", groupStatuses);
  listQuery = listQuery
    .order(group === "active" ? "created_at" : "last_activity_at", { ascending: group === "active" })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [list, counts, cats, depts, staffList] = await Promise.all([
    listQuery,
    Promise.all(
      STATUS_GROUPS.map(async (g) => {
        let cq = applyFilters(supabase.from("tickets").select("id", { count: "exact", head: true }));
        if (g.statuses) cq = cq.in("status", g.statuses);
        const { count } = await cq;
        return [g.key, count ?? 0] as const;
      })
    ),
    supabase.from("categories").select("id, name").order("sort_order"),
    staff ? supabase.from("departments").select("id, name").order("name") : Promise.resolve({ data: [] }),
    staff
      ? supabase.from("profiles").select("id, full_name, email").in("role", ["agent", "admin"]).eq("active", true).order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  const rows = (list.data ?? []) as unknown as TicketRow[];
  const total = list.count ?? 0;
  const countBy = Object.fromEntries(counts) as Record<StatusGroup, number>;
  const categories = (cats.data ?? []) as Pick<Category, "id" | "name">[];
  const departments = (depts.data ?? []) as Pick<Department, "id" | "name">[];
  const agents = (staffList.data ?? []) as Pick<Profile, "id" | "full_name" | "email">[];
  const now = requestTime();

  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { view, status: group, q: sp.q, category: sp.category, priority: sp.priority, dept: sp.dept, assignee: sp.assignee, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `/tickets?${p.toString()}`;
  };

  const filtersOn = Boolean(sp.q || sp.category || sp.priority || sp.dept || sp.assignee);

  return (
    <div>
      <PageHeader
        eyebrow={staff ? "IT workspace" : "My requests"}
        title="Tickets"
        subtitle={staff ? "Every IT & Ginesys request, in one place." : "Everything you've raised with IT, and where it stands."}
        actions={
          views.length > 1 && (
            <div className="seg">
              {views.map((v) => (
                <Link key={v.key} href={href({ view: v.key, page: undefined })} className={`seg-item ${v.key === view ? "seg-item-active" : ""}`}>
                  {v.label}
                </Link>
              ))}
            </div>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_GROUPS.map((g) => {
          const on = g.key === group;
          const tone =
            g.key === "active" ? "from-indigo-500 to-violet-500" : g.key === "resolved" ? "from-emerald-500 to-teal-500" : g.key === "closed" ? "from-slate-400 to-slate-500" : "from-sky-500 to-cyan-500";
          return (
            <Link
              key={g.key}
              href={href({ status: g.key, page: undefined })}
              className={`card card-hover relative overflow-hidden p-4 ${on ? "ring-2 ring-indigo-500/60" : ""}`}
            >
              <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone} ${on ? "opacity-100" : "opacity-40"}`} />
              <div className="text-xs font-semibold text-slate-500">{g.label}</div>
              <div className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{countBy[g.key]}</div>
            </Link>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <form className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4" action="/tickets">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="status" value={group} />
          <div className="min-w-[14rem] flex-1">
            <label className="label" htmlFor="q">Search</label>
            <input className="input" id="q" name="q" placeholder="Ticket no. or subject" defaultValue={sp.q ?? ""} />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[11rem]">
            <label className="label" htmlFor="category">Category</label>
            <select className="input" id="category" name="category" defaultValue={sp.category ?? ""}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[8rem]">
            <label className="label" htmlFor="priority">Priority</label>
            <select className="input" id="priority" name="priority" defaultValue={sp.priority ?? ""}>
              <option value="">Any</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </div>
          {staff && (
            <>
              <div className="w-full sm:w-auto sm:min-w-[10rem]">
                <label className="label" htmlFor="dept">Department</label>
                <select className="input" id="dept" name="dept" defaultValue={sp.dept ?? ""}>
                  <option value="">All</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {view === "all" && (
                <div className="w-full sm:w-auto sm:min-w-[10rem]">
                  <label className="label" htmlFor="assignee">Assignee</label>
                  <select className="input" id="assignee" name="assignee" defaultValue={sp.assignee ?? ""}>
                    <option value="">Anyone</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{personName(a)}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2">
            <button className="btn" type="submit">Apply</button>
            {filtersOn && <Link className="btn-ghost" href={`/tickets?view=${view}&status=${group}`}>Clear</Link>}
          </div>
        </form>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-500 ring-1 ring-indigo-100">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-semibold text-slate-800">{group === "active" && !filtersOn ? "All clear" : "No tickets here"}</p>
            <p className="muted mt-1 max-w-sm">
              {group === "active" && !filtersOn ? "Nothing is waiting in this view." : "Try another tab or clear the filters."}
            </p>
            {!staff && <Link href="/tickets/new" className="btn-primary mt-5">Raise a ticket</Link>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="th">Ticket</th>
                  <th className="th">Status</th>
                  <th className="th">Priority</th>
                  <th className="th">Category</th>
                  {staff && <th className="th">Raised by</th>}
                  <th className="th">Assigned to</th>
                  <th className="th">Raised on</th>
                  <th className="th text-right">{group === "active" ? "Age" : "Turnaround"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => {
                  const age = ageDays(t.created_at, now);
                  const done = t.closed_at ?? t.resolved_at;
                  return (
                    <tr key={t.id} className="group transition hover:bg-indigo-50/40">
                      <td className="td max-w-[28rem]">
                        <Link href={`/tickets/${t.id}`} className="block">
                          <span className="font-mono text-[11px] font-semibold text-indigo-600">{t.ticket_no}</span>
                          <span className="block truncate font-semibold text-slate-900 group-hover:text-indigo-700">{t.title}</span>
                        </Link>
                      </td>
                      <td className="td"><StatusBadge status={t.status} /></td>
                      <td className="td"><PriorityBadge priority={t.priority} /></td>
                      <td className="td whitespace-nowrap text-slate-600">{t.category?.name}</td>
                      {staff && (
                        <td className="td whitespace-nowrap">
                          <Person name={personName(t.requester)} sub={t.department?.name ?? "No department"} />
                        </td>
                      )}
                      <td className="td whitespace-nowrap">
                        {t.assignee ? (
                          <Person name={personName(t.assignee)} />
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="td whitespace-nowrap text-slate-500">{fmtDateTime(t.created_at)}</td>
                      <td className="td whitespace-nowrap text-right tabular-nums">
                        {group === "active" || !done ? (
                          <span className={age > 7 ? "font-semibold text-rose-600" : age > 2 ? "font-medium text-amber-700" : "text-slate-600"}>
                            {fmtDuration(now - new Date(t.created_at).getTime())}
                          </span>
                        ) : (
                          <span className="text-slate-600">{fmtDuration(new Date(done).getTime() - new Date(t.created_at).getTime())}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              {page > 1 && <Link className="btn btn-sm" href={href({ page: String(page - 1) })}>← Previous</Link>}
              {page * PAGE_SIZE < total && <Link className="btn btn-sm" href={href({ page: String(page + 1) })}>Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
