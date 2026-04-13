import {
  scoreBudget,
  scoreCommute,
  scoreSafety,
  scoreLifestyle,
  scoreCommunity,
  computeMatchScore,
  applyUrbanAdjustment,
  applyMbtaBonus,
  applyAgeAdjustment,
  computeMatchScoresTopsis,
} from "@/lib/scoring";
import type {
  DimensionScores,
  ScoringWeights,
  Neighborhood,
} from "@/lib/types";

describe("scoreBudget", () => {
  it("returns 100 when rent is at or below budget", () => {
    expect(scoreBudget(1500, 2000)).toBe(100);
  });

  it("returns 100 when rent equals budget", () => {
    expect(scoreBudget(2000, 2000)).toBe(100);
  });

  it("scales down linearly when rent exceeds budget", () => {
    expect(scoreBudget(2500, 2000)).toBe(75);
  });

  it("returns 0 when rent is double the budget", () => {
    expect(scoreBudget(4000, 2000)).toBe(0);
  });
});

describe("scoreCommute", () => {
  it("returns 100 for 5 min or less", () => {
    expect(scoreCommute(3)).toBe(100);
    expect(scoreCommute(5)).toBe(100);
  });

  it("returns 90 for 15 min", () => {
    expect(scoreCommute(15)).toBe(90);
  });

  it("returns 70 for 30 min", () => {
    expect(scoreCommute(30)).toBeCloseTo(70, 0);
  });

  it("returns 45 for 45 min", () => {
    expect(scoreCommute(45)).toBeCloseTo(45, 0);
  });

  it("returns 20 for 60 min", () => {
    expect(scoreCommute(60)).toBeCloseTo(20, 0);
  });

  it("returns 0 for 75+ min", () => {
    expect(scoreCommute(75)).toBe(0);
    expect(scoreCommute(90)).toBe(0);
  });

  it("returns 0 for null (no commute data)", () => {
    expect(scoreCommute(null)).toBe(0);
  });
});

describe("scoreSafety", () => {
  it("returns the neighborhood safety score directly", () => {
    expect(scoreSafety(85)).toBe(85);
    expect(scoreSafety(42)).toBe(42);
  });
});

describe("scoreLifestyle", () => {
  it("returns 100 for perfect match", () => {
    const userSliders = { nightlifeVsQuiet: 1, urbanVsSuburban: 1, trendyVsFamily: 1, communityVsPrivacy: 1 };
    const profile = { nightlifeVsQuiet: 1, urbanVsSuburban: 1, trendyVsFamily: 1, communityVsPrivacy: 1 };
    expect(scoreLifestyle(userSliders, profile)).toBe(100);
  });

  it("returns 0 for worst mismatch", () => {
    const userSliders = { nightlifeVsQuiet: 1, urbanVsSuburban: 1, trendyVsFamily: 1, communityVsPrivacy: 1 };
    const profile = { nightlifeVsQuiet: 5, urbanVsSuburban: 5, trendyVsFamily: 5, communityVsPrivacy: 5 };
    expect(scoreLifestyle(userSliders, profile)).toBe(0);
  });

  it("returns 50 for moderate mismatch", () => {
    const userSliders = { nightlifeVsQuiet: 1, urbanVsSuburban: 1, trendyVsFamily: 1, communityVsPrivacy: 1 };
    const profile = { nightlifeVsQuiet: 3, urbanVsSuburban: 3, trendyVsFamily: 3, communityVsPrivacy: 3 };
    expect(scoreLifestyle(userSliders, profile)).toBe(50);
  });
});

describe("scoreCommunity", () => {
  it("returns the neighborhood community score directly", () => {
    expect(scoreCommunity(78)).toBe(78);
  });
});

describe("computeMatchScore", () => {
  it("computes weighted sum correctly", () => {
    const scores: DimensionScores = {
      budget: 80,
      commute: 60,
      safety: 70,
      lifestyle: 90,
      community: 75,
    };
    const weights: ScoringWeights = {
      budget: 0.3,
      commute: 0.2,
      safety: 0.15,
      lifestyle: 0.2,
      community: 0.15,
    };
    expect(computeMatchScore(scores, weights)).toBeCloseTo(75.75, 1);
  });

  it("handles zero commute weight for remote workers", () => {
    const scores: DimensionScores = {
      budget: 80,
      commute: 0,
      safety: 70,
      lifestyle: 90,
      community: 75,
    };
    const weights: ScoringWeights = {
      budget: 0.4,
      commute: 0,
      safety: 0.15,
      lifestyle: 0.25,
      community: 0.2,
    };
    expect(computeMatchScore(scores, weights)).toBeCloseTo(80, 1);
  });
});

