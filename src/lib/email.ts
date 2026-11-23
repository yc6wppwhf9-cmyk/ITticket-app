import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, cleanEnv } from "@/lib/env";

/**
 * Email delivery for notifications.
 *
 * The database decides who hears about what: its triggers write a row to
 * `notifications` for each person who should know (that row is also the in-app
 * bell). This module is the outbox: it claims rows that have not been emailed
 * yet, stamps them, and mails them through Resend. Claiming is a single
 * UPDATE ... WHERE emailed_at IS NULL, so two sweeps racing each other can
 * never mail the same row twice.
 *
 * Without RESEND_API_KEY (or the service-role key) nothing is claimed, the
 * in-app notifications still work, and email simply stays off.
 */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

const SUBJECT: Record<string, string> = {
  created: "New ticket",
  assigned: "Ticket assigned",
  status: "Ticket status changed",
  comment: "New comment on ticket",
  note: "Internal note on ticket",
};

type Claimed = {
  id: number;
  user_id: string;
  ticket_id: string | null;
  kind: string;
  message: string;
};

export async function sendPendingEmails(ticketId?: string): Promise<{ sent: number; skipped?: string }> {
  const apiKey = cleanEnv("RESEND_API_KEY", process.env.RESEND_API_KEY);
  const from = cleanEnv("EMAIL_FROM", process.env.EMAIL_FROM) || "IT Helpdesk <onboarding@resend.dev>";
  const admin = createAdminClient();
  if (!apiKey || !admin) return { sent: 0, skipped: "email not configured" };

  // Only recent rows: if email was switched on late, nobody gets a flood of
  // week-old updates.
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  let q = admin
    .from("notifications")
    .update({ emailed_at: new Date().toISOString() })
    .is("emailed_at", null)
    .gte("created_at", cutoff);
  if (ticketId) q = q.eq("ticket_id", ticketId);
  const { data, error } = await q.select("id, user_id, ticket_id, kind, message");
  if (error) {
    console.error("[email] claim failed", error.message);
    return { sent: 0, skipped: error.message };
  }
  const rows = (data ?? []) as Claimed[];
  if (rows.length === 0) return { sent: 0 };

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: people } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);
  const byId = new Map((people ?? []).map((p) => [p.id as string, p as { email: string; full_name: string | null }]));

  let sent = 0;
  await Promise.all(
    rows.map(async (r) => {
      const to = byId.get(r.user_id);
      if (!to?.email) return;
      const link = r.ticket_id ? appUrl(`/tickets/${r.ticket_id}`) : appUrl("/notifications");
      const ticketNo = r.message.match(/IT-\d{4}-\d+/)?.[0];
      const subject = `${SUBJECT[r.kind] ?? "Ticket update"}${ticketNo ? ` · ${ticketNo}` : ""}`;
      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:#0f172a;line-height:1.5">
          <p>Hello ${esc(to.full_name || to.email.split("@")[0])},</p>
          <p>${esc(r.message)}</p>
          <p><a href="${esc(link)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none">Open ticket</a></p>
          <p style="color:#64748b;font-size:12px">IT &amp; Ginesys Helpdesk — this is an automatic message.</p>
        </div>`;
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [to.email], subject, html, text: `${r.message}\n\n${link}` }),
        });
        if (res.ok) sent++;
        else console.error("[email] resend", res.status, (await res.text()).slice(0, 300));
      } catch (e) {
        console.error("[email] send failed", e);
      }
    })
  );
  return { sent };
}
