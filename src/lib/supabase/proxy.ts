import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseUrl, supabaseAnonKey } from "@/lib/env";

const PUBLIC_PREFIXES = ["/login", "/signup", "/auth", "/forgot-password", "/reset-password"];

/** Refreshes the auth session and sends signed-out visitors to /login. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Prefetches render nothing a person sees; the real navigation that follows
  // is checked, and every page checks again before returning data.
  if (request.headers.get("next-router-prefetch") === "1") return response;

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Do not run code between createServerClient and the auth check.
  // getClaims() verifies the JWT signature locally against the project's
  // published keys (cached), instead of a round trip to Supabase Auth on
  // every click. On projects still using a shared secret it falls back to
  // the network check, so it is never slower than getUser().
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  const path = request.nextUrl.pathname;
  if (!user && !PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (path !== "/") url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return response;
}
