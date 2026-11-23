"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseAnonKey } from "@/lib/env";

/** Supabase client for Client Components. Used for direct file uploads. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
