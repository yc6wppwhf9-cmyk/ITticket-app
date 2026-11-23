import type { TicketStatus } from "@/lib/types";

export type StatusGroup = "active" | "resolved" | "closed" | "all";

export const STATUS_GROUPS: { key: StatusGroup; label: string; statuses: TicketStatus[] | null }[] = [
  { key: "active", label: "Pending", statuses: ["open", "in_progress", "pending"] },
  { key: "resolved", label: "Completed", statuses: ["resolved"] },
  { key: "closed", label: "Closed", statuses: ["closed"] },
  { key: "all", label: "All", statuses: null },
];

export const TICKET_SELECT = `
  id, ticket_no, title, status, priority, created_at, last_activity_at, resolved_at, closed_at,
  first_response_at, requester_id, assignee_id, category_id, department_id,
  category:categories(name),
  department:departments(name),
  requester:profiles!tickets_requester_id_fkey(full_name, email),
  assignee:profiles!tickets_assignee_id_fkey(full_name, email)
`;

type Person = { full_name: string | null; email: string } | null;
export type TicketRow = {
  id: string;
  ticket_no: string;
  title: string;
  status: TicketStatus;
  priority: "high" | "medium" | "low";
  created_at: string;
  last_activity_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  first_response_at: string | null;
  requester_id: string;
  assignee_id: string | null;
  category_id: string;
  department_id: string | null;
  category: { name: string } | null;
  department: { name: string } | null;
  requester: Person;
  assignee: Person;
};

/** PostgREST's or() syntax treats these characters as structure. */
export function cleanSearch(q: string): string {
  return q.replace(/[,()*%\\]/g, " ").trim().slice(0, 80);
}
