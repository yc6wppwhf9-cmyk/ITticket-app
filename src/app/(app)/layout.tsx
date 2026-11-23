import { getUserId, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The profile and the unread count are independent, so fetch them together
  // rather than one after the other.
  const uid = await getUserId();
  const supabase = await createClient();
  const [me, { count }] = await Promise.all([
    requireUser(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid ?? "")
      .is("read_at", null),
  ]);

  return (
    <AppNav
      me={{ name: me.full_name || me.email.split("@")[0], email: me.email, role: me.role, department: me.departmentName }}
      unread={count ?? 0}
    >
      {children}
    </AppNav>
  );
}
