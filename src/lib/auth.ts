import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/lib/types";

export type Session = Profile & { departmentName: string | null };

/** The signed-in person's profile, or null. Runs once per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*, departments(name)")
    .eq("id", user.id)
    .single();
  if (!data) return null;
  const { departments, ...profile } = data as Profile & { departments: { name: string } | null };
  return { ...profile, departmentName: departments?.name ?? null };
});

export async function requireUser(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.active) redirect("/login?error=inactive");
  return s;
}

/** Admins always pass. */
export async function requireRole(...roles: AppRole[]): Promise<Session> {
  const s = await requireUser();
  if (s.role !== "admin" && !roles.includes(s.role)) redirect("/tickets");
  return s;
}
