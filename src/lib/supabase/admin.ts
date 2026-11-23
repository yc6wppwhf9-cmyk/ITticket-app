import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cleanEnv, supabaseUrl } from "@/lib/env";

/**
 * Service-role client. It bypasses row-level security, so it is used for
 * exactly two things: managing auth users (admin screen) and the email
 * outbox. Never hand its results to a page without checking the caller.
 */
export function createAdminClient() {
  const key = cleanEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (!key) return null;
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
