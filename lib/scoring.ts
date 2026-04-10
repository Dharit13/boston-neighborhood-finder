import type {
  DimensionScores,
  ScoringWeights,
  LifestyleProfile,
  MbtaLine,
  BudgetPriority,
  AgeGroup,
  Neighborhood,
} from "./types";

/**
 * Score a neighborhood's affordability based on budget priority.
 *
 * - "save": Cheaper = better. Rent at 50% of budget → 100, at budget → 60, over → drops to 0.
 *   This creates a gradient that rewards saving money.
 * - "balanced": Under budget → 100, over budget → drops linearly to 0.
 * - "spend": Under budget → 100 (don't care about cost as long as it fits).
 *   Budget weight is also slashed in the weight derivation.
 */
export function scoreBudget(
  medianRent: number,
  budget: number,
  budgetPriority: BudgetPriority = "balanced"
): number {
  const effectiveRent = medianRent;

  if (budgetPriority === "save") {
    // Gradient: cheaper is better, even within budget
    // 0% of budget → 100, 50% → 85, 75% → 70, 100% → 55, over → drops fast
    if (effectiveRent <= 0) return 100;
    const ratio = effectiveRent / budget; // 0 to 1+
    if (ratio <= 1) {
      // Within budget: 100 → 55 as ratio goes 0 → 1
      return Math.round(100 - ratio * 45);
    }
    // Over budget: 55 → 0
    const overRatio = (effectiveRent - budget) / budget;
    return Math.max(0, Math.round(55 - overRatio * 55));
  }

  if (budgetPriority === "spend") {
    // User wants quality — higher rent (closer to budget) = better neighborhood
    // 0% of budget → 65, 50% → 82, 100% → 100
    if (effectiveRent <= 0) return 65;
    if (effectiveRent <= budget) {
      const ratio = effectiveRent / budget;
      return Math.round(65 + ratio * 35);
    }
    // Still penalize over-budget, but gently
    const overRatio = (effectiveRent - budget) / budget;
    return Math.max(0, Math.round(100 - overRatio * 80));
  }

  // "balanced" (default): binary pass/fail at budget line
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

/**
 * TOPSIS (Technique for Order Preference by Similarity to Ideal Solution)
 *
 * Instead of a simple weighted sum, TOPSIS ranks alternatives by their
 * geometric distance to the ideal solution (best on every criterion)
 * and anti-ideal solution (worst on every criterion).
 *
 * This handles tradeoffs better: a neighborhood that excels on 4 dimensions
 * but is weak on 1 will rank higher than one that's mediocre across all 5.
 *
 * Steps:
 *  1. Build decision matrix (alternatives × criteria)
 *  2. Normalize via vector normalization (divide by column norm)
 *  3. Apply weights to normalized matrix
 *  4. Identify ideal (max per column) and anti-ideal (min per column)
 *  5. Compute Euclidean distance to ideal and anti-ideal for each alternative
 *  6. Closeness coefficient = dist_anti / (dist_ideal + dist_anti)  → 0-1
 *
 * Returns array of match scores (0-100) in the same order as input.
 */
export function computeMatchScoresTopsis(
  allScores: DimensionScores[],
  weights: ScoringWeights
): number[] {
  const n = allScores.length;
  if (n === 0) return [];
  if (n === 1) return [100]; // Single alternative is always the best match

  const dimensions: (keyof DimensionScores)[] = [
    "budget",
    "commute",
    "safety",
    "lifestyle",
    "community",
  ];
  const w = [
    weights.budget,
    weights.commute,
    weights.safety,
    weights.lifestyle,
    weights.community,
  ];

  // Step 1: Build decision matrix (n × 5)
  const matrix: number[][] = allScores.map((s) =>
    dimensions.map((d) => s[d])
  );

  // Step 2: Vector normalization — divide each value by column's L2 norm
  const norms = dimensions.map((_, j) => {
    const sumSq = matrix.reduce((acc, row) => acc + row[j] * row[j], 0);
    return Math.sqrt(sumSq);
  });

  const normalized: number[][] = matrix.map((row) =>
    row.map((val, j) => (norms[j] === 0 ? 0 : val / norms[j]))
  );

  // Step 3: Apply weights
  const weighted: number[][] = normalized.map((row) =>
    row.map((val, j) => val * w[j])
  );

  // Step 4: Ideal (max) and anti-ideal (min) per criterion
  // All criteria are "benefit" type (higher = better), so ideal = max
  const ideal = dimensions.map((_, j) =>
    Math.max(...weighted.map((row) => row[j]))
  );
  const antiIdeal = dimensions.map((_, j) =>
    Math.min(...weighted.map((row) => row[j]))
  );

  // Step 5: Euclidean distances
  const distIdeal = weighted.map((row) =>
    Math.sqrt(row.reduce((acc, val, j) => acc + (val - ideal[j]) ** 2, 0))
  );
  const distAntiIdeal = weighted.map((row) =>
    Math.sqrt(
      row.reduce((acc, val, j) => acc + (val - antiIdeal[j]) ** 2, 0)
    )
  );

  // Step 6: Closeness coefficient (0–1), scaled to 0–100
  return distIdeal.map((dI, i) => {
    const dA = distAntiIdeal[i];
    if (dI + dA === 0) return 50; // All alternatives identical
    const closeness = dA / (dI + dA);
    return Math.round(closeness * 100);
  });
}

/** @deprecated Use computeMatchScoresTopsis for ranking. Kept for reference. */
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

/**
 * Nudge the final match score based on age group. Keeps the adjustment modest
 * (±10% max) so the user's explicit sliders still dominate the ranking.
 *
 * - 21-25: young professionals — reward nightlife, trendy, college-adjacent areas
 * - 26-29: no adjustment (balanced default)
 * - 30-35: reward quieter, family-leaning, safer areas; penalize heavy college zones
 */
export function applyAgeAdjustment(
  baseScore: number,
  ageGroup: AgeGroup,
  neighborhood: Neighborhood
): number {
  let adjustment = 0; // percentage points

  if (ageGroup === "21-25") {
    if (neighborhood.lifestyleProfile.nightlifeVsQuiet <= 2) adjustment += 6;
    if (neighborhood.lifestyleProfile.trendyVsFamily <= 2) adjustment += 4;
    if (neighborhood.collegeArea) adjustment += 4;
    if (neighborhood.lifestyleProfile.nightlifeVsQuiet >= 4) adjustment -= 4;
  } else if (ageGroup === "30-35") {
    if (neighborhood.lifestyleProfile.nightlifeVsQuiet >= 4) adjustment += 5;
    if (neighborhood.lifestyleProfile.trendyVsFamily >= 4) adjustment += 4;
    if (neighborhood.safety >= 75) adjustment += 3;
    if (neighborhood.collegeArea) adjustment -= 6;
  }

  adjustment = Math.max(-10, Math.min(10, adjustment));
  const adjusted = baseScore * (1 + adjustment / 100);
  return Math.max(0, Math.min(100, adjusted));
}
