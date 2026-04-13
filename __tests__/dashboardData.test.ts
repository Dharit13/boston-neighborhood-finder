import type { Neighborhood } from "@/lib/types";
import {
  computeMedianRent,
  computeRentLeaderboard,
} from "@/lib/dashboardData";

// Minimal neighborhood factory — only fields used by dashboard logic
function makeNeighborhood(
  overrides: Partial<Neighborhood> & { name: string }
): Neighborhood {
  return {
    id: overrides.name.toLowerCase().replace(/\s/g, "-"),
    region: "boston",
    description: "",
    localTips: "",
    rent: { studio: [1000, 1200], oneBr: [1500, 1700], twoBr: [2000, 2400] },
    safety: 70,
    safetyTrend: "stable",
    walkScore: 70,
    transitScore: 60,
    bikeScore: 50,
    lifestyleProfile: {
      nightlifeVsQuiet: 3,
      urbanVsSuburban: 3,
      trendyVsFamily: 3,
      communityVsPrivacy: 3,
    },
    communityScore: 60,
    amenities: { restaurants: 10, nightlife: 5, gyms: 3, grocery: 4, parks: 3 },
    mbtaLines: [],
    mbtaStations: [],
    busRoutes: [],
    collegeArea: false,
    parkingFriendly: true,
    centroid: { lat: 42.36, lng: -71.06 },
    ...overrides,
  };
}

describe("computeMedianRent", () => {
  it("returns the average of oneBr low and high", () => {
    const n = makeNeighborhood({ name: "Test", rent: { studio: [1000, 1200], oneBr: [2000, 3000], twoBr: [3000, 4000] } });
    expect(computeMedianRent(n)).toBe(2500);
  });
});

describe("computeRentLeaderboard", () => {
  it("returns top 5 most expensive and top 5 most affordable", () => {
    const neighborhoods = [
      makeNeighborhood({ name: "Cheap", rent: { studio: [800, 900], oneBr: [1000, 1200], twoBr: [1500, 1700] } }),
      makeNeighborhood({ name: "Mid", rent: { studio: [1200, 1400], oneBr: [1800, 2000], twoBr: [2500, 2700] } }),
      makeNeighborhood({ name: "Pricey", rent: { studio: [2000, 2400], oneBr: [3000, 3400], twoBr: [4000, 4600] } }),
    ];
    const result = computeRentLeaderboard(neighborhoods);
    expect(result.mostExpensive[0].name).toBe("Pricey");
    expect(result.mostExpensive[0].rent).toBe(3200);
    expect(result.mostAffordable[0].name).toBe("Cheap");
    expect(result.mostAffordable[0].rent).toBe(1100);
  });

  it("caps lists at 5 entries", () => {
    const neighborhoods = Array.from({ length: 10 }, (_, i) =>
      makeNeighborhood({
        name: `N${i}`,
        rent: { studio: [1000, 1200], oneBr: [1000 + i * 200, 1200 + i * 200], twoBr: [2000, 2400] },
      })
    );
    const result = computeRentLeaderboard(neighborhoods);
    expect(result.mostExpensive).toHaveLength(5);
    expect(result.mostAffordable).toHaveLength(5);
  });
});
