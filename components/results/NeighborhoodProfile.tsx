"use client";

import { useEffect, useState } from "react";
import type { ScoredNeighborhood, MbtaLine, UserInput } from "@/lib/types";
import { getRentAsPercentOfIncome } from "@/lib/budget";

interface Props {
  scored: ScoredNeighborhood;
  userInput: UserInput;
  monthlyIncome: number;
  roommates: number;
  onClose: () => void;
}

const MBTA_COLORS: Record<MbtaLine, string> = {
  red: "bg-red-500",
  green: "bg-green-600",
  blue: "bg-blue-600",
  orange: "bg-orange-500",
  silver: "bg-gray-400",
  bus: "bg-yellow-500",
  ferry: "bg-cyan-500",
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

function budgetColor(percent: number): string {
  if (percent <= 45) return "text-green-600";
  if (percent <= 60) return "text-yellow-600";
  if (percent <= 80) return "text-orange-600";
  return "text-red-600";
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 70 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium">{score}/100</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full">
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
  roommates,
  onClose,
}: Props) {
  const n = scored.neighborhood;
  const rentPercent = getRentAsPercentOfIncome(scored.perPersonRent, monthlyIncome);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    setAiSummary(null);
    setAiLoading(true);
    fetch("/api/ai-summary", {
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
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.summary) setAiSummary(data.summary);
      })
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [scored.neighborhood.id]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{n.name}</h2>
          <p className="text-gray-600 mt-1">{n.description}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          &times;
        </button>
      </div>

      {/* Match Score */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="text-3xl font-bold text-blue-700">
          {Math.round(scored.matchScore)}% Match
        </div>
      </div>

      {/* AI Summary */}
      {(aiLoading || aiSummary) && (
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="text-sm font-semibold text-purple-800 mb-1">
            Why this neighborhood for you
          </h3>
          {aiLoading ? (
            <p className="text-sm text-purple-600 animate-pulse">
              Generating personalized summary...
            </p>
          ) : (
            <p className="text-sm text-purple-900">{aiSummary}</p>
          )}
        </div>
      )}

      {/* MBTA Lines */}
      <div className="flex flex-wrap gap-2 mb-6">
        {n.mbtaLines.map((line) => (
          <span
            key={line}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-sm"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${MBTA_COLORS[line]}`} />
            {MBTA_LABELS[line]}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Rent Breakdown */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Rent</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Studio</span>
                <span>${n.rent.studio[0].toLocaleString()} - ${n.rent.studio[1].toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>1 Bedroom</span>
                <span>${n.rent.oneBr[0].toLocaleString()} - ${n.rent.oneBr[1].toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>2 Bedroom</span>
                <span>${n.rent.twoBr[0].toLocaleString()} - ${n.rent.twoBr[1].toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>3 Bedroom</span>
                <span>${n.rent.threeBr[0].toLocaleString()} - ${n.rent.threeBr[1].toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
              <span>Your per-person cost: </span>
              <span className="font-bold">
                ${scored.perPersonRent.toLocaleString()}/mo
              </span>
              <span className={`ml-2 font-medium ${budgetColor(rentPercent)}`}>
                ({rentPercent}% of income)
              </span>
            </div>
          </div>

          {/* Commute */}
          {scored.commuteMinutes !== null && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Commute</h3>
              <div className="text-sm">
                <div className="text-2xl font-bold text-gray-900">
                  {scored.commuteMinutes} min
                </div>
                {scored.commuteRoute && (
                  <div className="text-gray-600 mt-1">
                    via {scored.commuteRoute}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Local Tips */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Local Tips</h3>
            <p className="text-sm text-gray-700">{n.localTips}</p>
          </div>
        </div>

        {/* Right column — scores */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Scores</h3>
          <ScoreBar label="Safety" score={scored.scores.safety} />
          <ScoreBar label="Lifestyle Match" score={scored.scores.lifestyle} />
          <ScoreBar label="Community Vibe" score={scored.scores.community} />

          <div className="pt-2 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Walk Score</span>
              <span className="font-medium">{n.walkScore}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Transit Score</span>
              <span className="font-medium">{n.transitScore}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Bike Score</span>
              <span className="font-medium">{n.bikeScore}</span>
            </div>
          </div>

          <div className="pt-2">
            <h4 className="text-sm font-medium text-gray-700 mb-1">
              Safety Trend
            </h4>
            <span
              className={`text-sm font-medium ${
                n.safetyTrend === "improving"
                  ? "text-green-600"
                  : n.safetyTrend === "declining"
                  ? "text-red-600"
                  : "text-gray-600"
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
    </div>
  );
}
