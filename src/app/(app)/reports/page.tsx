import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { loadMisTickets } from "@/lib/mis-data";
import { AGE_BUCKETS, computeMis, dayString, hoursLabel, parseDay, type GroupTatRow } from "@/lib/mis";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/types";
import { PageHeader } from "@/components/page-header";

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
      <PageHeader
        eyebrow="Insights"
        title="MIS reports"
        subtitle={<>Pending and ageing are as of now. Raised, resolved and turnaround cover <b className="text-slate-700">{fromStr}</b> to <b className="text-slate-700">{toStr}</b>.</>}
        actions={
          <>
            <a className="btn" href={`/reports/export?scope=pending`}>⬇ Pending tickets</a>
            <a className="btn-primary" href={`/reports/export?scope=period&${exportQs}`}>⬇ Export period to Excel</a>
          </>
        }
      />

      <form className="card flex flex-wrap items-end gap-3 p-3" action="/reports">
        <div className="seg self-center">
          {PRESETS.map((p) => (
            <Link key={p.key} href={`/reports?preset=${p.key}`} className={`seg-item ${preset === p.key ? "seg-item-active" : ""}`}>
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
        <Kpi label="Pending now" value={mis.kpi.pendingNow} icon={ICON.inbox} accent="from-indigo-500 to-violet-500" href="/tickets?view=all&status=active" />
        <Kpi label="Unassigned" value={mis.kpi.unassignedNow} icon={ICON.user} accent="from-amber-400 to-orange-500" tone={mis.kpi.unassignedNow ? "warn" : undefined} href="/tickets?view=unassigned&status=active" />
        <Kpi label="High priority" value={mis.kpi.highPendingNow} icon={ICON.flame} accent="from-rose-500 to-pink-500" tone={mis.kpi.highPendingNow ? "bad" : undefined} href="/tickets?view=all&status=active&priority=high" />
        <Kpi label="Pending > 7 days" value={mis.kpi.over7DaysNow} icon={ICON.clock} accent="from-rose-500 to-orange-500" tone={mis.kpi.over7DaysNow ? "bad" : undefined} />
        <Kpi label="Raised" value={mis.kpi.raised} icon={ICON.plus} accent="from-sky-500 to-cyan-500" />
        <Kpi label="Resolved" value={mis.kpi.resolved} icon={ICON.check} accent="from-emerald-500 to-teal-500" tone="good" />
        <Kpi label="Avg resolution" value={hoursLabel(mis.kpi.avgResolutionHours)} icon={ICON.timer} accent="from-violet-500 to-fuchsia-500" />
        <Kpi label="Avg 1st response" value={hoursLabel(mis.kpi.avgResponseHours)} icon={ICON.bolt} accent="from-cyan-500 to-blue-500" />
      </div>

      <Section title="Department-wise pending & ageing" note="Department of the person who raised the ticket, at the time it was raised.">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70">
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
          <thead className="bg-slate-50/70">
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

const ICON = {
  inbox: "M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M2.25 13.5V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.5M2.25 13.5l2.394-7.183A2.25 2.25 0 016.78 4.5h10.44a2.25 2.25 0 012.136 1.817L21.75 13.5",
  user: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  flame: "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48zM12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z",
  clock: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  plus: "M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
  check: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  timer: "M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5",
  bolt: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
};

function Kpi({ label, value, tone, href, icon, accent }: { label: string; value: number | string; tone?: "good" | "warn" | "bad"; href?: string; icon: string; accent: string }) {
  const color = tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : "text-slate-900";
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${accent}`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </span>
      </div>
      <div className={`mt-2 text-3xl font-bold tabular-nums tracking-tight ${color}`}>{value}</div>
    </>
  );
  return href ? <Link href={href} className="card card-hover block p-4">{body}</Link> : <div className="card p-4">{body}</div>;
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold text-slate-900">{title}</h2>
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
      <thead className="bg-slate-50/70">
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
