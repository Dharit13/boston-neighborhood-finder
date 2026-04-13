import type { Neighborhood } from "./types";

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
