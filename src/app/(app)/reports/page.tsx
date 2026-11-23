import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { loadMisTickets } from "@/lib/mis-data";
import { AGE_BUCKETS, computeMis, dayString, hoursLabel, parseDay, type GroupTatRow } from "@/lib/mis";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/types";

const PRESETS = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; preset?: string }> }) {
  await requireRole("agent", "admin");
  const sp = await searchParams;

  const todayStr = dayString(new Date());
  const today = parseDay(todayStr, new Date());
  const tomorrow = new Date(today.getTime() + 86_400_000);
  let from = new Date(today.getTime() - 29 * 86_400_000);
  let to = tomorrow;
  if (sp.preset && sp.preset !== "custom") {
    if (sp.preset === "month") from = parseDay(`${todayStr.slice(0, 7)}-01`, from);
    else if (sp.preset === "year") from = parseDay(`${todayStr.slice(0, 4)}-01-01`, from);
    else from = new Date(today.getTime() - (Number(sp.preset) - 1) * 86_400_000);
  } else if (sp.from || sp.to) {
    from = parseDay(sp.from, from);
    to = new Date(parseDay(sp.to, today).getTime() + 86_400_000);
  }
  const preset = sp.preset ?? (sp.from || sp.to ? "custom" : "30");
  const fromStr = dayString(from);
  const toStr = dayString(new Date(to.getTime() - 86_400_000));

  const tickets = await loadMisTickets();
  const mis = computeMis(tickets, from, to);
  const exportQs = `from=${fromStr}&to=${toStr}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">MIS reports</h1>
          <p className="muted">Pending and ageing are as of now. Raised, resolved and turnaround cover {fromStr} to {toStr}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href={`/reports/export?scope=pending`}>⬇ Pending tickets (Excel)</a>
          <a className="btn-primary" href={`/reports/export?scope=period&${exportQs}`}>⬇ Tickets in period (Excel)</a>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-2 p-3" action="/reports">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <Link key={p.key} href={`/reports?preset=${p.key}`} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${preset === p.key ? "bg-slate-900 text-white" : "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              {p.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="from">From</label>
            <input className="input" type="date" id="from" name="from" defaultValue={fromStr} />
          </div>
          <div>
            <label className="label" htmlFor="to">To</label>
            <input className="input" type="date" id="to" name="to" defaultValue={toStr} />
          </div>
          <button className="btn" type="submit">Apply</button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Pending now" value={mis.kpi.pendingNow} href="/tickets?view=all&status=active" />
        <Kpi label="Unassigned" value={mis.kpi.unassignedNow} tone={mis.kpi.unassignedNow ? "warn" : undefined} href="/tickets?view=unassigned&status=active" />
        <Kpi label="High priority pending" value={mis.kpi.highPendingNow} tone={mis.kpi.highPendingNow ? "bad" : undefined} href="/tickets?view=all&status=active&priority=high" />
        <Kpi label="Pending > 7 days" value={mis.kpi.over7DaysNow} tone={mis.kpi.over7DaysNow ? "bad" : undefined} />
        <Kpi label="Raised in period" value={mis.kpi.raised} />
        <Kpi label="Resolved in period" value={mis.kpi.resolved} tone="good" />
        <Kpi label="Avg resolution" value={hoursLabel(mis.kpi.avgResolutionHours)} />
        <Kpi label="Avg first response" value={hoursLabel(mis.kpi.avgResponseHours)} />
      </div>

      <Section title="Department-wise pending & ageing" note="Department of the person who raised the ticket, at the time it was raised.">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60">
            <tr>
              <th className="th">Department</th>
              <th className="th text-right">Open</th>
              <th className="th text-right">In progress</th>
              <th className="th text-right">Pending</th>
              <th className="th text-right">Total pending</th>
              {AGE_BUCKETS.map((b) => <th key={b.key} className="th text-right">{b.label}</th>)}
              <th className="th text-right">Oldest</th>
              <th className="th text-right">Raised</th>
              <th className="th text-right">Resolved</th>
              <th className="th text-right">Avg resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mis.byDepartment.length === 0 && <EmptyRow cols={14} />}
            {mis.byDepartment.map((d) => (
              <tr key={d.department}>
                <td className="td font-medium">{d.department}</td>
                <Num v={d.open} />
                <Num v={d.in_progress} />
                <Num v={d.pending} />
                <Num v={d.totalPending} bold />
                {AGE_BUCKETS.map((b) => <Num key={b.key} v={d.buckets[b.key]} tone={b.key === "15+" ? "bad" : b.key === "8-15" ? "warn" : undefined} />)}
                <td className="td text-right">{hoursLabel(d.oldestHours)}</td>
                <Num v={d.raised} />
                <Num v={d.resolved} />
                <td className="td text-right">{hoursLabel(d.avgResolutionHours)}</td>
              </tr>
            ))}
            {mis.byDepartment.length > 1 && (
              <tr className="bg-slate-50 font-semibold">
                <td className="td">Total</td>
                <Num v={sum(mis.byDepartment, (d) => d.open)} />
                <Num v={sum(mis.byDepartment, (d) => d.in_progress)} />
                <Num v={sum(mis.byDepartment, (d) => d.pending)} />
                <Num v={mis.kpi.pendingNow} bold />
                {AGE_BUCKETS.map((b) => <Num key={b.key} v={sum(mis.byDepartment, (d) => d.buckets[b.key])} />)}
                <td className="td" />
                <Num v={mis.kpi.raised} />
                <Num v={mis.kpi.resolved} />
                <td className="td text-right">{hoursLabel(mis.kpi.avgResolutionHours)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Pending ageing by priority">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60">
            <tr>
              <th className="th">Priority</th>
              {AGE_BUCKETS.map((b) => <th key={b.key} className="th text-right">{b.label}</th>)}
              <th className="th text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {PRIORITIES.map((p) => (
              <tr key={p}>
                <td className="td font-medium">{PRIORITY_LABEL[p]}</td>
                {AGE_BUCKETS.map((b) => <Num key={b.key} v={mis.ageingByPriority[p][b.key]} tone={b.key === "15+" ? "bad" : b.key === "8-15" ? "warn" : undefined} />)}
                <Num v={AGE_BUCKETS.reduce((s, b) => s + mis.ageingByPriority[p][b.key], 0)} bold />
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Closure time by category"><TatTable rows={mis.byCategory} first="Category" /></Section>
        <Section title="Workload & closure time by IT person"><TatTable rows={mis.byAssignee} first="Assigned to" /></Section>
      </div>
    </div>
  );
}

const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

function Kpi({ label, value, tone, href }: { label: string; value: number | string; tone?: "good" | "warn" | "bad"; href?: string }) {
  const color = tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : "text-slate-900";
  const body = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </>
  );
  return href ? (
    <Link href={href} className="card block p-3 hover:ring-2 hover:ring-indigo-200">{body}</Link>
  ) : (
    <div className="card p-3">{body}</div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {note && <p className="text-xs text-slate-500">{note}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function Num({ v, bold, tone }: { v: number; bold?: boolean; tone?: "warn" | "bad" }) {
  const color = v === 0 ? "text-slate-300" : tone === "bad" ? "text-rose-600 font-semibold" : tone === "warn" ? "text-amber-700" : "";
  return <td className={`td text-right tabular-nums ${bold ? "font-semibold" : ""} ${color}`}>{v}</td>;
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="td py-8 text-center text-slate-500">No tickets yet.</td>
    </tr>
  );
}

function TatTable({ rows, first }: { rows: GroupTatRow[]; first: string }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-slate-200 bg-slate-50/60">
        <tr>
          <th className="th">{first}</th>
          <th className="th text-right">Pending now</th>
          <th className="th text-right">Raised</th>
          <th className="th text-right">Resolved</th>
          <th className="th text-right">Avg</th>
          <th className="th text-right">Median</th>
          <th className="th text-right">≤ 48h</th>
          <th className="th text-right">1st response</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.length === 0 && <EmptyRow cols={8} />}
        {rows.map((r) => (
          <tr key={r.name}>
            <td className="td font-medium">{r.name}</td>
            <Num v={r.pendingNow} bold />
            <Num v={r.raised} />
            <Num v={r.resolved} />
            <td className="td text-right">{hoursLabel(r.avgResolutionHours)}</td>
            <td className="td text-right">{hoursLabel(r.medianResolutionHours)}</td>
            <td className="td text-right">{r.within48hPct == null ? "—" : `${Math.round(r.within48hPct)}%`}</td>
            <td className="td text-right">{hoursLabel(r.avgResponseHours)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
