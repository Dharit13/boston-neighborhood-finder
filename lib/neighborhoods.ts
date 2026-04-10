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
 * Get total apartment rent based on living arrangement and apartment size.
 */
function getApartmentRent(
  neighborhood: Neighborhood,
  roommates: number,
  arrangement: UserInput["livingArrangement"],
  apartmentSize: UserInput["apartmentSize"] = "studio"
): number {
  if (arrangement === "alone") {
    const rentRange = apartmentSize === "1br"
      ? neighborhood.rent.oneBr
      : neighborhood.rent.studio;
    return Math.round((rentRange[0] + rentRange[1]) / 2);
  }

  if (arrangement === "couple") {
    const rentRange = apartmentSize === "2br"
      ? neighborhood.rent.twoBr
      : neighborhood.rent.oneBr;
    return Math.round((rentRange[0] + rentRange[1]) / 2);
  }

  let bedrooms: number;
  switch (arrangement) {
    case "own-room":
      bedrooms = roommates + 1;
      break;
    case "shared-room":
      bedrooms = Math.ceil((roommates + 1) / 2);
      break;
    default:
      bedrooms = roommates + 1;
  }

  const rentRange =
    bedrooms <= 1 ? neighborhood.rent.oneBr : neighborhood.rent.twoBr;
  return Math.round((rentRange[0] + rentRange[1]) / 2);
}

export function getPerPersonRent(
  neighborhood: Neighborhood,
  roommates: number,
  arrangement: UserInput["livingArrangement"] = "own-room",
  apartmentSize: UserInput["apartmentSize"] = "studio"
): number {
  const totalRent = getApartmentRent(neighborhood, roommates, arrangement, apartmentSize);
  // Couples budget together — compare against the full household rent, not a split.
  if (arrangement === "couple") return totalRent;
  const totalPeople = roommates + 1;
  return Math.round(totalRent / totalPeople);
}
