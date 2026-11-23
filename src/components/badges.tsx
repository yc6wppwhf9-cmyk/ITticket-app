import { PRIORITY_LABEL, STATUS_LABEL, type TicketPriority, type TicketStatus } from "@/lib/types";

const STATUS_STYLE: Record<TicketStatus, string> = {
  open: "bg-sky-50 text-sky-700 ring-sky-200",
  in_progress: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  high: "bg-rose-50 text-rose-700 ring-rose-200",
  medium: "bg-orange-50 text-orange-700 ring-orange-200",
  low: "bg-slate-50 text-slate-600 ring-slate-200",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${PRIORITY_STYLE[priority]}`}>
      {priority === "high" && <span className="mr-1">▲</span>}
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
