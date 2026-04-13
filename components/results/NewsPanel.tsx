"use client";

import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/types";

type Status = "loading" | "ok" | "empty" | "error";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function NewsPanel() {
  const [status, setStatus] = useState<Status>("loading");
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/news");
        const body = await res.json();
        if (cancelled) return;
        if (body && typeof body === "object" && "error" in body) {
          setStatus("error");
          return;
        }
        if (Array.isArray(body) && body.length > 0) {
          setItems(body);
          setStatus("ok");
        } else {
          setStatus("empty");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 backdrop-blur-xl p-6">
      <h2 className="text-lg font-bold text-sky-300 mb-4 flex items-center gap-2">
        <span>📰</span> Boston News
      </h2>

      {status === "loading" && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 bg-white/10 rounded animate-pulse" />
          ))}
        </div>
      )}

      {status === "empty" && (
        <p className="text-sm text-white">No recent Boston headlines.</p>
      )}

      {status === "error" && (
        <p className="text-sm text-white">Couldn&apos;t load news right now.</p>
      )}

      {status === "ok" && (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.url}
              className="p-3 rounded-lg hover:bg-white/5 transition-colors"
            >
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5"
              >
                <span className="text-sky-400 mt-0.5 flex-shrink-0">▸</span>
                <div>
                  <span className="text-sm text-white hover:text-sky-300 transition-colors">
                    {item.title}
                  </span>
                  <div className="text-xs text-white/70 mt-1">
                    {item.source} · {relativeTime(item.publishedAt)}
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
