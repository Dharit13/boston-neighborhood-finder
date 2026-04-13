"use client";

import { useEffect, useState } from "react";
import type { TieredRecommendation, UserInput } from "@/lib/types";
import { useAiErrorState, formatResetAt } from "./useAiErrorState";

interface Props {
  recommendations: TieredRecommendation[];
  userInput: UserInput;
}

export default function RecommendationOverview({
  recommendations,
  userInput,
}: Props) {
  const [overview, setOverview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { error, handleResponse, reauth } = useAiErrorState();

  // Derive a stable key from the recommendation IDs so we only refetch
  // when the actual neighborhoods change, not on every parent re-render.
  const recKey = recommendations
    .map((r) => r.neighborhood.neighborhood.id)
    .join(",");

  useEffect(() => {
    if (recommendations.length === 0) return;

    let cancelled = false;

    const recData = recommendations.map((rec) => ({
      name: rec.neighborhood.neighborhood.name,
      label: rec.label,
      matchScore: Math.round(rec.neighborhood.matchScore),
      perPersonRent: rec.neighborhood.perPersonRent,
      rentPercent: rec.neighborhood.rentPercent,
      commuteMinutes: rec.neighborhood.commuteMinutes,
      commuteRoute: rec.neighborhood.commuteRoute,
      safety: rec.neighborhood.neighborhood.safety,
      walkScore: rec.neighborhood.neighborhood.walkScore,
      mbtaLines: rec.neighborhood.neighborhood.mbtaLines,
      stations: rec.neighborhood.neighborhood.mbtaStations
        .map((s) => s.name)
        .join(", "),
      description: rec.neighborhood.neighborhood.description,
    }));

    (async () => {
      try {
        const res = await fetch("/api/ai-overview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recommendations: recData,
            userPrefs: userInput,
          }),
        });
        const ok = await handleResponse(res);
        if (cancelled) return;
        if (ok) {
          const data = await res.json();
          if (!cancelled && data?.overview) setOverview(data.overview);
        }
      } catch {
        // network error — leave error state as null, stay silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recKey]);

  if (recommendations.length === 0) return null;
  if (!loading && !overview && !error) return null;

  return (
    <div className="rounded-xl border border-white/15 bg-white/10 backdrop-blur-xl p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🏘️</span>
        <div>
          <h2 className="text-base font-semibold text-white mb-1">
            Why These Neighborhoods?
          </h2>
          {loading ? (
            <p className="text-sm text-white animate-pulse">
              Analyzing your top picks...
            </p>
          ) : error?.kind === "unauthorized" ? (
            <div className="px-4 py-2 bg-red-500/30 border border-red-500 text-red-200 text-xs rounded-lg">
              Your session expired.{" "}
              <button onClick={reauth} className="underline">Sign in again</button>
            </div>
          ) : error?.kind === "rateLimited" ? (
            <div className="px-4 py-2 bg-amber-500/30 border border-amber-500 text-amber-200 text-xs rounded-lg">
              You&apos;ve used all 20 of your hourly AI requests. {formatResetAt(error.resetAt)}
            </div>
          ) : (() => {
            const lines = (overview ?? "")
              .replace(/\*\*/g, "")
              .split(/\n/)
              .map((l) => l.trim())
              .filter((l) => l.length > 0);
            const intro = lines.filter((l) => !l.startsWith("- "));
            const bullets = lines
              .filter((l) => l.startsWith("- "))
              .map((l) => l.replace(/^-\s*/, ""));
            return (
              <div className="space-y-3">
                {intro.length > 0 && (
                  <p className="text-sm text-white leading-relaxed">
                    {intro.join(" ")}
                  </p>
                )}
                {bullets.length > 0 && (
                  <ul className="space-y-2">
                    {bullets.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white leading-relaxed">
                        <span className="text-blue-300 mt-0.5 flex-shrink-0">▸</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
