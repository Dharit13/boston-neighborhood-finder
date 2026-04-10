"use client";

import { useEffect, useState } from "react";
import type { TieredRecommendation, UserInput } from "@/lib/types";

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

    fetch("/api/ai-overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recommendations: recData,
        userPrefs: userInput,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.overview) setOverview(data.overview);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [recommendations, userInput]);

  if (recommendations.length === 0) return null;
  if (!loading && !overview) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
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
          ) : (
            <p className="text-sm text-white leading-relaxed">
              {overview?.replace(/\*\*/g, "")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