describe("applyUrbanAdjustment", () => {
  it("leaves score unchanged when the user is neutral on urban vs suburban", () => {
    expect(applyUrbanAdjustment(80, 3, 1)).toBe(80);
    expect(applyUrbanAdjustment(80, 3, 5)).toBe(80);
  });

  it("boosts a strong urban pick that matches an urban-core neighborhood", () => {
    // +12% of 70 = 78.4 → clamped, not rounded to int
    expect(applyUrbanAdjustment(70, 1, 1)).toBeCloseTo(78.4, 5);
  });

  it("penalizes a strong urban pick against a suburban neighborhood", () => {
    // -15% of 80 = 68
    expect(applyUrbanAdjustment(80, 1, 5)).toBeCloseTo(68, 5);
  });

  it("applies a small boost on near-matches (distance 1)", () => {
    // +4% of 50 = 52
    expect(applyUrbanAdjustment(50, 1, 2)).toBeCloseTo(52, 5);
  });

  it("applies the symmetric nudge for strong suburban picks", () => {
    // +12% for match
    expect(applyUrbanAdjustment(60, 5, 5)).toBeCloseTo(67.2, 5);
    // -15% for dense-urban mismatch
    expect(applyUrbanAdjustment(60, 5, 1)).toBeCloseTo(51, 5);
  });

  it("clamps the adjusted score between 0 and 100", () => {
    expect(applyUrbanAdjustment(95, 1, 1)).toBeLessThanOrEqual(100);
    expect(applyUrbanAdjustment(5, 1, 5)).toBeGreaterThanOrEqual(0);
  });
});

// ---------- scoreBudget with "save" priority ----------

describe("scoreBudget with save priority", () => {
  it("scores cheaper rent higher (rent=1000, budget=2000 → ~77)", () => {
    // ratio = 0.5 → 100 - 0.5*45 = 77.5 → rounds to 78
    expect(scoreBudget(1000, 2000, "save")).toBe(78);
  });

  it("scores at-budget rent at 55 (rent=2000, budget=2000)", () => {
    // ratio = 1 → 100 - 1*45 = 55
    expect(scoreBudget(2000, 2000, "save")).toBe(55);
  });

  it("drops fast when over budget", () => {
    // overRatio = 500/2000 = 0.25 → 55 - 0.25*55 = 41.25 → 41
    expect(scoreBudget(2500, 2000, "save")).toBe(41);
    // overRatio = 1 → 55 - 55 = 0
    expect(scoreBudget(4000, 2000, "save")).toBe(0);
  });

  it("returns 0 when budget is 0", () => {
    expect(scoreBudget(1500, 0, "save")).toBe(0);
  });

  it("returns 100 when rent is 0", () => {
    expect(scoreBudget(0, 2000, "save")).toBe(100);
  });
});

// ---------- scoreBudget with "spend" priority ----------

describe("scoreBudget with spend priority", () => {
  it("scores at-budget rent at 100 (rent=2000, budget=2000)", () => {
    // ratio = 1 → 10 + 1*90 = 100
    expect(scoreBudget(2000, 2000, "spend")).toBe(100);
  });

  it("scores cheap rent low (rent=0 → 10)", () => {
    expect(scoreBudget(0, 2000, "spend")).toBe(10);
  });

  it("scores mid-range appropriately (rent=1000, budget=2000 → 55)", () => {
    // ratio = 0.5 → 10 + 0.5*90 = 55
    expect(scoreBudget(1000, 2000, "spend")).toBe(55);
  });

  it("applies gentle over-budget penalty", () => {
    // overRatio = 500/2000 = 0.25 → 100 - 0.25*80 = 80
    expect(scoreBudget(2500, 2000, "spend")).toBe(80);
    // overRatio = 1 → 100 - 80 = 20
    expect(scoreBudget(4000, 2000, "spend")).toBe(20);
  });

  it("returns 0 when budget is 0", () => {
    expect(scoreBudget(1500, 0, "spend")).toBe(0);
  });
});

// ---------- applyMbtaBonus ----------

