import type { TicketPriority, TicketStatus } from "@/lib/types";

/** The minimum a report needs per ticket. */
export type MisTicket = {
  id: string;
  ticket_no: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  department: string;
  category: string;
  assignee: string;
};

export const AGE_BUCKETS = [
  { key: "0-2", label: "0–2 days", max: 2 },
  { key: "3-7", label: "3–7 days", max: 7 },
  { key: "8-15", label: "8–15 days", max: 15 },
  { key: "15+", label: "Over 15 days", max: Infinity },
] as const;
export type BucketKey = (typeof AGE_BUCKETS)[number]["key"];

const H = 3_600_000;
const isPendingStatus = (s: TicketStatus) => s === "open" || s === "in_progress" || s === "pending";

export function bucketFor(ageDays: number): BucketKey {
  for (const b of AGE_BUCKETS) if (ageDays <= b.max) return b.key;
  return "15+";
}

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const emptyBuckets = (): Record<BucketKey, number> => ({ "0-2": 0, "3-7": 0, "8-15": 0, "15+": 0 });

export type DeptRow = {
  department: string;
  open: number;
  in_progress: number;
  pending: number;
  totalPending: number;
  buckets: Record<BucketKey, number>;
  oldestHours: number | null;
  raised: number;
  resolved: number;
  avgResolutionHours: number | null;
};

export type GroupTatRow = {
  name: string;
  raised: number;
  pendingNow: number;
  resolved: number;
  avgResolutionHours: number | null;
  medianResolutionHours: number | null;
  avgResponseHours: number | null;
  within48hPct: number | null;
};

export type Mis = {
  kpi: {
    pendingNow: number;
    unassignedNow: number;
    highPendingNow: number;
    raised: number;
    resolved: number;
    closed: number;
    avgResolutionHours: number | null;
    avgResponseHours: number | null;
    over7DaysNow: number;
  };
  byDepartment: DeptRow[];
  ageingByPriority: Record<TicketPriority, Record<BucketKey, number>>;
  byCategory: GroupTatRow[];
  byAssignee: GroupTatRow[];
};

/**
 * Two lenses, deliberately:
 *  - "now": pending counts and ageing are a snapshot of every unfinished
 *    ticket, however old, since an old pending ticket is exactly what MIS is
 *    meant to surface;
 *  - "period": raised / resolved / turnaround cover tickets in [from, to).
 *    Raised counts by created_at; resolved and turnaround by resolved_at, so
 *    a ticket raised last month and fixed this month counts as fixed this month.
 */
export function computeMis(tickets: MisTicket[], from: Date, to: Date, now = Date.now()): Mis {
  const inPeriod = (iso: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t < to.getTime();
  };
  const resHours = (t: MisTicket) => (t.resolved_at ? (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / H : null);
  const respHours = (t: MisTicket) => (t.first_response_at ? (new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / H : null);
  const ageHours = (t: MisTicket) => (now - new Date(t.created_at).getTime()) / H;

  const pending = tickets.filter((t) => isPendingStatus(t.status));
  const resolvedInPeriod = tickets.filter((t) => inPeriod(t.resolved_at));
  const raisedInPeriod = tickets.filter((t) => inPeriod(t.created_at));

  const depts = new Map<string, DeptRow>();
  const dept = (name: string) => {
    let r = depts.get(name);
    if (!r) {
      r = { department: name, open: 0, in_progress: 0, pending: 0, totalPending: 0, buckets: emptyBuckets(), oldestHours: null, raised: 0, resolved: 0, avgResolutionHours: null };
      depts.set(name, r);
    }
    return r;
  };
  const deptRes = new Map<string, number[]>();
  for (const t of pending) {
    const r = dept(t.department);
    r[t.status as "open" | "in_progress" | "pending"]++;
    r.totalPending++;
    const a = ageHours(t);
    r.buckets[bucketFor(a / 24)]++;
    r.oldestHours = Math.max(r.oldestHours ?? 0, a);
  }
  for (const t of raisedInPeriod) dept(t.department).raised++;
  for (const t of resolvedInPeriod) {
    dept(t.department).resolved++;
    deptRes.set(t.department, [...(deptRes.get(t.department) ?? []), resHours(t)!]);
  }
  for (const [name, xs] of deptRes) dept(name).avgResolutionHours = avg(xs);

  const ageingByPriority = { high: emptyBuckets(), medium: emptyBuckets(), low: emptyBuckets() };
  for (const t of pending) ageingByPriority[t.priority][bucketFor(ageHours(t) / 24)]++;

  const groupBy = (key: (t: MisTicket) => string): GroupTatRow[] => {
    const names = new Set([...pending, ...raisedInPeriod, ...resolvedInPeriod].map(key));
    return [...names]
      .map((name) => {
        const res = resolvedInPeriod.filter((t) => key(t) === name).map((t) => resHours(t)!);
        const resp = raisedInPeriod.filter((t) => key(t) === name).map(respHours).filter((x): x is number => x != null);
        return {
          name,
          raised: raisedInPeriod.filter((t) => key(t) === name).length,
          pendingNow: pending.filter((t) => key(t) === name).length,
          resolved: res.length,
          avgResolutionHours: avg(res),
          medianResolutionHours: median(res),
          avgResponseHours: avg(resp),
          within48hPct: res.length ? (100 * res.filter((h) => h <= 48).length) / res.length : null,
        };
      })
      .sort((a, b) => b.pendingNow - a.pendingNow || b.raised - a.raised || a.name.localeCompare(b.name));
  };

  const allRes = resolvedInPeriod.map((t) => resHours(t)!);
  const allResp = raisedInPeriod.map(respHours).filter((x): x is number => x != null);

  return {
    kpi: {
      pendingNow: pending.length,
      unassignedNow: pending.filter((t) => t.assignee === UNASSIGNED).length,
      highPendingNow: pending.filter((t) => t.priority === "high").length,
      raised: raisedInPeriod.length,
      resolved: resolvedInPeriod.length,
      closed: tickets.filter((t) => inPeriod(t.closed_at)).length,
      avgResolutionHours: avg(allRes),
      avgResponseHours: avg(allResp),
      over7DaysNow: pending.filter((t) => ageHours(t) > 7 * 24).length,
    },
    byDepartment: [...depts.values()].sort((a, b) => b.totalPending - a.totalPending || b.raised - a.raised || a.department.localeCompare(b.department)),
    ageingByPriority,
    byCategory: groupBy((t) => t.category),
    byAssignee: groupBy((t) => t.assignee),
  };
}

export const UNASSIGNED = "Unassigned";
export const NO_DEPARTMENT = "No department";

/** Parse yyyy-mm-dd as a local (IST) calendar day boundary. */
export function parseDay(s: string | undefined, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback;
  const d = new Date(`${s}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export function dayString(d: Date): string {
  // en-CA formats as yyyy-mm-dd.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}

export function hoursLabel(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}
