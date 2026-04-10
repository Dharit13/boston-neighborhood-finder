"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "github";

export default function SignInButtons() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [loading, setLoading] = useState<Provider | null>(null);

  const signIn = async (provider: Provider) => {
    setLoading(provider);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setLoading(null);
      window.location.href = "/sign-in?error=oauth_failed";
    }
    // On success, the browser is redirecting — no need to clear loading.
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => signIn("google")}
        disabled={loading !== null}
        className="w-full px-5 py-3 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {loading === "google" ? "Redirecting…" : "Continue with Google"}
      </button>
      <button
        onClick={() => signIn("github")}
        disabled={loading !== null}
        className="w-full px-5 py-3 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-white/15 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
      </button>
    </div>
  );
}
