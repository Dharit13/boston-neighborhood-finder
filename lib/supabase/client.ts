import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client factory. Use in Client Components that
 * need to call auth methods (signInWithOAuth, signOut). Session cookie
 * is httpOnly and set by the server; the browser client reads session
 * state via the Supabase endpoint, not via direct cookie access.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
