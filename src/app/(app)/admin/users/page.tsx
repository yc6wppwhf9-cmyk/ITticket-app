import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { ROLE_LABEL, type Profile } from "@/lib/types";
import { NewUserForm, UserRow } from "./user-forms";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/avatar";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const me = await requireRole("admin");
  const { q, role } = await searchParams;
  const supabase = await createClient();
  const [{ data: users }, { data: depts }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name", { nullsFirst: false }),
    supabase.from("departments").select("id, name, active").order("name"),
  ]);
  const term = (q ?? "").toLowerCase().trim();
  const list = ((users ?? []) as Profile[]).filter(
    (u) =>
      (!term || u.email.toLowerCase().includes(term) || (u.full_name ?? "").toLowerCase().includes(term)) &&
      (!role || u.role === role)
  );
  const departments = (depts ?? []) as { id: string; name: string; active: boolean }[];
  const counts = { requester: 0, agent: 0, admin: 0 };
  for (const u of (users ?? []) as Profile[]) if (u.active) counts[u.role]++;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        subtitle={`${counts.admin} IT admin · ${counts.agent} IT agents · ${counts.requester} requesters. People can also sign up themselves; they start as requesters.`}
      />

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Add a user</h2>
        <NewUserForm departments={departments.filter((d) => d.active)} />
      </section>

      <section className="card overflow-hidden">
        <form className="flex flex-wrap items-end gap-2 border-b border-slate-200 p-3" action="/admin/users">
          <input className="input max-w-xs" name="q" placeholder="Search name or email" defaultValue={q ?? ""} />
          <select className="input max-w-[12rem]" name="role" defaultValue={role ?? ""}>
            <option value="">All roles</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn" type="submit">Filter</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="th">Name</th>
                <th className="th">Joined</th>
                <th className="th">Department</th>
                <th className="th">Role</th>
                <th className="th">Status</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((u) => (
                <tr key={u.id} className={u.active ? "" : "bg-slate-50 text-slate-500"}>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.full_name || u.email} size={32} />
                      <div className="min-w-0">
                        <div className="font-semibold">{u.full_name ?? "—"}{u.id === me.id && <span className="ml-1 text-xs font-normal text-slate-400">(you)</span>}</div>
                        <div className="text-xs text-slate-500">{u.email}{u.phone ? ` · ${u.phone}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td whitespace-nowrap text-slate-500">{fmtDate(u.created_at)}</td>
                  <UserRow user={u} departments={departments} isMe={u.id === me.id} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
