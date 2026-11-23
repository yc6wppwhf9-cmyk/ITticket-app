import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/types";
import { personName } from "@/lib/format";
import { NewTicketForm } from "./new-ticket-form";
import { PageHeader } from "@/components/page-header";

export default async function NewTicketPage() {
  const me = await requireUser();
  const staff = isStaff(me.role);
  const supabase = await createClient();
  const [cats, people] = await Promise.all([
    supabase.from("categories").select("id, name, description").eq("active", true).order("sort_order"),
    staff
      ? supabase.from("profiles").select("id, full_name, email, role, departments(name)").eq("active", true).order("full_name")
      : Promise.resolve({ data: [] }),
  ]);
  type P = { id: string; full_name: string | null; email: string; role: string; departments: { name: string } | null };
  const all = (people.data ?? []) as unknown as P[];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        eyebrow="New request"
        title="Raise a ticket"
        subtitle="Tell IT what's wrong or what you need. You'll get a ticket number straight away and be notified at every update."
      />
      {!staff && !me.department_id && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your profile has no department. <a className="font-semibold underline" href="/profile">Set it</a> so your tickets are reported under the right one.
        </p>
      )}
      <NewTicketForm
        categories={(cats.data ?? []) as { id: string; name: string; description: string | null }[]}
        staff={staff}
        people={all.filter((p) => p.id !== me.id).map((p) => ({ id: p.id, name: `${personName(p)}${p.departments ? ` · ${p.departments.name}` : ""}` }))}
        agents={all.filter((p) => p.role !== "requester").map((p) => ({ id: p.id, name: personName(p) }))}
      />
    </div>
  );
}
