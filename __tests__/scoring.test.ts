import {
  scoreBudget,
  scoreCommute,
  scoreSafety,
  scoreLifestyle,
  scoreCommunity,
  computeMatchScore,
} from "@/lib/scoring";
import type {
  DimensionScores,
  ScoringWeights,
  LifestyleProfile,
} from "@/lib/types";

describe("scoreBudget", () => {
  it("returns 100 when rent is at or below budget", () => {
    expect(scoreBudget(1500, 2000, false, 0)).toBe(100);
  });

  it("returns 100 when rent equals budget", () => {
    expect(scoreBudget(2000, 2000, false, 0)).toBe(100);
  });

  it("scales down linearly when rent exceeds budget", () => {
    expect(scoreBudget(2500, 2000, false, 0)).toBe(75);
  });

  it("returns 0 when rent is double the budget", () => {
    expect(scoreBudget(4000, 2000, false, 0)).toBe(0);
  });

  it("adds parking cost when user has car", () => {
    expect(scoreBudget(1800, 2000, true, 200)).toBe(100);
    expect(scoreBudget(2000, 2000, true, 200)).toBe(90);
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
