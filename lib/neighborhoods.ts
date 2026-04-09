import type { Neighborhood, UserInput } from "./types";

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

/**
 * Get the apartment size and total rent based on living arrangement:
 * - alone:       1BR
 * - couple:      1BR (sharing bedroom)
 * - own-room:    bedrooms = roommates + 1 (each person gets a room)
 * - shared-room: bedrooms = ceil((roommates + 1) / 2) (two people per room)
 */
function getApartmentRent(
  neighborhood: Neighborhood,
  roommates: number,
  arrangement: UserInput["livingArrangement"]
): number {
  let bedrooms: number;

  switch (arrangement) {
    case "alone":
      bedrooms = 1;
      break;
    case "couple":
      bedrooms = 1;
      break;
    case "own-room":
      bedrooms = roommates + 1; // each person gets a room
      break;
    case "shared-room":
      bedrooms = Math.ceil((roommates + 1) / 2); // 2 per room
      break;
    default:
      bedrooms = roommates + 1;
  }

  const rentRange =
    bedrooms <= 1
      ? neighborhood.rent.oneBr
      : bedrooms === 2
      ? neighborhood.rent.twoBr
      : neighborhood.rent.threeBr; // 3+ all use 3BR (no 4BR data)

  return Math.round((rentRange[0] + rentRange[1]) / 2);
}

export function getMedianRent(
  neighborhood: Neighborhood,
  roommates: number
): number {
  // Legacy function — assumes own-room arrangement
  return getApartmentRent(neighborhood, roommates, "own-room");
}

export function getPerPersonRent(
  neighborhood: Neighborhood,
  roommates: number,
  arrangement: UserInput["livingArrangement"] = "own-room"
): number {
  const totalRent = getApartmentRent(neighborhood, roommates, arrangement);
  const totalPeople = roommates + 1;
  return Math.round(totalRent / totalPeople);
}
