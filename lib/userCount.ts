import { createClient } from "@/lib/supabase/server";

/**
 * Fetch the total number of registered users via the `get_total_users`
 * SECURITY DEFINER function. Returns null on any error (RPC failure,
 * network failure, or missing migration) so the caller can degrade
 * gracefully — we never surface auth errors to the user.
 */
export async function getTotalUserCount(): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_total_users");
    if (error || typeof data !== "number") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Apply the 0/1/2+ rendering rules from the spec. Returns the rendered
 * string, or null if the counter should be hidden entirely.
 */
export function renderUserCountLabel(count: number | null): string | null {
  if (count === null || count <= 0) return null;
  if (count === 1) return "Be the second to find your neighborhood";
  return `Join ${count} others finding their neighborhood`;
}
