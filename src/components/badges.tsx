import { PRIORITY_LABEL, STATUS_LABEL, type TicketPriority, type TicketStatus } from "@/lib/types";

const STATUS_STYLE: Record<TicketStatus, { pill: string; dot: string }> = {
  open: { pill: "bg-sky-50 text-sky-700 ring-sky-600/15", dot: "bg-sky-500" },
  in_progress: { pill: "bg-indigo-50 text-indigo-700 ring-indigo-600/15", dot: "bg-indigo-500 animate-pulse" },
  pending: { pill: "bg-amber-50 text-amber-800 ring-amber-600/20", dot: "bg-amber-500" },
  resolved: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", dot: "bg-emerald-500" },
  closed: { pill: "bg-slate-100 text-slate-600 ring-slate-500/15", dot: "bg-slate-400" },
};

const PRIORITY_STYLE: Record<TicketPriority, { text: string; bars: number; color: string }> = {
  high: { text: "text-rose-700", bars: 3, color: "bg-rose-500" },
  medium: { text: "text-amber-700", bars: 2, color: "bg-amber-500" },
  low: { text: "text-slate-500", bars: 1, color: "bg-slate-400" },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Signal-strength bars read faster than a coloured word in a long table. */
export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const p = PRIORITY_STYLE[priority];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${p.text}`}>
      <span className="inline-flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`w-[3px] rounded-sm ${n <= p.bars ? p.color : "bg-slate-200"}`} style={{ height: 4 + n * 3 }} />
        ))}
      </span>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
