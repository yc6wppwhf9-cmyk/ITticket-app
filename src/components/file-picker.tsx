"use client";

import { useRef, useState } from "react";
import { fmtBytes } from "@/lib/format";
import { validateFiles } from "@/lib/uploads";

/**
 * Attachment picker: click to browse, drag and drop, or paste a screenshot
 * anywhere in the surrounding form (the parent wires onPaste to `addFiles`).
 */
export function FilePicker({
  files,
  onChange,
  compact = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string>();

  const add = (incoming: File[]) => {
    const r = validateFiles(files, incoming);
    setError(r.error);
    onChange(r.files);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(Array.from(e.dataTransfer.files)); }}
        onClick={() => input.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed text-center text-sm transition ${compact ? "px-3 py-2" : "px-4 py-5"} ${
          drag ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50/50 hover:border-indigo-400"
        }`}
      >
        <span className="font-semibold text-indigo-700">Attach files</span>
        <span className="text-slate-500"> — drop here, click to browse, or paste a screenshot (Ctrl+V)</span>
        {!compact && <div className="mt-0.5 text-xs text-slate-400">Screenshots, Excel, PDF, Word… up to 25 MB each</div>}
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { add(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md bg-slate-100 px-2.5 py-1 text-xs">
              <span className="truncate">📎 {f.name} <span className="text-slate-500">{fmtBytes(f.size)}</span></span>
              <button type="button" className="ml-2 font-semibold text-slate-500 hover:text-rose-600" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Pull pasted images out of a clipboard event, naming them sensibly. */
export function filesFromPaste(e: React.ClipboardEvent): File[] {
  const out: File[] = [];
  for (const item of Array.from(e.clipboardData.items)) {
    if (item.kind !== "file") continue;
    const f = item.getAsFile();
    if (!f) continue;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const ext = f.type.split("/")[1] || "png";
    out.push(f.name && f.name !== "image.png" ? f : new File([f], `screenshot-${stamp}.${ext}`, { type: f.type }));
  }
  return out;
}