describe("applyMbtaBonus", () => {
  it("returns unchanged score when no preferred lines", () => {
    expect(applyMbtaBonus(75, ["red", "green"], [])).toBe(75);
  });

  it("gives full bonus when all preferred lines match", () => {
    // ratio = 1 → bonus = 5 + 10 = 15
    expect(applyMbtaBonus(75, ["red", "green"], ["red", "green"])).toBe(90);
  });

  it("gives partial bonus when some preferred lines match", () => {
    // ratio = 1/2 → bonus = 5 + 5 = 10
    expect(applyMbtaBonus(75, ["red"], ["red", "green"])).toBe(85);
  });

  it("applies 15% penalty when no preferred lines are served", () => {
    // 75 * 0.85 = 63.75
    expect(applyMbtaBonus(75, ["blue"], ["red", "green"])).toBeCloseTo(63.75, 1);
  });

  it("clamps bonus to 100", () => {
    expect(applyMbtaBonus(95, ["red"], ["red"])).toBe(100);
  });

  it("clamps penalty to 0", () => {
    expect(applyMbtaBonus(0, ["blue"], ["red"])).toBe(0);
  });
});

// ---------- applyUrbanAdjustment (additional coverage) ----------

describe("applyUrbanAdjustment extra cases", () => {
  it("strongly urban user + urban neighborhood → +12%", () => {
    // userUrban=1, neighborhoodUrban=1, distance=0 → +12%
    expect(applyUrbanAdjustment(80, 1, 1)).toBeCloseTo(89.6, 5);
  });

  it("strongly urban user + suburban neighborhood → penalty", () => {
    // userUrban=1, neighborhoodUrban=5, distance=4 → -15%
    expect(applyUrbanAdjustment(80, 1, 5)).toBeCloseTo(68, 5);
  });

  it("neutral user (slider=3) → no change", () => {
    expect(applyUrbanAdjustment(80, 3, 1)).toBe(80);
    expect(applyUrbanAdjustment(80, 3, 3)).toBe(80);
    expect(applyUrbanAdjustment(80, 3, 5)).toBe(80);
  });
});

// ---------- applyAgeAdjustment ----------

// Helper to build a minimal Neighborhood for age-adjustment tests
function makeNeighborhood(overrides: Partial<Neighborhood> = {}): Neighborhood {
  return {
    id: "test",
    name: "Test",
    region: "boston",
    description: "",
    localTips: "",
    rent: { studio: [1500, 2000], oneBr: [1800, 2200], twoBr: [2200, 2800] },
    safety: 60,
    safetyTrend: "stable",
    walkScore: 80,
    transitScore: 80,
    bikeScore: 60,
    lifestyleProfile: {
      nightlifeVsQuiet: 3,
      urbanVsSuburban: 3,
      trendyVsFamily: 3,
      communityVsPrivacy: 3,
    },
    communityScore: 70,
    amenities: { restaurants: 10, nightlife: 5, gyms: 3, grocery: 4, parks: 3 },
    mbtaLines: ["red"],
    mbtaStations: [{ line: "red", name: "Test Station" }],
    busRoutes: [],
    collegeArea: false,
    parkingFriendly: true,
    centroid: { lat: 42.35, lng: -71.06 },
    ...overrides,
  };
}

