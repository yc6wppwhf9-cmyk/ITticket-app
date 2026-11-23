"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/types";

export type Result = { error?: string; ok?: string } | undefined;
const ROLES: AppRole[] = ["requester", "agent", "admin"];

export async function createUser(_: Result, fd: FormData): Promise<Result> {
  await requireRole("admin");
  const admin = createAdminClient();
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY is not set on the server, so users can't be created here. People can still sign up themselves." };

  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const fullName = String(fd.get("full_name") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const role = String(fd.get("role") ?? "requester") as AppRole;
  const departmentId = String(fd.get("department_id") ?? "") || null;
  if (!email || !fullName) return { error: "Name and email are required." };
  if (password.length < 8) return { error: "Temporary password must be at least 8 characters." };
  if (!ROLES.includes(role)) return { error: "Unknown role." };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, department_id: departmentId },
  });
  if (error || !data.user) return { error: error?.message ?? "Could not create the user." };

  // The sign-up trigger made the profile as a requester; set the real role
  // as the signed-in admin so the change goes through the normal guard.
  const supabase = await createClient();
  const { error: pErr } = await supabase
    .from("profiles")
    .update({ role, department_id: departmentId, full_name: fullName })
    .eq("id", data.user.id);
  if (pErr) return { error: `User created, but setting the role failed: ${pErr.message}` };

  revalidatePath("/admin/users");
  return { ok: `${fullName} can now sign in with ${email} and the temporary password.` };
}

export async function updateUser(fd: FormData): Promise<Result> {
  const me = await requireRole("admin");
  const id = String(fd.get("id") ?? "");
  const role = String(fd.get("role") ?? "") as AppRole;
  const departmentId = String(fd.get("department_id") ?? "") || null;
  const active = fd.get("active") === "true";
  if (!ROLES.includes(role)) return { error: "Unknown role." };
  if (id === me.id && (role !== "admin" || !active)) return { error: "You can't remove your own admin access." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role, department_id: departmentId, active }).eq("id", id);
  if (error) return { error: error.message };

  // Deactivation also stops them signing in at all, if the service key is set.
  const admin = createAdminClient();
  if (admin) await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });

  revalidatePath("/admin/users");
  return { ok: "Saved." };
}
