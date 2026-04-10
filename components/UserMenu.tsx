"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  email: string;
  avatarUrl: string | null;
}

export default function UserMenu({ email, avatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (
        menuRef.current &&
        e.target instanceof Node &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[UserMenu] signOut failed", err);
    }
    // Hard navigation: guarantees the browser re-requests /sign-in with the
    // (now cleared) Supabase cookies and the proxy re-evaluates from scratch.
    // router.push can race the cookie clear and bounce the user back to /.
    window.location.href = "/sign-in";
  };

  const initial = (email.charAt(0) || "?").toUpperCase();

  return (
    <div ref={menuRef} className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-full border border-white/15 bg-white/10 backdrop-blur-xl text-white text-sm font-semibold overflow-hidden hover:bg-white/20 hover:border-white/25 transition-all shadow-lg shadow-black/20 flex items-center justify-center"
        aria-label="User menu"
        aria-expanded={open}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-[11px] uppercase tracking-wider text-white/50">
              Signed in as
            </p>
            <p className="text-sm text-white truncate mt-0.5">{email}</p>
          </div>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2.5 disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 text-white/70"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
