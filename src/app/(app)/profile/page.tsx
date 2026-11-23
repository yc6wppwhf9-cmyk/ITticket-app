import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/types";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/avatar";

async function saveProfile(fd: FormData) {
  "use server";
  const me = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({
      full_name: String(fd.get("full_name") ?? "").trim() || null,
      phone: String(fd.get("phone") ?? "").trim() || null,
      department_id: String(fd.get("department_id") ?? "") || null,
    })
    .eq("id", me.id);
  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const me = await requireUser();
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data: depts } = await supabase.from("departments").select("id, name, active").order("name");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="My profile" />
      <div className="card flex items-center gap-4 p-5">
        <Avatar name={me.full_name || me.email} size={56} />
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{me.full_name || me.email.split("@")[0]}</div>
          <div className="truncate text-sm text-slate-500">{me.email}</div>
          <span className="mt-1 inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">{ROLE_LABEL[me.role]}</span>
        </div>
      </div>
      {saved && <p className="alert-ok">Profile saved.</p>}
      <form action={saveProfile} className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="full_name">Full name</label>
          <input className="input" id="full_name" name="full_name" defaultValue={me.full_name ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="department_id">Department</label>
          <select className="input" id="department_id" name="department_id" defaultValue={me.department_id ?? ""}>
            <option value="">— Not set —</option>
            {(depts ?? []).filter((d) => d.active || d.id === me.department_id).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">New tickets are reported under this department. Existing tickets keep theirs.</p>
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone / extension</label>
          <input className="input" id="phone" name="phone" defaultValue={me.phone ?? ""} />
        </div>
        <div className="flex justify-between">
          <a href="/reset-password" className="btn">Change password</a>
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </div>
      </form>
    </div>
  );
}
