"use client";

import { useEffect, useState } from "react";
import type { ScoredNeighborhood, MbtaLine, UserInput } from "@/lib/types";
import { getRentAsPercentOfIncome } from "@/lib/budget";
import MbtaAlertsPanel from "./MbtaAlertsPanel";
import { useAiErrorState, formatResetAt } from "./useAiErrorState";

interface Props {
  scored: ScoredNeighborhood;
  userInput: UserInput;
  monthlyIncome: number;
  onClose: () => void;
}

const MBTA_COLORS: Record<MbtaLine, string> = {
  red: "#da291c",
  green: "#00843d",
  blue: "#003da5",
  orange: "#ed8b00",
  silver: "#7c878e",
  bus: "#f5b400",
  ferry: "#00b4d8",
};

const MBTA_LABELS: Record<MbtaLine, string> = {
  red: "Red Line",
  green: "Green Line",
  blue: "Blue Line",
  orange: "Orange Line",
  silver: "Silver Line",
  bus: "Bus",
  ferry: "Ferry",
};

const APT_SLUGS: Record<string, string> = {
  "back-bay": "back-bay-boston-ma",
  "beacon-hill": "beacon-hill-boston-ma",
  "south-end": "south-end-boston-boston-ma",
  "south-boston": "south-boston-ma",
  "seaport": "seaport-boston-ma",
  "east-boston": "east-boston-ma",
  "north-end": "north-end-boston-boston-ma",
  "charlestown": "charlestown-ma",
  "allston": "allston-ma",
  "brighton": "brighton-ma",
  "fenway-kenmore": "fenway-boston-ma",
  "mission-hill": "mission-hill-ma",
  "jamaica-plain": "jamaica-plain-ma",
  "roxbury": "roxbury-ma",
  "dorchester-north": "dorchester-ma",
  "dorchester-south": "dorchester-ma",
  "roslindale": "roslindale-ma",
  "hyde-park": "hyde-park-ma",
  "mattapan": "mattapan-ma",
  "west-roxbury": "west-roxbury-ma",
  "cambridge-harvard": "harvard-square-cambridge-ma",
  "cambridge-kendall": "kendall-square-cambridge-ma",
  "cambridge-central": "central-square-cambridge-ma",
  "cambridge-porter": "porter-square-cambridge-ma",
  "cambridge-inman": "inman-square-cambridge-ma",
  "somerville-davis": "davis-square-somerville-ma",
  "somerville-union": "union-square-somerville-ma",
  "somerville-assembly": "assembly-row-somerville-ma",
  "somerville-east": "east-somerville-somerville-ma",
  "brookline": "brookline-ma",
  "everett": "everett-ma",
  "malden": "malden-ma",
  "medford": "medford-ma",
  "chelsea": "chelsea-ma",
  "revere": "revere-ma",
  "quincy": "quincy-ma",
  "milton": "milton-ma",
  "watertown": "watertown-ma",
  "waltham": "waltham-ma",
  "newton": "newton-ma",
  "financial-district": "financial-district-boston-ma",
  "west-end": "west-end-boston-boston-ma",
  "downtown-crossing": "downtown-boston-boston-ma",
  "chinatown-leather-district": "chinatown-boston-ma",
};

function getRentalUrls(id: string, name: string, region: string): { zillow: string; apartments: string } {
  let city: string;
  let hood: string;

  const prefixMatch = name.match(/^(Cambridge|Somerville)\s*-\s*(.+)$/);
  if (prefixMatch) {
    city = prefixMatch[1];
    hood = prefixMatch[2];
  } else if (region !== "boston") {
    city = name;
    hood = "";
  } else {
    city = "Boston";
    hood = name;
  }

  const searchHood = hood
    .replace(/\s*\/\s*.*/g, "")
    .replace(/\s+(North|South)$/g, "");

  const slug = (s: string) => s.replace(/\s+/g, "-");

  const zillowPath = searchHood
    ? `${slug(searchHood)}-${slug(city)}-MA_rb`
    : `${slug(city)}-MA_rb`;

  const aptSlug = APT_SLUGS[id] ?? `${slug(name).toLowerCase()}-ma`;

  return {
    zillow: `https://www.zillow.com/homes/for_rent/${zillowPath}/`,
    apartments: `https://www.apartments.com/${aptSlug}/`,
  };
}

