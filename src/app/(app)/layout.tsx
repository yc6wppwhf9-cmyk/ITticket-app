import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me.id)
    .is("read_at", null);

  return (
    <AppNav
      me={{ name: me.full_name || me.email.split("@")[0], email: me.email, role: me.role, department: me.departmentName }}
      unread={count ?? 0}
    >
      {children}
    </AppNav>
  );
}
