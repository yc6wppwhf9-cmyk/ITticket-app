export type AppRole = "requester" | "agent" | "admin";
export type TicketStatus = "open" | "in_progress" | "pending" | "resolved" | "closed";
export type TicketPriority = "high" | "medium" | "low";

export type Department = { id: string; name: string; active: boolean };

export type Category = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  default_assignee_id: string | null;
  active: boolean;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: AppRole;
  department_id: string | null;
  active: boolean;
  created_at: string;
};

export type Ticket = {
  id: string;
  ticket_no: string;
  title: string;
  description: string;
  category_id: string;
  priority: TicketPriority;
  status: TicketStatus;
  requester_id: string;
  department_id: string | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  last_activity_at: string;
};

export type TicketComment = {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type TicketAttachment = {
  id: string;
  ticket_id: string;
  comment_id: string | null;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
};

export type TicketEvent = {
  id: number;
  ticket_id: string;
  actor_id: string | null;
  event: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  created_at: string;
};

export type Notification = {
  id: number;
  user_id: string;
  ticket_id: string | null;
  kind: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

export const STATUSES: TicketStatus[] = ["open", "in_progress", "pending", "resolved", "closed"];
export const PRIORITIES: TicketPriority[] = ["high", "medium", "low"];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  pending: "Pending",
  resolved: "Resolved",
  closed: "Closed",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  requester: "Requester",
  agent: "IT Agent",
  admin: "IT Admin",
};

/** Still needs work: anything not resolved or closed. */
export const ACTIVE_STATUSES: TicketStatus[] = ["open", "in_progress", "pending"];

export function isStaff(role: AppRole): boolean {
  return role === "agent" || role === "admin";
}
