import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { personName } from "@/lib/format";
import { AddForm, CategoryRow, DepartmentRow } from "./forms";
import { PageHeader } from "@/components/page-header";

export default async function MastersPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: depts }, { data: cats }, { data: agents }] = await Promise.all([
    supabase.from("departments").select("id, name, active").order("name"),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("profiles").select("id, full_name, email").in("role", ["agent", "admin"]).eq("active", true).order("full_name"),
  ]);
  const agentOpts = ((agents ?? []) as { id: string; full_name: string | null; email: string }[]).map((a) => ({ id: a.id, name: personName(a) }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Departments & categories"
        subtitle="Inactive entries are hidden from new tickets but kept on old ones, so history and reports stay intact."
      />

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <h2 className="mb-1 font-semibold">Ticket categories</h2>
          <p className="mb-3 text-xs text-slate-500">Set an auto-assign person and new tickets in that category go straight to them, with no manual triage.</p>
          <AddForm kind="category" />
        </div>
        <div className="divide-y divide-slate-100">
          {(cats ?? []).map((c) => <CategoryRow key={c.id} c={c} agents={agentOpts} />)}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <h2 className="mb-3 font-semibold">Departments</h2>
          <AddForm kind="department" />
        </div>
        <div className="divide-y divide-slate-100">
          {(depts ?? []).length === 0 && <p className="px-4 py-6 text-sm text-slate-500">No departments yet. Add them above before people sign up.</p>}
          {(depts ?? []).map((d) => <DepartmentRow key={d.id} d={d} />)}
        </div>
      </section>
    </div>
  );
}
