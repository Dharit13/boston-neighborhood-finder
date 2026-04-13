import type { Neighborhood, SafetyTrend } from "./types";

// --- Helpers ---

export function computeMedianRent(n: Neighborhood): number {
  return Math.round((n.rent.oneBr[0] + n.rent.oneBr[1]) / 2);
}

// --- Rent Leaderboard ---

interface RentEntry {
  name: string;
  rent: number;
}

interface RentLeaderboard {
  mostExpensive: RentEntry[];
  mostAffordable: RentEntry[];
}

export function computeRentLeaderboard(
  neighborhoods: Neighborhood[]
): RentLeaderboard {
  const entries: RentEntry[] = neighborhoods.map((n) => ({
    name: n.name,
    rent: computeMedianRent(n),
  }));

  const byRentDesc = [...entries].sort((a, b) => b.rent - a.rent);
  const byRentAsc = [...entries].sort((a, b) => a.rent - b.rent);

  return {
    mostExpensive: byRentDesc.slice(0, 5),
    mostAffordable: byRentAsc.slice(0, 5),
  };
}

// --- Value for Money ---

export function computeValueScore(n: Neighborhood): number {
  const avgQuality = (n.safety + n.walkScore + n.transitScore) / 3;
  const rent = computeMedianRent(n);
  if (rent <= 0) return 0;
  return avgQuality / rent * 1000;
}

interface ValueEntry {
  name: string;
  rent: number;
  safety: number;
  walkScore: number;
  transitScore: number;
  valueScore: number;
}

export function computeBestValue(neighborhoods: Neighborhood[]): ValueEntry[] {
  return neighborhoods
    .map((n) => ({
      name: n.name,
      rent: computeMedianRent(n),
      safety: n.safety,
      walkScore: n.walkScore,
      transitScore: n.transitScore,
      valueScore: Math.round(computeValueScore(n) * 10) / 10,
    }))
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, 5);
}

// --- Commute-Friendly ---

export function computeCommuteScore(n: Neighborhood): number {
  const lineCoverage = (n.mbtaLines.length / 7) * 100;
  return n.transitScore * 0.5 + n.walkScore * 0.3 + lineCoverage * 0.2;
}

interface CommuteEntry {
  name: string;
  transitScore: number;
  walkScore: number;
  mbtaLines: string[];
  commuteScore: number;
}

export function computeCommuteFriendly(neighborhoods: Neighborhood[]): CommuteEntry[] {
  return neighborhoods
    .map((n) => ({
      name: n.name,
      transitScore: n.transitScore,
      walkScore: n.walkScore,
      mbtaLines: n.mbtaLines,
      commuteScore: Math.round(computeCommuteScore(n) * 10) / 10,
    }))
    .sort((a, b) => b.commuteScore - a.commuteScore)
    .slice(0, 5);
}

// --- Safety Rankings ---

interface SafetyEntry {
  name: string;
  safety: number;
  safetyTrend: SafetyTrend;
}

interface SafetyRankings {
  safest: SafetyEntry[];
  trendingSafer: SafetyEntry[];
}

export function computeSafetyRankings(neighborhoods: Neighborhood[]): SafetyRankings {
  const entries: SafetyEntry[] = neighborhoods.map((n) => ({
    name: n.name,
    safety: n.safety,
    safetyTrend: n.safetyTrend,
  }));

  const safest = [...entries]
    .sort((a, b) => b.safety - a.safety)
    .slice(0, 5);

  const trendingSafer = entries
    .filter((e) => e.safetyTrend === "improving")
    .sort((a, b) => b.safety - a.safety)
    .slice(0, 5);

  return { safest, trendingSafer };
}

// --- Lifestyle Clusters ---

interface LifestyleClusters {
  nightlife: string[];
  family: string[];
  urban: string[];
  quiet: string[];
}

export function computeLifestyleClusters(neighborhoods: Neighborhood[]): LifestyleClusters {
  return {
    nightlife: neighborhoods
      .filter((n) => n.lifestyleProfile.nightlifeVsQuiet <= 2)
      .map((n) => n.name),
    family: neighborhoods
      .filter((n) => n.lifestyleProfile.trendyVsFamily >= 4)
      .map((n) => n.name),
    urban: neighborhoods
      .filter((n) => n.lifestyleProfile.urbanVsSuburban <= 2)
      .map((n) => n.name),
    quiet: neighborhoods
      .filter((n) => n.lifestyleProfile.urbanVsSuburban >= 4)
      .map((n) => n.name),
  };
}
