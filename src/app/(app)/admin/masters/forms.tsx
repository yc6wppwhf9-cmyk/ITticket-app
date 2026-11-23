"use client";

import { useActionState, useState, useTransition } from "react";
import { addCategory, addDepartment, saveCategory, saveDepartment, type Result } from "./actions";
import { FormMessage, SubmitButton } from "@/components/submit-button";

export function AddForm({ kind }: { kind: "department" | "category" }) {
  const [state, action] = useActionState(kind === "department" ? addDepartment : addCategory, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="min-w-[12rem] flex-1">
        <label className="label">New {kind}</label>
        <input className="input" name="name" required placeholder={kind === "department" ? "e.g. Dispatch" : "e.g. Printer / Scanner"} />
      </div>
      {kind === "category" && (
        <div className="min-w-[14rem] flex-[2]">
          <label className="label">Hint shown to requesters</label>
          <input className="input" name="description" placeholder="Optional" />
        </div>
      )}
      <SubmitButton pendingText="Adding…">Add</SubmitButton>
      <div className="w-full"><FormMessage state={state} /></div>
    </form>
  );
}

function useSaver(fn: (fd: FormData) => Promise<Result>) {
  const [msg, setMsg] = useState<Result>();
  const [pending, start] = useTransition();
  return { msg, pending, run: (fd: FormData) => start(async () => setMsg(await fn(fd))) };
}

export function DepartmentRow({ d }: { d: { id: string; name: string; active: boolean } }) {
  const s = useSaver(saveDepartment);
  return (
    <form action={s.run} className="flex flex-wrap items-center gap-2 px-4 py-2">
      <input type="hidden" name="id" value={d.id} />
      <input className="input max-w-xs flex-1" name="name" defaultValue={d.name} required />
      <select className="input w-32" name="active" defaultValue={String(d.active)}>
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </select>
      <button className="btn btn-sm" disabled={s.pending}>{s.pending ? "Saving…" : "Save"}</button>
      {s.msg?.error && <span className="text-xs text-rose-600">{s.msg.error}</span>}
      {s.msg?.ok && <span className="text-xs text-emerald-600">{s.msg.ok}</span>}
    </form>
  );
}

export function CategoryRow({
  c,
  agents,
}: {
  c: { id: string; name: string; description: string | null; sort_order: number; default_assignee_id: string | null; active: boolean };
  agents: { id: string; name: string }[];
}) {
  const s = useSaver(saveCategory);
  return (
    <form action={s.run} className="grid gap-2 px-4 py-3 md:grid-cols-[4rem_1fr_1.4fr_1fr_7rem_auto] md:items-center">
      <input type="hidden" name="id" value={c.id} />
      <input className="input" name="sort_order" type="number" defaultValue={c.sort_order} title="Display order" />
      <input className="input" name="name" defaultValue={c.name} required />
      <input className="input" name="description" defaultValue={c.description ?? ""} placeholder="Hint for requesters" />
      <select className="input" name="default_assignee_id" defaultValue={c.default_assignee_id ?? ""} title="New tickets in this category are assigned to">
        <option value="">Auto-assign: nobody</option>
        {agents.map((a) => <option key={a.id} value={a.id}>Auto-assign: {a.name}</option>)}
      </select>
      <select className="input" name="active" defaultValue={String(c.active)}>
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </select>
      <div className="flex items-center gap-2">
        <button className="btn btn-sm" disabled={s.pending}>{s.pending ? "Saving…" : "Save"}</button>
        {s.msg?.error && <span className="text-xs text-rose-600">{s.msg.error}</span>}
        {s.msg?.ok && <span className="text-xs text-emerald-600">✓</span>}
      </div>
    </form>
  );
}
