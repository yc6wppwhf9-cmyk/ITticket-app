import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKET } from "@/lib/uploads-shared";
import { isStaff, type TicketAttachment, type TicketComment, type TicketEvent } from "@/lib/types";
import { TICKET_SELECT, type TicketRow } from "@/lib/tickets";
import { fmtBytes, fmtDateTime, fmtDuration, personName, requestTime } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { Avatar, Person } from "@/components/avatar";
import { CommentForm } from "./comment-form";
import { StaffPanel } from "./staff-panel";
import { RequesterActions } from "./requester-actions";
import { AddFiles } from "./add-files";

type Person = { full_name: string | null; email: string } | null;
type Att = TicketAttachment & { url: string | null };

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; failed?: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const staff = isStaff(me.role);
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("tickets")
    .select(`${TICKET_SELECT}, description, updated_at, assigned_at`)
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();
  const ticket = t as unknown as TicketRow & { description: string; assigned_at: string | null };

  const [comments, attachments, events, cats, agents] = await Promise.all([
    supabase.from("ticket_comments").select("*, author:profiles(full_name, email, role)").eq("ticket_id", id).order("created_at"),
    supabase.from("ticket_attachments").select("*").eq("ticket_id", id).order("created_at"),
    supabase.from("ticket_events").select("*, actor:profiles(full_name, email)").eq("ticket_id", id).order("id"),
    staff ? supabase.from("categories").select("id, name, active").order("sort_order") : Promise.resolve({ data: [] }),
    staff
      ? supabase.from("profiles").select("id, full_name, email").in("role", ["agent", "admin"]).eq("active", true).order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  // Opening the ticket counts as reading its notifications.
  await supabase.from("notifications").update({ read_at: new Date().toISOString() })
    .eq("user_id", me.id).eq("ticket_id", id).is("read_at", null);

  const atts = (attachments.data ?? []) as TicketAttachment[];
  const signed = atts.length
    ? (await supabase.storage.from(BUCKET).createSignedUrls(atts.map((a) => a.storage_path), 3600)).data ?? []
    : [];
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]));
  const withUrl: Att[] = atts.map((a) => ({ ...a, url: urlFor.get(a.storage_path) ?? null }));
  const ticketFiles = withUrl.filter((a) => !a.comment_id);
  const filesByComment = new Map<string, Att[]>();
  for (const a of withUrl) if (a.comment_id) filesByComment.set(a.comment_id, [...(filesByComment.get(a.comment_id) ?? []), a]);

  type C = TicketComment & { author: (Person & { role: string }) | null };
  type E = TicketEvent & { actor: Person };
  const timeline = [
    ...((comments.data ?? []) as C[]).map((c) => ({ kind: "comment" as const, at: c.created_at, c })),
    ...((events.data ?? []) as E[]).map((e) => ({ kind: "event" as const, at: e.created_at, e })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const now = requestTime();
  const end = ticket.closed_at ?? ticket.resolved_at;
  const isRequester = ticket.requester_id === me.id;

  return (
    <div className="space-y-5">
      <Link href="/tickets" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-700">
        <span aria-hidden>←</span> All tickets
      </Link>

      {sp.created && (
        <p className="alert-ok">
          <span aria-hidden>✓</span>
          <span>Ticket <b>{ticket.ticket_no}</b> has been raised. IT has been notified, and you&apos;ll be notified at every update.</span>
        </p>
      )}
      {sp.failed && <p className="alert-error">These files did not upload: {sp.failed}. Add them again below.</p>}

      <div className="card relative overflow-hidden p-5 sm:p-6">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400" />
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-lg bg-indigo-50 px-2 py-1 font-mono text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-600/10">{ticket.ticket_no}</span>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{ticket.category?.name}</span>
        </div>
        <h1 className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900">{ticket.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
          <Person name={personName(ticket.requester)} sub={ticket.department?.name ?? null} size={30} />
          <span>Raised {fmtDateTime(ticket.created_at)}</span>
          <span className="font-medium text-slate-700">
            {end ? "Turnaround" : "Open for"} {fmtDuration((end ? new Date(end).getTime() : now) - new Date(ticket.created_at).getTime())}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-5">
          <section className="card p-5 sm:p-6">
            <h2 className="section-title mb-3">Details</h2>
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">{ticket.description}</p>
            {ticketFiles.length > 0 && <FileList files={ticketFiles} />}
            {(staff || isRequester) && <AddFiles ticketId={id} />}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="section-title mb-5">Activity &amp; history</h2>
            <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent">
              {timeline.map((item) =>
                item.kind === "comment" ? (
                  <li key={`c${item.c.id}`} className="relative flex gap-3">
                    <span className="relative z-10"><Avatar name={personName(item.c.author)} size={32} /></span>
                    <div className={`min-w-0 flex-1 rounded-2xl border p-3.5 ${item.c.is_internal ? "border-amber-200 bg-amber-50/70" : "border-slate-200/80 bg-white"}`}>
                      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="font-semibold text-slate-900">{personName(item.c.author)}</span>
                        {item.c.author && item.c.author.role !== "requester" && (
                          <span className="rounded-md bg-gradient-to-r from-indigo-500 to-violet-500 px-1.5 py-px text-[10px] font-bold text-white">IT</span>
                        )}
                        {item.c.is_internal && <span className="rounded-md bg-amber-200/80 px-1.5 py-px text-[10px] font-bold text-amber-900">INTERNAL NOTE</span>}
                        <span className="text-slate-400">{fmtDateTime(item.c.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{item.c.body}</p>
                      {filesByComment.get(item.c.id) && <FileList files={filesByComment.get(item.c.id)!} />}
                    </div>
                  </li>
                ) : (
                  <li key={`e${item.e.id}`} className="relative flex gap-3 text-sm">
                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                      <span className={`h-2 w-2 rounded-full ${EVENT_DOT[item.e.event] ?? "bg-slate-400"}`} />
                    </span>
                    <div className="min-w-0 flex-1 pt-1.5">
                      <span className="font-semibold text-slate-800">{item.e.actor ? personName(item.e.actor) : "System"}</span>{" "}
                      <span className="text-slate-600">{describeEvent(item.e)}</span>{" "}
                      <span className="text-xs text-slate-400">· {fmtDateTime(item.e.created_at)}</span>
                      {item.e.note && (
                        <p className="mt-2 whitespace-pre-wrap rounded-xl border-l-[3px] border-indigo-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {item.e.note}
                        </p>
                      )}
                    </div>
                  </li>
                )
              )}
            </ol>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <CommentForm ticketId={id} staff={staff} />
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {staff ? (
            <StaffPanel
              ticket={{ id, status: ticket.status, priority: ticket.priority, assignee_id: ticket.assignee_id, category_id: ticket.category_id }}
              agents={((agents.data ?? []) as { id: string; full_name: string | null; email: string }[]).map((a) => ({ id: a.id, name: personName(a) }))}
              categories={(cats.data ?? []) as { id: string; name: string; active: boolean }[]}
              meId={me.id}
            />
          ) : (
            isRequester && <RequesterActions ticketId={id} status={ticket.status} />
          )}

          <section className="card p-5 text-sm">
            <h2 className="section-title mb-4">Ticket info</h2>
            <div className="mb-4 rounded-xl bg-slate-50 p-3">
              <div className="mb-1.5 text-xs font-semibold text-slate-500">Assigned to</div>
              {ticket.assignee ? <Person name={personName(ticket.assignee)} size={30} /> : <span className="font-semibold text-amber-700">Not yet assigned</span>}
            </div>
            <ol className="space-y-3">
              <Step label="Raised" at={ticket.created_at} />
              <Step label="Assigned" at={ticket.assigned_at} />
              <Step label="First action" at={ticket.first_response_at} />
              <Step label="Resolved" at={ticket.resolved_at} />
              <Step label="Closed" at={ticket.closed_at} />
            </ol>
            {ticket.first_response_at && (
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                <Stat k="Response time" v={fmtDuration(new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime())} />
                <Stat k={end ? "Turnaround" : "Open for"} v={fmtDuration((end ? new Date(end).getTime() : now) - new Date(ticket.created_at).getTime())} />
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

const EVENT_DOT: Record<string, string> = {
  created: "bg-sky-500",
  status: "bg-violet-500",
  assigned: "bg-indigo-500",
  priority: "bg-rose-500",
  category: "bg-amber-500",
  attachment: "bg-teal-500",
};

function Step({ label, at }: { label: string; at: string | null }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${at ? "bg-emerald-500 text-white" : "bg-slate-100 ring-1 ring-slate-200"}`}>
        {at && (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </span>
      <span className={`flex-1 ${at ? "font-medium text-slate-800" : "text-slate-400"}`}>{label}</span>
      <span className={`text-right text-xs ${at ? "text-slate-600" : "text-slate-300"}`}>{fmtDateTime(at)}</span>
    </li>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-semibold text-slate-500">{k}</div>
      <div className="font-bold tabular-nums text-slate-900">{v}</div>
    </div>
  );
}

function describeEvent(e: TicketEvent): string {
  switch (e.event) {
    case "created": return "raised this ticket";
    case "status": return `changed status from ${e.from_value} to ${e.to_value}`;
    case "assigned":
      return e.to_value ? (e.from_value ? `reassigned from ${e.from_value} to ${e.to_value}` : `assigned this to ${e.to_value}`) : `unassigned ${e.from_value ?? ""}`.trim();
    case "priority": return `changed priority from ${cap(e.from_value)} to ${cap(e.to_value)}`;
    case "category": return `moved this from ${e.from_value} to ${e.to_value}`;
    case "title": return `renamed the ticket to “${e.to_value}”`;
    case "description": return "edited the description";
    case "attachment": return `attached ${e.to_value}`;
    default: return e.event;
  }
}

const cap = (s: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : "");

function FileList({ files }: { files: Att[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {files.map((f) =>
        f.mime_type?.startsWith("image/") && f.url ? (
          <li key={f.id}>
            <a href={f.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl shadow-xs ring-1 ring-slate-200 transition hover:-translate-y-px hover:ring-indigo-400" title={f.file_name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.file_name} className="h-24 w-36 object-cover" />
            </a>
          </li>
        ) : (
          <li key={f.id}>
            <a
              href={f.url ? `${f.url}&download=${encodeURIComponent(f.file_name)}` : undefined}
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs shadow-xs ring-1 ring-slate-200 transition hover:-translate-y-px hover:ring-indigo-300"
            >
              <span>📎</span>
              <span className="max-w-[14rem] truncate font-medium">{f.file_name}</span>
              <span className="text-slate-500">{fmtBytes(f.size_bytes)}</span>
            </a>
          </li>
        )
      )}
    </ul>
  );
}
