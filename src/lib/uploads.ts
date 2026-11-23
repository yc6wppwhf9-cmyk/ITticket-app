"use client";

import { createClient } from "@/lib/supabase/client";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 10;
export { BUCKET } from "@/lib/uploads-shared";
import { BUCKET } from "@/lib/uploads-shared";

/** Keep names readable but safe as a storage key. */
function safeName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_");
  return cleaned.slice(-120) || "file";
}

/**
 * Files go straight from the browser to Supabase Storage, under the ticket's
 * own folder. Sending them through a server action would cap them at the
 * hosting platform's request size (4.5 MB on Vercel), which a single Excel
 * export or screenshot can exceed.
 *
 * Returns the names of files that failed, so the caller can say which.
 */
export async function uploadAttachments(
  ticketId: string,
  files: File[],
  commentId?: string
): Promise<string[]> {
  if (files.length === 0) return [];
  const supabase = createClient();
  const failed: string[] = [];
  await Promise.all(
    files.map(async (file) => {
      const path = `${ticketId}/${crypto.randomUUID()}/${safeName(file.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (up.error) {
        failed.push(file.name);
        return;
      }
      const row = await supabase.from("ticket_attachments").insert({
        ticket_id: ticketId,
        comment_id: commentId ?? null,
        storage_path: path,
        file_name: file.name,
        size_bytes: file.size,
        mime_type: file.type || null,
      });
      if (row.error) failed.push(file.name);
    })
  );
  return failed;
}

export function validateFiles(current: File[], incoming: File[]): { files: File[]; error?: string } {
  const tooBig = incoming.filter((f) => f.size > MAX_FILE_BYTES);
  const ok = incoming.filter((f) => f.size <= MAX_FILE_BYTES);
  let files = [...current, ...ok];
  let error = tooBig.length ? `${tooBig.map((f) => f.name).join(", ")} is over 25 MB.` : undefined;
  if (files.length > MAX_FILES) {
    files = files.slice(0, MAX_FILES);
    error = `Up to ${MAX_FILES} files at a time.`;
  }
  return { files, error };
}
