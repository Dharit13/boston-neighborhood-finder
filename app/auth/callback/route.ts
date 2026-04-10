import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth return URL. Supabase redirects here after Google/GitHub consent
 * with ?code=<authorization_code>&next=<optional_return_path>.
 *
 * We exchange the code for a session (Supabase sets the cookie) and
 * redirect to `next` — validated to be a same-origin relative path to
 * prevent open-redirect attacks.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Open-redirect protection: only allow relative same-origin paths.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(
      new URL("/sign-in?error=missing_code", origin)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/sign-in?error=oauth_failed", origin)
    );
  }

  return NextResponse.redirect(new URL(safeNext, origin));
}
