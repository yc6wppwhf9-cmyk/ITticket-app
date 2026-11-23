import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/lib/types";

export type Session = Profile & { departmentName: string | null };

/**
 * The signed-in user's id, from a verified JWT. Runs once per request.
 * Cheap: getClaims() checks the signature locally (see supabase/proxy.ts).
 */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
});

/** The signed-in person's profile, or null. Runs once per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const uid = await getUserId();
  if (!uid) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*, departments(name)")
    .eq("id", uid)
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
