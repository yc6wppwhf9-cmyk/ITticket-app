"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type Result = { error?: string; ok?: string } | undefined;

function friendly(msg: string): string {
  return msg.includes("duplicate key") ? "That name already exists." : msg;
}

export async function addDepartment(_: Result, fd: FormData): Promise<Result> {
  await requireRole("admin");
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Enter a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("departments").insert({ name });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/admin/masters");
  return { ok: `Added ${name}.` };
}

export async function saveDepartment(fd: FormData): Promise<Result> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .update({ name: String(fd.get("name") ?? "").trim(), active: fd.get("active") === "true" })
    .eq("id", String(fd.get("id")));
  if (error) return { error: friendly(error.message) };
  revalidatePath("/admin/masters");
  return { ok: "Saved." };
}

export async function addCategory(_: Result, fd: FormData): Promise<Result> {
  await requireRole("admin");
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Enter a name." };
  const supabase = await createClient();
  const { data: last } = await supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("categories").insert({
    name,
    description: String(fd.get("description") ?? "").trim() || null,
    sort_order: (last?.[0]?.sort_order ?? 0) + 10,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/admin/masters");
  return { ok: `Added ${name}.` };
}

export async function saveCategory(fd: FormData): Promise<Result> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name: String(fd.get("name") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim() || null,
      default_assignee_id: String(fd.get("default_assignee_id") ?? "") || null,
      sort_order: Number(fd.get("sort_order")) || 100,
      active: fd.get("active") === "true",
    })
    .eq("id", String(fd.get("id")));
  if (error) return { error: friendly(error.message) };
  revalidatePath("/admin/masters");
  return { ok: "Saved." };
}
