"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  UserInput,
  Neighborhood,
  ScoredNeighborhood,
  TieredRecommendation,
  BudgetTier,
  CommuteResult,
} from "@/lib/types";
import { deriveWeights } from "@/lib/weights";
import {
  scoreBudget,
  scoreCommute,
  scoreSafety,
  scoreLifestyle,
  scoreCommunity,
  computeMatchScoresTopsis,
  applyMbtaBonus,
  applyAgeAdjustment,
  applyUrbanAdjustment,
} from "@/lib/scoring";
import {
  calculateBudgetTiers,
  getRentAsPercentOfIncome,
} from "@/lib/budget";
import { getPerPersonRent } from "@/lib/neighborhoods";
import { fetchCommuteTimes } from "@/lib/commute";
import RecommendationOverview from "@/components/results/RecommendationOverview";
import RecommendationCards from "@/components/results/RecommendationCards";
import NeighborhoodProfile from "@/components/results/NeighborhoodProfile";
import NewsPanel from "@/components/results/NewsPanel";
import ChatPanel from "@/components/results/ChatPanel";
import CompareView from "@/components/results/CompareView";
import { SidePixelTrail } from "@/components/ui/SidePixelTrail";
import dynamic from "next/dynamic";

const NeighborhoodMap = dynamic(
  () => import("@/components/results/NeighborhoodMap"),
  { ssr: false }
);

