import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getUser } from "@/lib/supabase/server";

export type RequireUserResult =
  | { user: User; response: null }
  | { user: null; response: NextResponse };

/**
 * API-route guard. Returns the authenticated user or a ready-to-return
 * 401 NextResponse. Usage:
 *
 *   const { user, response } = await requireUser();
 *   if (!user) return response;
 */
export async function requireUser(): Promise<RequireUserResult> {
  const user = await getUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
  return { user, response: null };
}