function budgetColor(percent: number): string {
  if (percent <= 45) return "text-emerald-400";
  if (percent <= 60) return "text-yellow-400";
  if (percent <= 80) return "text-amber-400";
  return "text-red-400";
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 70
      ? "bg-emerald-500"
      : score >= 50
      ? "bg-yellow-500"
      : "bg-red-400";
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-white">{label}</span>
        <span className="font-medium text-white">{score}/100</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export default function NeighborhoodProfile({
  scored,
  userInput,
  monthlyIncome,
  onClose,
}: Props) {
  const n = scored.neighborhood;
  const rentPercent = getRentAsPercentOfIncome(
    scored.perPersonRent,
    monthlyIncome
  );
  // Reset summary state when the selected neighborhood changes.
  // Adjusting state during render is React's recommended pattern
  // for deriving state from props — avoids the cascading renders
  // caused by resetting state inside useEffect.
  const [prevNeighborhoodId, setPrevNeighborhoodId] = useState(n.id);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const { error, setError, handleResponse, reauth } = useAiErrorState();
  if (prevNeighborhoodId !== n.id) {
    setPrevNeighborhoodId(n.id);
    setAiSummary(null);
    setAiLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            neighborhood: {
              name: n.name,
              region: n.region,
              description: n.description,
              perPersonRent: scored.perPersonRent,
              rentPercent,
              matchScore: scored.matchScore,
              safety: n.safety,
              safetyTrend: n.safetyTrend,
              walkScore: n.walkScore,
              transitScore: n.transitScore,
              communityScore: n.communityScore,
              mbtaLines: n.mbtaLines,
              commuteMinutes: scored.commuteMinutes,
              commuteRoute: scored.commuteRoute,
            },
            userPrefs: userInput,
          }),
        });
        const ok = await handleResponse(res);
        if (cancelled) return;
        if (ok) {
          const data = await res.json();
          if (!cancelled && data?.summary) setAiSummary(data.summary);
        }
      } catch {
        // network error — leave error state as null, stay silent
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally only depend on neighborhood id: we want to
    // refetch the summary when the user picks a different neighborhood,
    // not every time unrelated fields (userInput, scores) shift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.id]);

  return (
    <div className="rounded-xl border border-white/15 bg-white/10 backdrop-blur-xl p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{n.name}</h2>
          <p className="text-white mt-1">{n.description}</p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-white text-2xl leading-none"
        >
          &times;
        </button>
      </div>

      {/* Match Score */}
      <div className="mb-6 p-4 rounded-lg border border-blue-500 bg-blue-500/30">
        <div className="text-3xl font-bold text-white">
          {Math.round(scored.matchScore)}% Match
        </div>
      </div>

      {/* AI Summary */}
      {(aiLoading || aiSummary || error) && (
        <div className="mb-6 p-4 rounded-lg border border-purple-500 bg-purple-500/30">
          <h3 className="text-sm font-semibold text-white mb-1">
            Why this neighborhood for you
          </h3>
          {aiLoading ? (
            <p className="text-sm text-white animate-pulse">
              Generating personalized summary...
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
          ) : (
            <p className="text-sm text-white">{aiSummary}</p>
          )}
        </div>
      )}

      {/* Transit Details */}
      <div className="mb-6 space-y-3">
        <h3 className="font-semibold text-white">Transit</h3>
        {n.mbtaLines
          .filter((line) => line !== "bus" && line !== "ferry")
          .map((line) => {
            const stations = n.mbtaStations.filter((s) => s.line === line);
            return (
              <div key={line} className="flex items-start gap-2">
                <span
                  className="mt-1 w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: MBTA_COLORS[line] }}
                />
                <div>
                  <span className="text-sm font-medium text-white">
                    {MBTA_LABELS[line]}
                  </span>
                  {stations.length > 0 && (
                    <span className="text-sm text-white ml-1">
                      — {stations.map((s) => s.name).join(", ")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        {n.busRoutes.length > 0 && (
          <div className="flex items-start gap-2">
            <span
              className="mt-1 w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: MBTA_COLORS.bus }}
            />
            <div>
              <span className="text-sm font-medium text-white">Bus</span>
              <span className="text-sm text-white ml-1">
                — Routes {n.busRoutes.join(", ")}
              </span>
            </div>
          </div>
        )}
        {(() => {
          const ferryStops = n.mbtaStations.filter((s) => s.line === "ferry");
          if (ferryStops.length === 0) return null;
          return (
            <div className="flex items-start gap-2">
              <span
                className="mt-1 w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: MBTA_COLORS.ferry }}
              />
              <div>
                <span className="text-sm font-medium text-white">
                  {MBTA_LABELS.ferry}
                </span>
                <span className="text-sm text-white ml-1">
                  — {ferryStops.map((s) => s.name).join(", ")}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold text-white mb-2">Rent</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-white">Studio</span>
                <span className="text-white">
                  ${n.rent.studio[0].toLocaleString()} - $
                  {n.rent.studio[1].toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white">1 Bedroom</span>
                <span className="text-white">
                  ${n.rent.oneBr[0].toLocaleString()} - $
                  {n.rent.oneBr[1].toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white">2 Bedroom</span>
                <span className="text-white">
                  ${n.rent.twoBr[0].toLocaleString()} - $
                  {n.rent.twoBr[1].toLocaleString()}
                </span>
              </div>
            </div>
            <div className="mt-2 p-2 rounded bg-white/5 border border-white/10 text-sm">
              <span className="text-white">
                {userInput.livingArrangement === "own-room" ||
                userInput.livingArrangement === "shared-room"
                  ? "Your per-person cost: "
                  : "Your monthly rent: "}
              </span>
              <span className="font-bold text-white">
                ${scored.perPersonRent.toLocaleString()}/mo
              </span>
              <span className={`ml-2 font-medium ${budgetColor(rentPercent)}`}>
                ({rentPercent}% of income)
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <a
                href={getRentalUrls(n.id, n.name, n.region).zillow}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center px-3 py-2 rounded-lg bg-blue-600 border border-blue-500 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Zillow
              </a>
              <a
                href={getRentalUrls(n.id, n.name, n.region).apartments}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center px-3 py-2 rounded-lg bg-green-600 border border-green-500 text-white text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Apartments.com
              </a>
            </div>
          </div>

          {scored.commuteMinutes !== null && (
            <div>
              <h3 className="font-semibold text-white mb-2">Commute</h3>
              <div className="text-sm">
                <div className="text-2xl font-bold text-white">
                  {scored.commuteMinutes} min
                </div>
                {scored.commuteRoute && (
                  <div className="text-white mt-1">
                    via{" "}
                    {scored.commuteRoute.includes(" · ")
                      ? scored.commuteRoute.split(" · ")[0]
                      : scored.commuteRoute}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-white mb-2">Local Tips</h3>
            <p className="text-sm text-white">{n.localTips}</p>
          </div>
        </div>

        {/* Right column — scores */}
        <div className="space-y-4">
          <h3 className="font-semibold text-white">Scores</h3>
          <ScoreBar label="Safety" score={scored.scores.safety} />
          <ScoreBar label="Lifestyle Match" score={scored.scores.lifestyle} />
          <ScoreBar label="Community Vibe" score={scored.scores.community} />

          <div className="pt-2 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white">Walk Score</span>
              <span className="font-medium text-white">{n.walkScore}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white">Transit Score</span>
              <span className="font-medium text-white">{n.transitScore}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white">Bike Score</span>
              <span className="font-medium text-white">{n.bikeScore}</span>
            </div>
          </div>

          <div className="pt-2">
            <h4 className="text-sm font-medium text-white mb-1">
              Safety Trend
            </h4>
            <span
              className={`text-sm font-medium ${
                n.safetyTrend === "improving"
                  ? "text-emerald-400"
                  : n.safetyTrend === "declining"
                  ? "text-red-400"
                  : "text-white"
              }`}
            >
              {n.safetyTrend === "improving"
                ? "Improving"
                : n.safetyTrend === "declining"
                ? "Declining"
                : "Stable"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <MbtaAlertsPanel lines={n.mbtaLines} />
      </div>
    </div>
  );
}
