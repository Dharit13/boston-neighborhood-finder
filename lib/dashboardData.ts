import type { Neighborhood, SafetyTrend } from "./types";

// --- Helpers ---

export function computeMedianRent(n: Neighborhood): number {
  return Math.round((n.rent.oneBr[0] + n.rent.oneBr[1]) / 2);
}

// --- Rent Leaderboard ---

export interface RentEntry {
  name: string;
  rent: number;
}

export interface RentLeaderboard {
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

export interface ValueEntry {
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

export interface CommuteEntry {
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

export interface SafetyEntry {
  name: string;
  safety: number;
  safetyTrend: SafetyTrend;
}

export interface SafetyRankings {
  safest: SafetyEntry[];
  leastSafe: SafetyEntry[];
}

export function computeSafetyRankings(neighborhoods: Neighborhood[]): SafetyRankings {
  const entries: SafetyEntry[] = neighborhoods.map((n) => ({
    name: n.name,
    safety: n.safety,
    safetyTrend: n.safetyTrend,
  }));

  const sorted = [...entries].sort((a, b) => b.safety - a.safety);

  return {
    safest: sorted.slice(0, 5),
    leastSafe: sorted.slice(-5).reverse(),
  };
}

// --- Lifestyle Clusters ---

export interface LifestyleClusters {
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

// --- Orchestrator ---

export interface DashboardData {
  heroStats: {
    mostExpensive: { name: string; rent: number };
    safest: { name: string; safety: number };
    bestTransit: { name: string; transitScore: number };
    bestValue: { name: string; valueScore: number };
  };
  rentLeaderboard: RentLeaderboard;
  bestValue: ValueEntry[];
  commuteFriendly: CommuteEntry[];
  safety: SafetyRankings;
  lifestyleClusters: LifestyleClusters;
}

export function computeDashboardData(neighborhoods: Neighborhood[]): DashboardData {
  if (neighborhoods.length === 0) {
    throw new Error("computeDashboardData requires at least one neighborhood");
  }

  const rentLeaderboard = computeRentLeaderboard(neighborhoods);
  const bestValue = computeBestValue(neighborhoods);
  const commuteFriendly = computeCommuteFriendly(neighborhoods);
  const safety = computeSafetyRankings(neighborhoods);
  const lifestyleClusters = computeLifestyleClusters(neighborhoods);

  const bestTransitNeighborhood = [...neighborhoods].sort(
    (a, b) => b.transitScore - a.transitScore
  )[0];

  return {
    heroStats: {
      mostExpensive: rentLeaderboard.mostExpensive[0],
      safest: safety.safest[0],
      bestTransit: {
        name: bestTransitNeighborhood.name,
        transitScore: bestTransitNeighborhood.transitScore,
      },
      bestValue: {
        name: bestValue[0].name,
        valueScore: bestValue[0].valueScore,
      },
    },
    rentLeaderboard,
    bestValue,
    commuteFriendly,
    safety,
    lifestyleClusters,
  };
}
