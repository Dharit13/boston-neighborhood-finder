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
  computeMatchScore,
  applyMbtaBonus,
} from "@/lib/scoring";
import {
  calculateBudgetTiers,
  calculatePerPersonBudget,
  getActiveTiers,
  getRentAsPercentOfIncome,
} from "@/lib/budget";
import { getPerPersonRent } from "@/lib/neighborhoods";
import { fetchCommuteTimes } from "@/lib/commute";
import RecommendationCards from "@/components/results/RecommendationCards";
import NeighborhoodProfile from "@/components/results/NeighborhoodProfile";
import CompareView from "@/components/results/CompareView";
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

  // Auto-scroll to profile when a neighborhood is selected
  useEffect(() => {
    if (selectedId && profileRef.current) {
      profileRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedId]);

  // Load input from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("wizardInput");
    if (!stored) {
      router.push("/");
      return;
    }
    setInput(JSON.parse(stored));
  }, [router]);

  // Load neighborhoods
  useEffect(() => {
    fetch("/data/neighborhoods.json")
      .then((r) => r.json())
      .then(setNeighborhoods);
  }, []);

  // Score neighborhoods when both input and data are ready
  useEffect(() => {
    if (!input || neighborhoods.length === 0) return;

    async function scoreAll() {
      setLoading(true);
      const weights = deriveWeights(input!.sliders, input!.officeDays > 2);
      const tiers = calculateBudgetTiers(input!.monthlyIncome, input!.maxRent);
      const activeTiers = getActiveTiers(input!.monthlyIncome, input!.maxRent);

      // Fetch commute times if user has an office
      let commuteMap = new Map<string, CommuteResult>();
      if (input!.officeDays > 2 && input!.officeAddress) {
        const origins = neighborhoods.map((n) => ({
          id: n.id,
          lat: n.centroid.lat,
          lng: n.centroid.lng,
        }));
        commuteMap = await fetchCommuteTimes(origins, input!.officeAddress);
      }

      // Score each neighborhood against the "balanced" tier (or stretched if no balanced)
      const budgetForScoring = tiers.balanced;
      const scoredList: ScoredNeighborhood[] = neighborhoods.map((n) => {
        const perPersonRent = getPerPersonRent(n, input!.roommates);
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
            input!.hasCar,
            n.parkingCost
          ),
          commute: commuteScore,
          safety: scoreSafety(n.safety),
          lifestyle: scoreLifestyle(input!.sliders, n.lifestyleProfile),
          community: scoreCommunity(n.communityScore),
        };

        const matchScore = computeMatchScore(scores, weights);

        return {
          neighborhood: n,
          scores,
          matchScore,
          commuteMinutes,
          commuteRoute: commuteResult?.routeSummary ?? null,
          perPersonRent,
          rentPercent: getRentAsPercentOfIncome(
            perPersonRent,
            input!.monthlyIncome
          ),
        };
      });

      // Sort by match score
      scoredList.sort((a, b) => b.matchScore - a.matchScore);
      setScored(scoredList);

      // Build tiered recommendations
      const tierConfigs: {
        tier: BudgetTier;
        label: string;
        color: string;
        maxBudget: number;
      }[] = [];

      if (activeTiers.includes("saver")) {
        tierConfigs.push({
          tier: "saver",
          label: "Easy on Your Wallet",
          color: "green",
          maxBudget: calculatePerPersonBudget(tiers.saver, input!.roommates),
        });
      }
      if (activeTiers.includes("balanced")) {
        tierConfigs.push({
          tier: "balanced",
          label: "Balanced Pick",
          color: "blue",
          maxBudget: calculatePerPersonBudget(tiers.balanced, input!.roommates),
        });
      }
      if (activeTiers.includes("stretched")) {
        tierConfigs.push({
          tier: "stretched",
          label: "At Your Max",
          color: "orange",
          maxBudget: calculatePerPersonBudget(tiers.stretched, input!.roommates),
        });
      }

      // Build 3 recommendations: pick top 3 distinct neighborhoods by match
      // score, then assign tier labels based on where their rent falls
      const recs: TieredRecommendation[] = [];
      const usedIds = new Set<string>();
      const top3 = scoredList
        .filter((s) => {
          if (usedIds.has(s.neighborhood.id)) return false;
          usedIds.add(s.neighborhood.id);
          return true;
        })
        .slice(0, 3);

      // Sort the 3 picks by rent (cheapest first) for tier assignment
      const byRent = [...top3].sort(
        (a, b) => a.perPersonRent - b.perPersonRent
      );

      const saverBudget = calculatePerPersonBudget(tiers.saver, input!.roommates);
      const balancedBudget = calculatePerPersonBudget(tiers.balanced, input!.roommates);
      const stretchedBudget = calculatePerPersonBudget(tiers.stretched, input!.roommates);

      for (let i = 0; i < byRent.length; i++) {
        const n = byRent[i];
        const rent = n.perPersonRent;
        let tier: BudgetTier;
        let label: string;
        let color: string;

        if (rent <= saverBudget) {
          tier = "saver";
          label = "Easy on Your Wallet";
          color = "green";
        } else if (rent <= balancedBudget) {
          // Assign cheapest as balanced, others shift up
          if (i === 0 || byRent[i - 1].perPersonRent > saverBudget) {
            tier = "balanced";
            label = "Balanced Pick";
            color = "blue";
          } else {
            tier = "balanced";
            label = "Balanced Pick";
            color = "blue";
          }
        } else if (rent <= stretchedBudget) {
          tier = "stretched";
          label = "At Your Max";
          color = "orange";
        } else {
          tier = "stretched";
          label = "Over Budget — Best Match";
          color = "orange";
        }

        recs.push({
          tier,
          label,
          color,
          neighborhood: n,
          tradeoffVsPrev: null,
        });
      }

      // Deduplicate tier labels — if multiple have same tier, relabel
      const tierCounts: Record<string, number> = {};
      recs.forEach((r) => {
        tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1;
      });

      if (tierCounts["balanced"] && tierCounts["balanced"] > 1) {
        // Multiple in balanced range — label by rank instead
        let rank = 1;
        for (const r of recs) {
          if (r.tier === "balanced") {
            if (rank === 1) {
              r.label = "Best Match";
              r.color = "blue";
            } else {
              r.label = "Runner Up";
              r.color = "green";
            }
            rank++;
          }
        }
      }

      // Sort final recs by rent ascending
      recs.sort((a, b) => a.neighborhood.perPersonRent - b.neighborhood.perPersonRent);

      // Compute tradeoffs between adjacent recs
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">
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
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Your Results</h1>
          <button
            onClick={() => router.push("/")}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Adjust Preferences
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* Recommendation Cards */}
        <RecommendationCards
          recommendations={recommendations}
          onSelect={(id) => setSelectedId(id)}
        />

        {/* Map */}
        <NeighborhoodMap
          recommendations={recommendations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          officeAddress={input?.officeAddress ?? null}
        />

        {/* Neighborhood Profile */}
        <div ref={profileRef} />
        {selectedNeighborhood && input && (
          <NeighborhoodProfile
            scored={selectedNeighborhood}
            userInput={input}
            monthlyIncome={input.monthlyIncome}
            roommates={input.roommates}
            onClose={() => setSelectedId(null)}
          />
        )}

        {/* Compare View */}
        {compareIds.length >= 2 && input && (
          <CompareView
            items={scored.filter((s) =>
              compareIds.includes(s.neighborhood.id)
            )}
            monthlyIncome={input.monthlyIncome}
            onRemove={(id) =>
              setCompareIds((prev) => prev.filter((x) => x !== id))
            }
          />
        )}
      </div>
    </main>
  );
}
