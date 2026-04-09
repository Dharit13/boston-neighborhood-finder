import type { Neighborhood } from "./types";

let cachedNeighborhoods: Neighborhood[] | null = null;

export async function loadNeighborhoods(): Promise<Neighborhood[]> {
  if (cachedNeighborhoods) return cachedNeighborhoods;

  const response = await fetch("/data/neighborhoods.json");
  const data: Neighborhood[] = await response.json();
  cachedNeighborhoods = data;
  return data;
}

export function getNeighborhoodById(
  neighborhoods: Neighborhood[],
  id: string
): Neighborhood | undefined {
  return neighborhoods.find((n) => n.id === id);
}

export function getMedianRent(
  neighborhood: Neighborhood,
  roommates: number
): number {
  if (roommates === 0) {
    const [low, high] = neighborhood.rent.oneBr;
    return Math.round((low + high) / 2);
  }
  if (roommates === 1) {
    const [low, high] = neighborhood.rent.twoBr;
    return Math.round((low + high) / 2);
  }
  if (roommates === 2) {
    const [low, high] = neighborhood.rent.threeBr;
    return Math.round((low + high) / 2);
  }
  // 3+ roommates — use 3BR price (4BR data not tracked)
  const [low, high] = neighborhood.rent.threeBr;
  return Math.round((low + high) / 2);
}

export function getPerPersonRent(
  neighborhood: Neighborhood,
  roommates: number
): number {
  const totalRent = getMedianRent(neighborhood, roommates);
  return Math.round(totalRent / (roommates + 1));
}
