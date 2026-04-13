"use client";

import { useEffect, useState } from "react";
import type { MbtaAlert, MbtaLine } from "@/lib/types";

interface Props {
  lines: MbtaLine[];
}

type Status = "loading" | "ok" | "empty" | "error";

const LINE_BADGE_COLORS: Record<MbtaLine, string> = {
  red: "bg-red-600",
  orange: "bg-orange-500",
  blue: "bg-blue-600",
  green: "bg-green-600",
  silver: "bg-gray-500",
  bus: "bg-yellow-600",
  ferry: "bg-cyan-600",
};

const LINE_LABELS: Record<MbtaLine, string> = {
  red: "Red",
  orange: "Orange",
  blue: "Blue",
  green: "Green",
  silver: "Silver",
  bus: "Bus",
  ferry: "Ferry",
};

function effectLabel(effect: string): string {
  return effect
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function MbtaAlertsPanel({ lines }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [alerts, setAlerts] = useState<MbtaAlert[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Only render for queryable lines (skip bus/ferry-only neighborhoods)
  const queryableLines = lines.filter(
    (l) => l !== "bus" && l !== "ferry"
  );

  useEffect(() => {
    if (queryableLines.length === 0) return;

    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const res = await fetch(
          `/api/mbta-alerts?lines=${queryableLines.join(",")}`
        );
        const body = await res.json();
        if (cancelled) return;
        if (body && typeof body === "object" && "error" in body) {
          setStatus("error");
          return;
        }
        if (Array.isArray(body) && body.length > 0) {
          setAlerts(body);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryableLines.join(",")]);

  if (queryableLines.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/15 bg-white/10 p-4">
      <h3 className="text-sm font-bold text-white mb-3">MBTA Service Alerts</h3>

      {status === "loading" && (
        <p className="text-xs text-white">Checking alerts…</p>
      )}

      {status === "empty" && (
        <p className="text-xs text-emerald-400">
          No service-impacting alerts right now ✓
        </p>
      )}

      {status === "error" && (
        <p className="text-xs text-white">
          Couldn&apos;t load alerts right now.
        </p>
      )}

      {status === "ok" && (
        <ul className="space-y-3">
          {alerts.map((alert) => {
            const isExpanded = expandedId === alert.id;
            const truncated =
              alert.description.length > 140 && !isExpanded
                ? alert.description.slice(0, 140).trimEnd() + "…"
                : alert.description;
            return (
              <li
                key={alert.id}
                className="border-l-2 border-white/20 pl-3"
              >
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  {alert.routes.map((route) => (
                    <span
                      key={route}
                      className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded ${LINE_BADGE_COLORS[route]}`}
                    >
                      {LINE_LABELS[route]}
                    </span>
                  ))}
                  <span className="text-[10px] text-white uppercase tracking-wide">
                    {effectLabel(alert.effect)}
                  </span>
                </div>
                <div className="text-xs font-medium text-white">
                  {alert.header}
                </div>
                <div className="text-xs text-white mt-0.5">
                  {truncated}
                  {alert.description.length > 140 && (
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : alert.id)
                      }
                      className="ml-1 text-blue-300 hover:underline"
                    >
                      {isExpanded ? "less" : "more"}
                    </button>
                  )}
                </div>
                {alert.url && (
                  <a
                    href={alert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-300 hover:underline mt-1 inline-block"
                  >
                    View on mbta.com →
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
