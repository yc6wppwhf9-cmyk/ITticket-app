import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Landing point for the sign-up confirmation and password-reset emails. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/tickets";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/tickets";

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }
  const url = request.nextUrl.clone();
  url.search = "";
  url.pathname = ok ? next : "/login";
  if (!ok) url.searchParams.set("error", "link");
  return NextResponse.redirect(url);
}
