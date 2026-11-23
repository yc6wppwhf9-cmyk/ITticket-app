"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComment, attachmentsAdded } from "../actions";
import { FilePicker, filesFromPaste } from "@/components/file-picker";
import { uploadAttachments, validateFiles } from "@/lib/uploads";

export function CommentForm({ ticketId, staff }: { ticketId: string; staff: boolean }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const [internal, setInternal] = useState(false);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await addComment(fd);
      if (!res.ok) return setError(res.error);
      if (files.length) {
        const failed = await uploadAttachments(ticketId, files, res.id);
        if (failed.length) setError(`Comment posted, but these files failed: ${failed.join(", ")}`);
        await attachmentsAdded(ticketId);
      }
      setFiles([]);
      setInternal(false);
      form.current?.reset();
      router.refresh();
    });
  }

  return (
    <form
      ref={form}
      action={submit}
      className="space-y-2"
      onPaste={(e) => {
        const pasted = filesFromPaste(e);
        if (pasted.length) {
          e.preventDefault();
          setFiles((cur) => validateFiles(cur, pasted).files);
        }
      }}
    >
      <input type="hidden" name="ticket_id" value={ticketId} />
      <label className="label" htmlFor="body">Add a comment</label>
      <textarea
        id="body"
        name="body"
        required
        className={`input min-h-24 ${internal ? "border-amber-400 bg-amber-50/50" : ""}`}
        placeholder={internal ? "Internal note — only IT staff will see this" : "Write an update, ask a question, or share more details…"}
      />
      <FilePicker files={files} onChange={setFiles} compact />
      {error && <p className="alert-error">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {staff ? (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="is_internal" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-4 w-4 accent-amber-500" />
            Internal note (IT only)
          </label>
        ) : <span />}
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Posting…" : internal ? "Add note" : "Post comment"}</button>
      </div>
    </form>
  );
}
