"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendPendingEmails } from "@/lib/email";
import { isStaff, PRIORITIES, STATUSES, type TicketPriority, type TicketStatus } from "@/lib/types";

export type ActionResult = { ok: true; id: string; ticketNo?: string } | { ok: false; error: string };

function mailAfter(ticketId: string) {
  after(() => sendPendingEmails(ticketId).catch((e) => console.error("[email]", e)));
}

function str(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}

export async function createTicket(fd: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const title = str(fd, "title");
  const description = str(fd, "description");
  const categoryId = str(fd, "category_id");
  const priority = str(fd, "priority") as TicketPriority;
  if (title.length < 3) return { ok: false, error: "Give the ticket a short title (at least 3 characters)." };
  if (title.length > 200) return { ok: false, error: "Keep the title under 200 characters." };
  if (!description) return { ok: false, error: "Describe the issue or requirement." };
  if (!categoryId) return { ok: false, error: "Choose a category." };
  if (!PRIORITIES.includes(priority)) return { ok: false, error: "Choose a priority." };

  const row: Record<string, unknown> = { title, description, category_id: categoryId, priority, requester_id: me.id };
  // The database ignores these from non-staff anyway; not sending them keeps
  // the intent obvious.
  if (isStaff(me.role)) {
    const onBehalf = str(fd, "requester_id");
    const assignee = str(fd, "assignee_id");
    if (onBehalf) row.requester_id = onBehalf;
    if (assignee) row.assignee_id = assignee;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("tickets").insert(row).select("id, ticket_no").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the ticket." };
  mailAfter(data.id);
  revalidatePath("/tickets");
  return { ok: true, id: data.id, ticketNo: data.ticket_no };
}

export async function addComment(fd: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const ticketId = str(fd, "ticket_id");
  const body = str(fd, "body");
  const internal = fd.get("is_internal") === "on" && isStaff(me.role);
  if (!body) return { ok: false, error: "Write a comment first." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ticket_comments")
    .insert({ ticket_id: ticketId, body, is_internal: internal, author_id: me.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not post the comment." };
  mailAfter(ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  return { ok: true, id: data.id };
}

/** IT changes: status, assignee, priority, category, with an optional remark. */
export async function updateTicket(fd: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const ticketId = str(fd, "ticket_id");
  const status = str(fd, "status") as TicketStatus | "";
  const assignee = str(fd, "assignee_id");
  const priority = str(fd, "priority") as TicketPriority | "";
  const category = str(fd, "category_id");
  const remark = str(fd, "remark");

  if (!isStaff(me.role)) {
    // Requesters only get the close/reopen buttons; the database enforces it too.
    if (status !== "closed" && status !== "open") return { ok: false, error: "Not allowed." };
    if (status === "open" && !remark) return { ok: false, error: "Tell IT what is still wrong so they can pick it up." };
  }
  if (status && !STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  if (priority && !PRIORITIES.includes(priority)) return { ok: false, error: "Unknown priority." };
  if (status === "resolved" && !remark) return { ok: false, error: "Add a remark saying what was done to resolve it." };
  if (status === "pending" && !remark) return { ok: false, error: "Add a remark saying what the ticket is pending on." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_ticket", {
    p_ticket_id: ticketId,
    p_status: status || null,
    p_assignee_id: assignee && assignee !== "__none" ? assignee : null,
    p_unassign: assignee === "__none",
    p_priority: isStaff(me.role) ? priority || null : null,
    p_category_id: isStaff(me.role) ? category || null : null,
    p_remark: remark || null,
  });
  if (error) return { ok: false, error: error.message };
  mailAfter(ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { ok: true, id: ticketId };
}

/** Called after browser uploads finish, so attachment events reach mail too. */
export async function attachmentsAdded(ticketId: string) {
  await requireUser();
  revalidatePath(`/tickets/${ticketId}`);
}
