import "server-only";
import { createClient } from "@/lib/supabase/server";
import { NO_DEPARTMENT, UNASSIGNED, type MisTicket } from "@/lib/mis";
import { personName } from "@/lib/format";

export type ExportTicket = MisTicket & {
  title: string;
  requester: string;
  assigned_at: string | null;
};

/** Every ticket the caller can see (IT staff: all), paged past the 1000-row cap. */
export async function loadMisTickets(): Promise<ExportTicket[]> {
  const supabase = await createClient();
  const out: ExportTicket[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("tickets")
      .select(`id, ticket_no, title, status, priority, created_at, assigned_at, first_response_at, resolved_at, closed_at,
        category:categories(name), department:departments(name),
        requester:profiles!tickets_requester_id_fkey(full_name, email),
        assignee:profiles!tickets_assignee_id_fkey(full_name, email)`)
      .order("created_at")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    type P = { full_name: string | null; email: string } | null;
    for (const r of (data ?? []) as unknown as (Omit<ExportTicket, "category" | "department" | "assignee" | "requester"> & {
      category: { name: string } | null; department: { name: string } | null; requester: P; assignee: P;
    })[]) {
      out.push({
        ...r,
        category: r.category?.name ?? "—",
        department: r.department?.name ?? NO_DEPARTMENT,
        requester: personName(r.requester),
        assignee: r.assignee ? personName(r.assignee) : UNASSIGNED,
      });
    }
    if ((data ?? []).length < PAGE) return out;
  }
}
