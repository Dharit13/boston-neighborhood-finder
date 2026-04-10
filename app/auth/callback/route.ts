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

/**
 * Parse `next` as a URL relative to a placeholder origin. Returns the
 * pathname+search+hash only if the resolved URL lands on the placeholder
 * (i.e. the input was actually a relative path). Anything that resolves
 * to a different host — including protocol-relative inputs (`//evil.com`)
 * and tab/newline-encoded escapes (`/\t//evil.com`) — falls back to "/".
 */
function safeRedirectPath(next: string): string {
  try {
    const placeholder = "https://placeholder.invalid";
    const url = new URL(next, placeholder);
    if (url.origin !== placeholder) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const safeNext = safeRedirectPath(next);

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
