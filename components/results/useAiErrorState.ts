"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";

export type AiErrorState =
  | { kind: "unauthorized" }
  | { kind: "rateLimited"; resetAt: number | null }
  | { kind: "other"; message: string }
  | null;

/**
 * Shared helper for the three AI-consuming client components. Call
 * handleResponse(res) with a fetch Response — returns true if OK and
 * the caller should continue, false if an error state was set.
 */
export function useAiErrorState() {
  const router = useRouter();
  const [error, setError] = useState<AiErrorState>(null);

  const handleResponse = useCallback(async (res: Response): Promise<boolean> => {
    if (res.ok) {
      setError(null);
      return true;
    }
    if (res.status === 401) {
      setError({ kind: "unauthorized" });
      return false;
    }
    if (res.status === 429) {
      try {
        const body = await res.clone().json();
        setError({
          kind: "rateLimited",
          resetAt: typeof body?.resetAt === "number" ? body.resetAt : null,
        });
      } catch {
        setError({ kind: "rateLimited", resetAt: null });
      }
      return false;
    }
    setError({ kind: "other", message: `Error ${res.status}` });
    return false;
  }, []);

  const reauth = useCallback(() => {
    const currentPath = window.location.pathname + window.location.search;
    router.push(`/sign-in?next=${encodeURIComponent(currentPath)}`);
  }, [router]);

  return { error, setError, handleResponse, reauth };
}

/**
 * Render a short human message for a given rate-limit reset timestamp.
 */
export function formatResetAt(resetAt: number | null): string {
  if (resetAt === null) return "Try again later.";
  const minutes = Math.max(1, Math.ceil((resetAt - Date.now()) / 60_000));
  return `Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