export default function ResultsPage() {
  const router = useRouter();
  const [input, setInput] = useState<UserInput | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [scored, setScored] = useState<ScoredNeighborhood[]>([]);
  const [recommendations, setRecommendations] = useState<TieredRecommendation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedId && profileRef.current) {
      profileRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedId]);

  useEffect(() => {
    // sessionStorage is a client-only external store read once on mount;
    // SSR renders a null placeholder to avoid hydration mismatch.
    const stored = sessionStorage.getItem("wizardInput");
    if (!stored) {
      router.push("/");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInput(JSON.parse(stored));
  }, [router]);

  useEffect(() => {
    fetch("/data/neighborhoods.json")
      .then((r) => r.json())
      .then(setNeighborhoods);
  }, []);

  useEffect(() => {
    if (!input || neighborhoods.length === 0) return;

    async function scoreAll() {
      setLoading(true);
      const weights = deriveWeights(input!.sliders, input!.officeDays > 2, input!.budgetPriority, input!.vibeStrength);
      const tiers = calculateBudgetTiers(input!.monthlyIncome, input!.maxRent);

      let commuteMap = new Map<string, CommuteResult>();
      if (input!.officeDays > 2 && input!.officeAddress) {
        const origins = neighborhoods.map((n) => ({
          id: n.id,
          lat: n.centroid.lat,
          lng: n.centroid.lng,
        }));
        commuteMap = await fetchCommuteTimes(origins, input!.officeAddress);
      }

      const budgetForScoring = tiers.stretched;

      // Score every neighborhood so all of them appear on the map and are
      // clickable for details. Affordability is enforced later when selecting
      // the top-3 recommendations.
      const dimensionData = neighborhoods.map((n) => {
        const perPersonRent = getPerPersonRent(n, input!.roommates, input!.livingArrangement, input!.apartmentSize);
        const commuteResult = commuteMap.get(n.id);
        const commuteMinutes = commuteResult?.durationMinutes ?? null;

        let commuteScore = scoreCommute(commuteMinutes);
        commuteScore = applyMbtaBonus(
          commuteScore,
          n.mbtaLines,
          input!.mbtaPreference
        );

        const scores = {
          budget: scoreBudget(
            perPersonRent,
            budgetForScoring,
            input!.budgetPriority
          ),
          commute: commuteScore,
          safety: scoreSafety(n.safety),
          lifestyle: scoreLifestyle(input!.sliders, n.lifestyleProfile),
          community: scoreCommunity(n.communityScore),
        };

        return {
          neighborhood: n,
          scores,
          commuteMinutes,
          commuteRoute: commuteResult?.routeSummary ?? null,
          perPersonRent,
        };
      });

      const allDimensionScores = dimensionData.map((d) => d.scores);
      const topsisScores = computeMatchScoresTopsis(allDimensionScores, weights);

      const scoredList: ScoredNeighborhood[] = dimensionData.map((d, i) => {
        const overBudget = d.perPersonRent > budgetForScoring;
        let matchScore = topsisScores[i];

        matchScore = applyAgeAdjustment(
          matchScore,
          input!.ageGroup,
          d.neighborhood
        );

        matchScore = applyUrbanAdjustment(
          matchScore,
          input!.sliders.urbanVsSuburban,
          d.neighborhood.lifestyleProfile.urbanVsSuburban
        );

        if (input!.avoidCollegeArea && d.neighborhood.collegeArea) {
          matchScore = matchScore * 0.3;
        }

        if (input!.needsParking && !d.neighborhood.parkingFriendly) {
          matchScore = matchScore * 0.3;
        }

        // Over-budget neighborhoods are never a valid match — force to 0.
        if (overBudget) matchScore = 0;

        return {
          neighborhood: d.neighborhood,
          scores: d.scores,
          matchScore,
          commuteMinutes: d.commuteMinutes,
          commuteRoute: d.commuteRoute,
          perPersonRent: d.perPersonRent,
          rentPercent: getRentAsPercentOfIncome(
            d.perPersonRent,
            input!.monthlyIncome
          ),
          overBudget,
        };
      });

      scoredList.sort((a, b) => b.matchScore - a.matchScore);
      setScored(scoredList);

      const recs: TieredRecommendation[] = [];
      const usedIds = new Set<string>();
      const top3 = scoredList
        .filter((s) => {
          // Recommendations must be within budget, even though the map shows all.
          if (s.perPersonRent > budgetForScoring) return false;
          if (usedIds.has(s.neighborhood.id)) return false;
          usedIds.add(s.neighborhood.id);
          return true;
        })
        .slice(0, 3);

      const rankLabels: { label: string; color: string; tier: BudgetTier }[] = [
        { label: "Best Match", color: "blue", tier: "balanced" },
        { label: "Runner Up", color: "green", tier: "balanced" },
        { label: "Also Great", color: "orange", tier: "balanced" },
      ];

      for (let i = 0; i < top3.length; i++) {
        const n = top3[i];
        const rank = rankLabels[i];
        recs.push({
          tier: rank.tier,
          label: rank.label,
          color: rank.color,
          neighborhood: n,
          tradeoffVsPrev: null,
        });
      }

      for (let i = 1; i < recs.length; i++) {
        const curr = recs[i].neighborhood;
        const prev = recs[i - 1].neighborhood;
        const rentDiff = curr.perPersonRent - prev.perPersonRent;
        const commuteDiff =
          (curr.commuteMinutes ?? 0) - (prev.commuteMinutes ?? 0);
        const parts: string[] = [];
        if (Math.abs(rentDiff) >= 50) {
          parts.push(
            rentDiff > 0
              ? `+$${rentDiff}/mo rent`
              : `Save $${Math.abs(rentDiff)}/mo`
          );
        }
        if (Math.abs(commuteDiff) >= 5) {
          parts.push(
            commuteDiff > 0
              ? `+${commuteDiff} min commute`
              : `${commuteDiff} min commute`
          );
        }
        recs[i].tradeoffVsPrev = parts.length > 0 ? parts.join(", ") : null;
      }

      setRecommendations(recs);
      setLoading(false);
    }

    scoreAll();
  }, [input, neighborhoods]);

  if (loading) {
    return (
      <div className="relative min-h-screen bg-black flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.aiscribbles.com/34fe5695dbc942628e3cad9744e8ae13.png?v=60d084"
          alt=""
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-70"
        />
        <SidePixelTrail centerWidthRem={72} />
        <div className="relative z-10 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto" />
          <p className="mt-4 text-white">
            Finding your perfect neighborhood...
          </p>
        </div>
      </div>
    );
  }

  const selectedNeighborhood = selectedId
    ? scored.find((s) => s.neighborhood.id === selectedId) ?? null
    : null;

  return (
    <main className="relative min-h-screen bg-black overflow-hidden">
      {/* Background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.aiscribbles.com/34fe5695dbc942628e3cad9744e8ae13.png?v=60d084"
        alt=""
        className="fixed inset-0 w-full h-full object-cover z-0 opacity-70"
      />

      {/* Cursor pixel trail — fixed side strips, never behind the content */}
      <SidePixelTrail centerWidthRem={72} fixed />

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Recommended Neighbourhoods</h1>
          <button
            onClick={() => router.push("/?step=3")}
            className="text-white hover:text-white text-sm font-bold border border-white/15 px-4 py-2 rounded-lg transition-all hover:border-white/30 backdrop-blur-sm flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" /><circle cx="12" cy="12" r="3" /></svg>
            Adjust Preferences
          </button>
        </div>

        <div className="px-4 py-6 space-y-8">
          {input && recommendations.length > 0 && (
            <RecommendationOverview
              recommendations={recommendations}
              userInput={input}
            />
          )}

          {input && (
            <RecommendationCards
              recommendations={recommendations}
              onSelect={(id) => setSelectedId(id)}
              livingArrangement={input.livingArrangement}
            />
          )}

          <NeighborhoodMap
            recommendations={recommendations}
            allNeighborhoods={scored}
            selectedId={selectedId}
            onSelect={setSelectedId}
            officeAddress={input?.officeAddress ?? null}
          />

          <NewsPanel />

          <div ref={profileRef} />
          {selectedNeighborhood && input && (
            <NeighborhoodProfile
              scored={selectedNeighborhood}
              userInput={input}
              monthlyIncome={input.monthlyIncome}
              onClose={() => setSelectedId(null)}
            />
          )}

          {compareIds.length >= 2 && input && (
            <CompareView
              items={scored.filter((s) =>
                compareIds.includes(s.neighborhood.id)
              )}
              livingArrangement={input.livingArrangement}
              onRemove={(id) =>
                setCompareIds((prev) => prev.filter((x) => x !== id))
              }
            />
          )}
        </div>
      </div>
      <ChatPanel userInput={input} recommendations={recommendations} />
    </main>
  );
}
