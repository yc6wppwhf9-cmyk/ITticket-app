"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTicket } from "../actions";
import type { TicketStatus } from "@/lib/types";

/** A requester's only status moves: accept a resolution, or reopen. */
export function RequesterActions({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const router = useRouter();
  const [reopening, setReopening] = useState(false);
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (status !== "resolved" && status !== "closed") {
    return (
      <section className="card p-4 text-sm text-slate-600">
        IT is working on this ticket. You&apos;ll be notified when it&apos;s updated. Add a comment if you have more details.
      </section>
    );
  }

  const send = (next: "closed" | "open") =>
    start(async () => {
      setError(undefined);
      const fd = new FormData();
      fd.set("ticket_id", ticketId);
      fd.set("status", next);
      if (remark.trim()) fd.set("remark", remark.trim());
      const res = await updateTicket(fd);
      if (!res.ok) return setError(res.error);
      setReopening(false);
      setRemark("");
      router.refresh();
    });

  return (
    <section className="card space-y-3 p-4">
      {status === "resolved" ? (
        <>
          <h2 className="font-semibold">IT has marked this resolved</h2>
          <p className="text-sm text-slate-600">If it&apos;s working now, close the ticket. If not, reopen it and say what&apos;s still wrong.</p>
        </>
      ) : (
        <>
          <h2 className="font-semibold">This ticket is closed</h2>
          <p className="text-sm text-slate-600">Reopen it if the problem came back.</p>
        </>
      )}
      {reopening && (
        <textarea className="input min-h-20" placeholder="What is still not working?" value={remark} onChange={(e) => setRemark(e.target.value)} autoFocus />
      )}
      {error && <p className="alert-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {status === "resolved" && !reopening && (
          <button className="btn-primary" disabled={pending} onClick={() => send("closed")}>✓ Confirm &amp; close</button>
        )}
        {!reopening ? (
          <button className="btn" disabled={pending} onClick={() => setReopening(true)}>Reopen</button>
        ) : (
          <>
            <button className="btn-primary" disabled={pending || !remark.trim()} onClick={() => send("open")}>Reopen ticket</button>
            <button className="btn" onClick={() => setReopening(false)}>Cancel</button>
          </>
        )}
      </div>
    </section>
  );
}