describe("applyAgeAdjustment", () => {
  it("boosts 21-25 with nightlife neighborhood", () => {
    const nightlifeHood = makeNeighborhood({
      lifestyleProfile: {
        nightlifeVsQuiet: 1, // strong nightlife
        urbanVsSuburban: 3,
        trendyVsFamily: 1, // trendy
        communityVsPrivacy: 3,
      },
    });
    // nightlife <=2: +6, trendy <=2: +4 → adjustment = 10 (capped)
    // 80 * 1.10 = 88
    expect(applyAgeAdjustment(80, "21-25", nightlifeHood)).toBeCloseTo(88, 5);
  });

  it("penalizes 36-40 with college area", () => {
    const collegeHood = makeNeighborhood({ collegeArea: true });
    // collegeArea: -8, no other triggers → adjustment = -8
    // 80 * 0.92 = 73.6
    expect(applyAgeAdjustment(80, "36-40", collegeHood)).toBeCloseTo(73.6, 5);
  });

  it("returns unchanged score for 26-29 age group", () => {
    const anyHood = makeNeighborhood({
      lifestyleProfile: {
        nightlifeVsQuiet: 1,
        urbanVsSuburban: 1,
        trendyVsFamily: 1,
        communityVsPrivacy: 1,
      },
      collegeArea: true,
    });
    // 26-29 has no adjustments in the code
    expect(applyAgeAdjustment(80, "26-29", anyHood)).toBe(80);
  });

  it("clamps adjustment to ±10%", () => {
    // 36-40 with quiet + family + safe + no college → 7+6+4 = 17, clamped to 10
    const quietSafeHood = makeNeighborhood({
      lifestyleProfile: {
        nightlifeVsQuiet: 5,
        urbanVsSuburban: 3,
        trendyVsFamily: 5,
        communityVsPrivacy: 3,
      },
      safety: 80,
    });
    // clamped to +10 → 70 * 1.10 = 77
    expect(applyAgeAdjustment(70, "36-40", quietSafeHood)).toBeCloseTo(77, 5);
  });

  it("clamps result between 0 and 100", () => {
    const nightlifeHood = makeNeighborhood({
      lifestyleProfile: {
        nightlifeVsQuiet: 1,
        urbanVsSuburban: 3,
        trendyVsFamily: 1,
        communityVsPrivacy: 3,
      },
    });
    expect(applyAgeAdjustment(98, "21-25", nightlifeHood)).toBeLessThanOrEqual(100);
    expect(applyAgeAdjustment(2, "36-40", makeNeighborhood({ collegeArea: true }))).toBeGreaterThanOrEqual(0);
  });
});

// ---------- computeMatchScoresTopsis ----------

describe("computeMatchScoresTopsis", () => {
  const equalWeights: ScoringWeights = {
    budget: 0.2,
    commute: 0.2,
    safety: 0.2,
    lifestyle: 0.2,
    community: 0.2,
  };

  it("returns [100] for a single neighborhood", () => {
    const scores: DimensionScores[] = [
      { budget: 80, commute: 60, safety: 70, lifestyle: 90, community: 75 },
    ];
    expect(computeMatchScoresTopsis(scores, equalWeights)).toEqual([100]);
  });

  it("returns empty array for empty input", () => {
    expect(computeMatchScoresTopsis([], equalWeights)).toEqual([]);
  });

  it("ranks a clearly better neighborhood higher", () => {
    const scores: DimensionScores[] = [
      { budget: 90, commute: 90, safety: 90, lifestyle: 90, community: 90 }, // great
      { budget: 20, commute: 20, safety: 20, lifestyle: 20, community: 20 }, // poor
    ];
    const result = computeMatchScoresTopsis(scores, equalWeights);
    expect(result[0]).toBe(100); // best gets 100
    expect(result[1]).toBe(0);   // worst gets 0
  });

  it("gives equal scores to identical neighborhoods", () => {
    const scores: DimensionScores[] = [
      { budget: 70, commute: 70, safety: 70, lifestyle: 70, community: 70 },
      { budget: 70, commute: 70, safety: 70, lifestyle: 70, community: 70 },
    ];
    const result = computeMatchScoresTopsis(scores, equalWeights);
    expect(result[0]).toBe(result[1]);
    expect(result[0]).toBe(50); // identical → closeness = 0.5
  });

  it("handles three neighborhoods with mixed scores", () => {
    const scores: DimensionScores[] = [
      { budget: 100, commute: 100, safety: 100, lifestyle: 100, community: 100 },
      { budget: 50, commute: 50, safety: 50, lifestyle: 50, community: 50 },
      { budget: 0, commute: 0, safety: 0, lifestyle: 0, community: 0 },
    ];
    const result = computeMatchScoresTopsis(scores, equalWeights);
    expect(result[0]).toBeGreaterThan(result[1]);
    expect(result[1]).toBeGreaterThan(result[2]);
    expect(result[0]).toBe(100);
    expect(result[2]).toBe(0);
  });

  it("respects weights — high budget weight favors budget-strong neighborhood", () => {
    const budgetHeavy: ScoringWeights = {
      budget: 0.8,
      commute: 0.05,
      safety: 0.05,
      lifestyle: 0.05,
      community: 0.05,
    };
    const scores: DimensionScores[] = [
      { budget: 100, commute: 20, safety: 20, lifestyle: 20, community: 20 }, // great budget
      { budget: 20, commute: 100, safety: 100, lifestyle: 100, community: 100 }, // great everything else
    ];
    const result = computeMatchScoresTopsis(scores, budgetHeavy);
    expect(result[0]).toBeGreaterThan(result[1]);
  });
});
