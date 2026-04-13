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
