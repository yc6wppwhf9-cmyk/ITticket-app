"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTicket } from "../actions";
import { FilePicker, filesFromPaste } from "@/components/file-picker";
import { uploadAttachments, validateFiles } from "@/lib/uploads";
import { PRIORITIES, PRIORITY_LABEL, type TicketPriority } from "@/lib/types";

type Opt = { id: string; name: string };

const PRIORITY_HINT: Record<TicketPriority, string> = {
  high: "Work is stopped or many people are affected",
  medium: "Work is slowed down; a workaround exists",
  low: "A request or minor issue that can wait",
};

export function NewTicketForm({
  categories,
  staff,
  people,
  agents,
}: {
  categories: (Opt & { description: string | null })[];
  staff: boolean;
  people: Opt[];
  agents: Opt[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const [stage, setStage] = useState<string>();
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [categoryId, setCategoryId] = useState("");
  const [pending, start] = useTransition();
  const category = categories.find((c) => c.id === categoryId);

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      setStage("Creating ticket…");
      const res = await createTicket(fd);
      if (!res.ok) {
        setError(res.error);
        setStage(undefined);
        return;
      }
      if (files.length) {
        setStage(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}…`);
        const failed = await uploadAttachments(res.id, files);
        if (failed.length) {
          router.push(`/tickets/${res.id}?created=1&failed=${encodeURIComponent(failed.join(", "))}`);
          return;
        }
      }
      router.push(`/tickets/${res.id}?created=1`);
    });
  }

  return (
    <form
      action={submit}
      onPaste={(e) => {
        const pasted = filesFromPaste(e);
        if (pasted.length) {
          e.preventDefault();
          setFiles((cur) => validateFiles(cur, pasted).files);
        }
      }}
      className="card space-y-6 p-5 sm:p-7"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="category_id">Category *</label>
          <select className="input" id="category_id" name="category_id" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="" disabled>Select a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {category?.description && <p className="mt-1 text-xs text-slate-500">{category.description}</p>}
        </div>
        <div>
          <span className="label">Priority *</span>
          <input type="hidden" name="priority" value={priority} />
          <div className="grid grid-cols-3 gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition ${
                  priority === p
                    ? p === "high" ? "border-rose-500 bg-rose-50 text-rose-700" : p === "medium" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-500 bg-slate-100 text-slate-700"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">{PRIORITY_HINT[priority]}</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="title">Subject *</label>
        <input className="input" id="title" name="title" required minLength={3} maxLength={200} placeholder="e.g. GRN not posting for PO 4500123 in Ginesys" />
      </div>

      <div>
        <label className="label" htmlFor="description">Details *</label>
        <textarea
          className="input min-h-40"
          id="description"
          name="description"
          required
          placeholder={"What happened, or what do you need?\nInclude document numbers, item codes, the screen/menu and any error message."}
        />
      </div>

      <div>
        <span className="label">Attachments</span>
        <FilePicker files={files} onChange={setFiles} />
      </div>

      {staff && (
        <details className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">IT options: raise on behalf of someone / assign now</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="requester_id">Raised for</label>
              <select className="input" id="requester_id" name="requester_id" defaultValue="">
                <option value="">Myself</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="assignee_id">Assign to</label>
              <select className="input" id="assignee_id" name="assignee_id" defaultValue="">
                <option value="">Category default / leave unassigned</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </details>
      )}

      {error && <p className="alert-error">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {stage && <span className="text-sm text-slate-500">{stage}</span>}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Submitting…" : "Submit ticket"}
        </button>
      </div>
    </form>
  );
}
