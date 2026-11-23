"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTicket } from "../actions";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, type TicketPriority, type TicketStatus } from "@/lib/types";

export function StaffPanel({
  ticket,
  agents,
  categories,
  meId,
}: {
  ticket: { id: string; status: TicketStatus; priority: TicketPriority; assignee_id: string | null; category_id: string };
  agents: { id: string; name: string }[];
  categories: { id: string; name: string; active: boolean }[];
  meId: string;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const needsRemark = status !== ticket.status && (status === "resolved" || status === "pending");

  function submit(fd: FormData) {
    setError(undefined);
    setSaved(false);
    // Send only what changed, so the history records only real changes.
    if (fd.get("status") === ticket.status) fd.delete("status");
    if (fd.get("priority") === ticket.priority) fd.delete("priority");
    if (fd.get("category_id") === ticket.category_id) fd.delete("category_id");
    const a = fd.get("assignee_id");
    if (a === (ticket.assignee_id ?? "__none")) fd.delete("assignee_id");
    start(async () => {
      const res = await updateTicket(fd);
      if (!res.ok) return setError(res.error);
      setSaved(true);
      const remark = form.current?.elements.namedItem("remark") as HTMLTextAreaElement | null;
      if (remark) remark.value = "";
      router.refresh();
    });
  }

  function quick(next: TicketStatus, assignMe = false) {
    const fd = new FormData(form.current!);
    fd.set("status", next);
    if (assignMe) fd.set("assignee_id", meId);
    setStatus(next);
    if (next !== ticket.status && (next === "resolved" || next === "pending") && !String(fd.get("remark") ?? "").trim()) {
      setError(next === "resolved" ? "Write what was done in the remark, then press Resolve again." : "Write what it's pending on in the remark.");
      (form.current?.elements.namedItem("remark") as HTMLTextAreaElement | null)?.focus();
      return;
    }
    submit(fd);
  }

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Update ticket</h2>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {!ticket.assignee_id && (
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => quick(ticket.status === "open" ? "in_progress" : ticket.status, true)}>
            Take it
          </button>
        )}
        {ticket.status === "open" && ticket.assignee_id && (
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => quick("in_progress")}>Start work</button>
        )}
        {(ticket.status === "in_progress" || ticket.status === "pending" || ticket.status === "open") && (
          <button type="button" className="btn btn-sm border-emerald-300 text-emerald-700 hover:bg-emerald-50" disabled={pending} onClick={() => quick("resolved")}>
            Resolve
          </button>
        )}
        {ticket.status === "resolved" && (
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => quick("closed")}>Close</button>
        )}
      </div>

      <form ref={form} action={submit} className="space-y-3">
        <input type="hidden" name="ticket_id" value={ticket.id} />
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select className="input" id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="assignee_id">Assigned to</label>
          <select className="input" id="assignee_id" name="assignee_id" defaultValue={ticket.assignee_id ?? "__none"}>
            <option value="__none">— Unassigned —</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}{a.id === meId ? " (me)" : ""}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="priority">Priority</label>
            <select className="input" id="priority" name="priority" defaultValue={ticket.priority}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="category_id">Category</label>
            <select className="input" id="category_id" name="category_id" defaultValue={ticket.category_id}>
              {categories.filter((c) => c.active || c.id === ticket.category_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="remark">
            Remark {needsRemark ? <span className="text-rose-600">* required</span> : <span className="font-normal text-slate-400">(visible to the requester)</span>}
          </label>
          <textarea
            className="input min-h-20"
            id="remark"
            name="remark"
            required={needsRemark}
            placeholder={status === "resolved" ? "What was done to fix it?" : status === "pending" ? "Pending on what / whom?" : "Action taken, next step…"}
          />
        </div>
        {error && <p className="alert-error">{error}</p>}
        {saved && !error && <p className="alert-ok">Saved. The people involved have been notified.</p>}
        <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save update"}</button>
      </form>
    </section>
  );
}
