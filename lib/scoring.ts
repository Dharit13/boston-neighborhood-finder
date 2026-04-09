import type {
  DimensionScores,
  ScoringWeights,
  LifestyleProfile,
  MbtaLine,
} from "./types";

export function scoreBudget(
  medianRent: number,
  budget: number,
  hasCar: boolean,
  parkingCost: number
): number {
  const effectiveRent = hasCar ? medianRent + parkingCost : medianRent;
  if (effectiveRent <= budget) return 100;
  const overBudgetRatio = (effectiveRent - budget) / budget;
  return Math.max(0, Math.round(100 - overBudgetRatio * 100));
}

export function scoreCommute(minutes: number | null): number {
  if (minutes === null) return 0;
  if (minutes >= 75) return 0;

  // Piecewise linear: 5→100, 15→90, 30→70, 45→45, 60→20, 75→0
  // Walking distance (<10 min) is significantly rewarded over transit commutes
  const breakpoints = [
    { min: 5, score: 100 },
    { min: 15, score: 90 },
    { min: 30, score: 70 },
    { min: 45, score: 45 },
    { min: 60, score: 20 },
    { min: 75, score: 0 },
  ];

  if (minutes <= breakpoints[0].min) return 100;

  for (let i = 0; i < breakpoints.length - 1; i++) {
    const curr = breakpoints[i];
    const next = breakpoints[i + 1];
    if (minutes >= curr.min && minutes <= next.min) {
      const ratio = (minutes - curr.min) / (next.min - curr.min);
      return Math.round(curr.score + ratio * (next.score - curr.score));
    }
  }
  return 0;
}

export function scoreSafety(safetyScore: number): number {
  return safetyScore;
}

export function scoreLifestyle(
  userSliders: LifestyleProfile,
  neighborhoodProfile: LifestyleProfile
): number {
  const dims: (keyof LifestyleProfile)[] = [
    "nightlifeVsQuiet",
    "urbanVsSuburban",
    "trendyVsFamily",
    "communityVsPrivacy",
  ];
  const totalDistance = dims.reduce((sum, dim) => {
    return sum + Math.abs(userSliders[dim] - neighborhoodProfile[dim]);
  }, 0);
  const maxDistance = 4 * 4;
  return Math.round(((maxDistance - totalDistance) / maxDistance) * 100);
}

export function scoreCommunity(communityScore: number): number {
  return communityScore;
}

export function computeMatchScore(
  scores: DimensionScores,
  weights: ScoringWeights
): number {
  return (
    scores.budget * weights.budget +
    scores.commute * weights.commute +
    scores.safety * weights.safety +
    scores.lifestyle * weights.lifestyle +
    scores.community * weights.community
  );
}

export function applyMbtaBonus(
  baseScore: number,
  neighborhoodLines: MbtaLine[],
  preferredLines: MbtaLine[]
): number {
  if (preferredLines.length === 0) return baseScore;
  const hasPreferred = preferredLines.some((line) =>
    neighborhoodLines.includes(line)
  );
  return hasPreferred ? Math.min(100, baseScore + 10) : baseScore;
}
