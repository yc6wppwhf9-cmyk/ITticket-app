import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import type { Notification } from "@/lib/types";

const KIND_DOT: Record<string, string> = {
  created: "bg-sky-500",
  assigned: "bg-indigo-600",
  status: "bg-emerald-500",
  comment: "bg-violet-500",
  note: "bg-amber-400",
};

async function markAllRead() {
  "use server";
  const me = await requireUser();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me.id).is("read_at", null);
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const me = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as Notification[];
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="muted">{unread ? `${unread} unread` : "You're all caught up."}</p>
        </div>
        {unread > 0 && (
          <form action={markAllRead}>
            <button className="btn btn-sm" type="submit">Mark all as read</button>
          </form>
        )}
      </div>
      <div className="card divide-y divide-slate-100 overflow-hidden">
        {rows.length === 0 && <p className="px-5 py-12 text-center text-sm text-slate-500">No notifications yet.</p>}
        {rows.map((n) => (
          <Link
            key={n.id}
            href={n.ticket_id ? `/tickets/${n.ticket_id}` : "/tickets"}
            className={`flex gap-3 px-4 py-3 hover:bg-indigo-50/50 ${n.read_at ? "" : "bg-indigo-50/30"}`}
          >
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.read_at ? "bg-slate-300" : KIND_DOT[n.kind] ?? "bg-indigo-500"}`} />
            <div className="min-w-0">
              <p className={`text-sm break-words ${n.read_at ? "text-slate-600" : "font-semibold text-slate-900"}`}>{n.message}</p>
              <p className="text-xs text-slate-400">{fmtDateTime(n.created_at)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
