import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 proxy (formerly middleware) — enforces the auth gate on every
 * request.
 *
 * NOTE: In Next.js 16, the file convention was renamed from `middleware.ts`
 * to `proxy.ts` and the exported function from `middleware` to `proxy`.
 * The old `middleware.ts` file is deprecated and emits a warning at startup.
 *
 * Decision tree (order matters):
 *   1. Path starts with /api/         → refresh cookie, pass through (route handles 401)
 *   2. Path is /auth/callback          → always allow
 *   3. Path is /sign-in                → redirect to / if authed, else allow
 *   4. Any other path                  → redirect to /sign-in?next=<path> if unauthed, else allow
 *
 * We must call supabase.auth.getUser() on every request to refresh the
 * session cookie; without it, sessions expire silently.
 *
 * NOTE: NextResponse.next() in Next.js 16 accepts MiddlewareResponseInit
 * where `request` is typed as { headers?: Headers } — NOT a full NextRequest.
 * We propagate updated cookies via request.cookies.set() (the RequestCookies
 * API), which mutates the underlying Cookie header correctly for multiple
 * chunked values, then pass request.headers into NextResponse.next so Server
 * Components see the refreshed session on the same request.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Tag the request headers so the root layout can read pathname via headers().
  request.headers.set("x-pathname", pathname);

  // Create a mutable response we can attach cookie updates to.
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mutate request.cookies — NextRequest's RequestCookies API updates
          // the underlying Cookie header correctly for multiple values.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Re-create the response with the (now-mutated) request headers so
          // Server Components see the refreshed session on this same request.
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          // Persist to the browser via Set-Cookie.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. API routes: never redirect — return response with cookie refresh only.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  // 2. OAuth callback: always allow.
  if (pathname === "/auth/callback") {
    return response;
  }

  // 3. Sign-in page: redirect authenticated users to /.
  if (pathname === "/sign-in") {
    if (user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  // 4. Everything else: require auth.
  if (!user) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Run proxy on everything except Next.js internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
