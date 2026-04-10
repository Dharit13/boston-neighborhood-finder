"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  email: string;
  avatarUrl: string | null;
}

export default function UserMenu({ email, avatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  const initial = email.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm text-white text-xs font-semibold overflow-hidden hover:bg-white/20 transition-all"
        aria-label="User menu"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-[11px] text-white/50">Signed in as</p>
            <p className="text-sm text-white truncate">{email}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
