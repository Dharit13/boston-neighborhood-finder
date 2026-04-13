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
    <div className="rounded-xl border border-white/15 bg-white/10 backdrop-blur-xl p-6">
      <h2 className="text-lg font-bold text-white mb-4">Boston News</h2>

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
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.url}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white hover:text-blue-300 transition-colors block"
              >
                {item.title}
              </a>
              <div className="text-xs text-white mt-0.5">
                {item.source} · {relativeTime(item.publishedAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
