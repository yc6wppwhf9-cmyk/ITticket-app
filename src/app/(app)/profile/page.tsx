import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/types";
import { SubmitButton } from "@/components/submit-button";

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
      <div>
        <h1 className="page-title">My profile</h1>
        <p className="muted">{me.email} · {ROLE_LABEL[me.role]}</p>
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
