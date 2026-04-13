"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Neighborhood } from "@/lib/types";
import { computeDashboardData, type DashboardData } from "@/lib/dashboardData";


const MBTA_COLORS: Record<string, string> = {
  red: "bg-red-600",
  orange: "bg-orange-600",
  green: "bg-green-600",
  blue: "bg-blue-600",
  silver: "bg-purple-600",
  bus: "bg-yellow-600",
  ferry: "bg-cyan-600",
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);

  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/data/neighborhoods.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((neighborhoods: Neighborhood[]) => {
        setData(computeDashboardData(neighborhoods));
      })
      .catch((err) => {
        console.error("Failed to load neighborhood data:", err);
        setError(true);
      });
  }, []);

  if (error) {
    return (
      <main className="relative min-h-screen bg-black flex items-center justify-center overflow-hidden">
        <img src="/images/boston-dusk.jpg" alt="" className="fixed inset-0 w-full h-full object-cover z-0 opacity-40" />
        <p className="relative z-10 text-red-400">Failed to load neighborhood data.</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="relative min-h-screen bg-black flex items-center justify-center overflow-hidden">
        <img src="/images/boston-dusk.jpg" alt="" className="fixed inset-0 w-full h-full object-cover z-0 opacity-40" />
        <p className="relative z-10 text-white/60 animate-pulse">Loading dashboard...</p>
      </main>
    );
  }

  const maxRent = data.rentLeaderboard.mostExpensive[0]?.rent ?? 1;

  return (
    <main className="relative min-h-screen bg-black overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/boston-dusk.jpg"
        alt=""
        className="fixed inset-0 w-full h-full object-cover z-0 opacity-40"
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
        >
          ← Back
        </button>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            Boston Neighborhoods at a Glance
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            44 neighborhoods compared across rent, safety, transit, and lifestyle
          </p>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-red-500/30 bg-red-500/15 backdrop-blur-xl p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-red-300">Most Expensive</p>
            <p className="text-xl font-bold text-white mt-1">${data.heroStats.mostExpensive.rent.toLocaleString()}/mo</p>
            <p className="text-sm text-slate-400 mt-0.5">{data.heroStats.mostExpensive.name} (1BR)</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 backdrop-blur-xl p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-emerald-300">Safest</p>
            <p className="text-xl font-bold text-white mt-1">{data.heroStats.safest.safety} / 100</p>
            <p className="text-sm text-slate-400 mt-0.5">{data.heroStats.safest.name}</p>
          </div>
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/15 backdrop-blur-xl p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-blue-300">Best Transit</p>
            <p className="text-xl font-bold text-white mt-1">Score: {data.heroStats.bestTransit.transitScore}</p>
            <p className="text-sm text-slate-400 mt-0.5">{data.heroStats.bestTransit.name}</p>
          </div>
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/15 backdrop-blur-xl p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-purple-300">Best Value</p>
            <p className="text-xl font-bold text-white mt-1">Score: {data.heroStats.bestValue.valueScore}</p>
            <p className="text-sm text-slate-400 mt-0.5">{data.heroStats.bestValue.name}</p>
          </div>
        </div>

        {/* Rent Leaderboard */}
        <section className="rounded-xl border border-white/15 bg-white/10 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🏠</span>
            <h2 className="text-base font-semibold text-white">Rent Leaderboard</h2>
            <span className="text-slate-500 text-xs ml-auto">1BR median rent</span>
          </div>

          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-red-400 mb-2">Most Expensive</p>
            <div className="space-y-2">
              {data.rentLeaderboard.mostExpensive.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-4">{i + 1}.</span>
                  <span className="text-sm text-white flex-1 min-w-0 truncate">{entry.name}</span>
                  <div className="w-28 sm:w-36 h-2 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${(entry.rent / maxRent) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-red-400 w-16 text-right flex-shrink-0">
                    ${entry.rent.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-emerald-400 mb-2">Most Affordable</p>
            <div className="space-y-2">
              {data.rentLeaderboard.mostAffordable.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-4">{i + 1}.</span>
                  <span className="text-sm text-white flex-1 min-w-0 truncate">{entry.name}</span>
                  <div className="w-28 sm:w-36 h-2 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${(entry.rent / maxRent) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-emerald-400 w-16 text-right flex-shrink-0">
                    ${entry.rent.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Best Value for Money */}
        <section className="rounded-xl border border-white/15 bg-white/10 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">💰</span>
            <h2 className="text-base font-semibold text-white">Best Value for Money</h2>
          </div>
          <p className="text-xs text-slate-500 ml-7 mb-4">
            Composite of safety + walk score + transit score per rent dollar
          </p>
          <div className="space-y-2">
            {data.bestValue.map((entry, i) => (
              <div
                key={entry.name}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                  i === 0
                    ? "border-purple-500/20 bg-purple-500/10"
                    : "border-white/10 bg-white/[0.06]"
                }`}
              >
                <span className="text-purple-300 font-bold text-base w-5">{i + 1}</span>
                <span className="text-sm text-white flex-1 min-w-0 truncate">{entry.name}</span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Safety {entry.safety} · Walk {entry.walkScore} · Transit {entry.transitScore}
                </span>
                <span className="text-sm font-semibold text-emerald-400 flex-shrink-0">
                  ${entry.rent.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Commute-Friendly */}
        <section className="rounded-xl border border-white/15 bg-white/10 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🚇</span>
            <h2 className="text-base font-semibold text-white">Commute-Friendly</h2>
          </div>
          <p className="text-xs text-slate-500 ml-7 mb-4">
            Ranked by transit score, walk score, and MBTA line coverage
          </p>
          <div className="space-y-2">
            {data.commuteFriendly.map((entry, i) => (
              <div
                key={entry.name}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                  i === 0
                    ? "border-blue-500/20 bg-blue-500/10"
                    : "border-white/10 bg-white/[0.06]"
                }`}
              >
                <span className="text-blue-300 font-bold text-base w-5">{i + 1}</span>
                <span className="text-sm text-white flex-1 min-w-0 truncate">{entry.name}</span>
                <div className="flex flex-wrap gap-1">
                  {entry.mbtaLines
                    .filter((line) => line !== "bus" && line !== "ferry")
                    .map((line) => (
                      <span
                        key={line}
                        className={`${MBTA_COLORS[line] ?? "bg-gray-600"} text-white text-[10px] px-1.5 py-0.5 rounded`}
                      >
                        {line.charAt(0).toUpperCase() + line.slice(1)}
                      </span>
                    ))}
                </div>
                <span className="text-xs text-blue-300 flex-shrink-0">
                  Transit: {entry.transitScore}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Safety Rankings */}
        <section className="rounded-xl border border-white/15 bg-white/10 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🛡️</span>
            <h2 className="text-base font-semibold text-white">Safety Rankings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-400 mb-3">Safest</p>
              <div className="space-y-2">
                {data.safety.safest.map((entry, i) => (
                  <div key={entry.name} className="flex justify-between items-center">
                    <span className="text-sm text-white">{i + 1}. {entry.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-emerald-400">{entry.safety}</span>
                      <span
                        className={`text-[10px] ${
                          entry.safetyTrend === "improving"
                            ? "text-emerald-400"
                            : entry.safetyTrend === "declining"
                              ? "text-red-400"
                              : "text-slate-500"
                        }`}
                      >
                        {entry.safetyTrend === "improving"
                          ? "▲ improving"
                          : entry.safetyTrend === "declining"
                            ? "▼ declining"
                            : "— stable"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-blue-400 mb-3">Trending Safer ▲</p>
              <div className="space-y-2">
                {data.safety.trendingSafer.map((entry, i) => (
                  <div key={entry.name} className="flex justify-between items-center">
                    <span className="text-sm text-white">{i + 1}. {entry.name}</span>
                    <span className="text-sm text-blue-400">{entry.safety} → improving</span>
                  </div>
                ))}
                {data.safety.trendingSafer.length === 0 && (
                  <p className="text-sm text-slate-500">No neighborhoods currently trending safer</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Lifestyle Clusters */}
        <section className="rounded-xl border border-white/15 bg-white/10 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🎭</span>
            <h2 className="text-base font-semibold text-white">Lifestyle Clusters</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <p className="text-sm font-semibold text-amber-300 mb-1">🌃 Nightlife Hubs</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {data.lifestyleClusters.nightlife.join(" · ") || "None"}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
              <p className="text-sm font-semibold text-emerald-300 mb-1">👨‍👩‍👧 Family-Friendly</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {data.lifestyleClusters.family.join(" · ") || "None"}
              </p>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
              <p className="text-sm font-semibold text-blue-300 mb-1">🏙️ Urban Core</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {data.lifestyleClusters.urban.join(" · ") || "None"}
              </p>
            </div>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-3">
              <p className="text-sm font-semibold text-purple-300 mb-1">🌳 Quiet & Suburban</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {data.lifestyleClusters.quiet.join(" · ") || "None"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
