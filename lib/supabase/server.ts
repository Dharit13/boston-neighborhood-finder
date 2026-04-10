import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

/**
 * Server-side Supabase client factory. Works in Server Components, Route
 * Handlers, and Middleware. Writing cookies is only legal in Route Handlers
 * and Server Actions — when called from a Server Component, the setAll
 * call will throw and we silently no-op (middleware will refresh on the
 * next request).
 *
 * NOTE: In Next.js 16, cookies() from next/headers is async and must be
 * awaited. This factory is therefore async.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component cannot set cookies — ignore.
          }
        },
      },
    }
  );
}

/**
 * Convenience wrapper: returns the authenticated user or null.
 * Use getUser() (not getSession()) because getUser() verifies the JWT
 * with the Supabase auth server — getSession() reads the cookie without
 * verifying, which is a security hole.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
