import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKET } from "@/lib/uploads-shared";
import { isStaff, type TicketAttachment, type TicketComment, type TicketEvent } from "@/lib/types";
import { TICKET_SELECT, type TicketRow } from "@/lib/tickets";
import { fmtBytes, fmtDateTime, fmtDuration, personName, requestTime } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "@/components/badges";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/tickets" className="text-slate-500 hover:text-indigo-700">← Tickets</Link>
      </div>

      {sp.created && (
        <p className="alert-ok">
          Ticket <b>{ticket.ticket_no}</b> has been raised. IT has been notified, and you&apos;ll be notified at every update.
        </p>
      )}
      {sp.failed && <p className="alert-error">These files did not upload: {sp.failed}. Add them again below.</p>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-indigo-700">{ticket.ticket_no}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight break-words">{ticket.title}</h1>
          <p className="muted">
            {ticket.category?.name} · raised by {personName(ticket.requester)}
            {ticket.department ? ` (${ticket.department.name})` : ""} on {fmtDateTime(ticket.created_at)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <section className="card p-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Details</h2>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{ticket.description}</p>
            {ticketFiles.length > 0 && <FileList files={ticketFiles} />}
            {(staff || isRequester) && <AddFiles ticketId={id} />}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-500">Activity &amp; history</h2>
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {timeline.map((item) =>
                item.kind === "comment" ? (
                  <li key={`c${item.c.id}`} className="relative">
                    <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${item.c.is_internal ? "bg-amber-400" : item.c.author?.role === "requester" ? "bg-sky-500" : "bg-indigo-600"}`} />
                    <div className={`rounded-xl border p-3 ${item.c.is_internal ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-white"}`}>
                      <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs">
                        <span className="font-semibold text-slate-800">{personName(item.c.author)}</span>
                        {item.c.author && item.c.author.role !== "requester" && <span className="rounded bg-indigo-50 px-1.5 text-[10px] font-bold text-indigo-700">IT</span>}
                        {item.c.is_internal && <span className="rounded bg-amber-200 px-1.5 text-[10px] font-bold text-amber-900">INTERNAL NOTE</span>}
                        <span className="text-slate-400">{fmtDateTime(item.c.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm">{item.c.body}</p>
                      {filesByComment.get(item.c.id) && <FileList files={filesByComment.get(item.c.id)!} />}
                    </div>
                  </li>
                ) : (
                  <li key={`e${item.e.id}`} className="relative text-sm">
                    <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-slate-300 ring-4 ring-white" />
                    <span className="font-medium text-slate-700">{item.e.actor ? personName(item.e.actor) : "System"}</span>{" "}
                    <span className="text-slate-600">{describeEvent(item.e)}</span>{" "}
                    <span className="text-xs text-slate-400">· {fmtDateTime(item.e.created_at)}</span>
                    {item.e.note && (
                      <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                        “{item.e.note}”
                      </p>
                    )}
                  </li>
                )
              )}
            </ol>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <CommentForm ticketId={id} staff={staff} />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
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

          <section className="card p-4 text-sm">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Ticket info</h2>
            <dl className="space-y-2">
              <Row k="Assigned to" v={ticket.assignee ? personName(ticket.assignee) : <span className="text-amber-700">Not yet assigned</span>} />
              <Row k="Raised by" v={personName(ticket.requester)} />
              <Row k="Department" v={ticket.department?.name ?? "—"} />
              <Row k="Category" v={ticket.category?.name ?? "—"} />
              <div className="my-2 border-t border-slate-100" />
              <Row k="Raised" v={fmtDateTime(ticket.created_at)} />
              <Row k="Assigned" v={fmtDateTime(ticket.assigned_at)} />
              <Row k="First action" v={fmtDateTime(ticket.first_response_at)} />
              <Row k="Resolved" v={fmtDateTime(ticket.resolved_at)} />
              <Row k="Closed" v={fmtDateTime(ticket.closed_at)} />
              <div className="my-2 border-t border-slate-100" />
              <Row k={end ? "Turnaround" : "Open for"} v={<b>{fmtDuration((end ? new Date(end).getTime() : now) - new Date(ticket.created_at).getTime())}</b>} />
              {ticket.first_response_at && (
                <Row k="Response time" v={fmtDuration(new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime())} />
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium text-slate-800">{v}</dd>
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
            <a href={f.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-slate-200 hover:ring-indigo-400" title={f.file_name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.file_name} className="h-24 w-36 object-cover" />
            </a>
          </li>
        ) : (
          <li key={f.id}>
            <a
              href={f.url ? `${f.url}&download=${encodeURIComponent(f.file_name)}` : undefined}
              className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs ring-1 ring-slate-200 hover:bg-indigo-50 hover:ring-indigo-300"
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
