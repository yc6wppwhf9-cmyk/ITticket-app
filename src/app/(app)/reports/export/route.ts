import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { loadMisTickets } from "@/lib/mis-data";
import { bucketFor, dayString, parseDay } from "@/lib/mis";
import { fmtDateTime } from "@/lib/format";
import { isStaff, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/types";

/** CSV with a BOM, so Excel opens it with the right encoding. */
function csv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    // A leading = + - @ makes Excel evaluate the cell as a formula.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export async function GET(req: NextRequest) {
  const me = await getSession();
  if (!me || !me.active || !isStaff(me.role)) return new NextResponse("Forbidden", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope") === "pending" ? "pending" : sp.get("scope") === "all" ? "all" : "period";
  const from = parseDay(sp.get("from") ?? undefined, new Date(Date.now() - 30 * 86_400_000));
  const to = new Date(parseDay(sp.get("to") ?? undefined, parseDay(dayString(new Date()), new Date())).getTime() + 86_400_000);

  const now = Date.now();
  let tickets = await loadMisTickets();
  if (scope === "pending") tickets = tickets.filter((t) => ["open", "in_progress", "pending"].includes(t.status));
  if (scope === "period") tickets = tickets.filter((t) => {
    const c = new Date(t.created_at).getTime();
    return c >= from.getTime() && c < to.getTime();
  });

  const hrs = (a: string | null, b: string | null) =>
    a && b ? ((new Date(b).getTime() - new Date(a).getTime()) / 3_600_000).toFixed(1) : null;

  const rows: (string | number | null)[][] = [
    ["Ticket No", "Subject", "Category", "Priority", "Status", "Department", "Raised By", "Assigned To",
     "Raised On", "Assigned On", "First Action On", "Resolved On", "Closed On",
     "Response Time (hrs)", "Resolution Time (hrs)", "Age (days)", "Ageing Bucket"],
    ...tickets.map((t) => {
      const done = t.status === "resolved" || t.status === "closed";
      const ageDays = (now - new Date(t.created_at).getTime()) / 86_400_000;
      return [
        t.ticket_no, t.title, t.category, PRIORITY_LABEL[t.priority], STATUS_LABEL[t.status], t.department,
        t.requester, t.assignee,
        fmtDateTime(t.created_at), fmtDateTime(t.assigned_at), fmtDateTime(t.first_response_at),
        fmtDateTime(t.resolved_at), fmtDateTime(t.closed_at),
        hrs(t.created_at, t.first_response_at), hrs(t.created_at, t.resolved_at),
        done ? null : ageDays.toFixed(1),
        done ? null : bucketFor(ageDays),
      ];
    }),
  ];

  const name = scope === "pending"
    ? `pending-tickets-${dayString(new Date())}.csv`
    : scope === "all" ? `all-tickets-${dayString(new Date())}.csv`
    : `tickets-${dayString(from)}-to-${dayString(new Date(to.getTime() - 86_400_000))}.csv`;
  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
