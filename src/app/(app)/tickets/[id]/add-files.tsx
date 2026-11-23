"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { attachmentsAdded } from "../actions";
import { FilePicker } from "@/components/file-picker";
import { uploadAttachments } from "@/lib/uploads";

/** Add more files to the ticket itself after it was raised. */
export function AddFiles({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button type="button" className="mt-3 text-xs font-semibold text-indigo-700 hover:underline" onClick={() => setOpen(true)}>
        + Add attachments
      </button>
    );

  return (
    <div className="mt-3 space-y-2">
      <FilePicker files={files} onChange={setFiles} compact />
      {error && <p className="alert-error">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={pending || files.length === 0}
          onClick={() =>
            start(async () => {
              const failed = await uploadAttachments(ticketId, files);
              await attachmentsAdded(ticketId);
              if (failed.length) setError(`Failed: ${failed.join(", ")}`);
              else { setFiles([]); setOpen(false); }
              router.refresh();
            })
          }
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => { setOpen(false); setFiles([]); }}>Cancel</button>
      </div>
    </div>
  );
}
