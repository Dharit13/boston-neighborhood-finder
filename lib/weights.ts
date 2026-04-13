import type { SliderValues, ScoringWeights, BudgetPriority } from "./types";

export function deriveWeights(
  sliders: SliderValues,
  hasOffice: boolean,
  budgetPriority: BudgetPriority = "balanced",
  lifestyleStrengthOverride?: number
): ScoringWeights {
  const SAFETY_BASELINE = 0.15;
  const remaining = 1.0 - SAFETY_BASELINE;

  // How strong are the lifestyle/community preferences? (deviation from center)
  // When multi-vibe is used, the averaged sliders drift toward center,
  // understating how opinionated the user is. The caller can pass the
  // pre-averaged strength so that two "urban" vibes still yield high
  // lifestyle weight even though the average is closer to 3.
  let lifestyleStrength: number;
  if (lifestyleStrengthOverride !== undefined) {
    lifestyleStrength = lifestyleStrengthOverride;
  } else {
    const deviations = [
      Math.abs(sliders.nightlifeVsQuiet - 3),
      Math.abs(sliders.urbanVsSuburban - 3),
      Math.abs(sliders.trendyVsFamily - 3),
      Math.abs(sliders.communityVsPrivacy - 3),
    ];
    const avgDeviation = deviations.reduce((a, b) => a + b, 0) / 4; // 0-2
    lifestyleStrength = avgDeviation / 2; // 0-1
  }

  // Split remaining between practical (budget+commute) and preference (lifestyle+community)
  const preferenceShare = 0.15 + lifestyleStrength * 0.3; // 0.15 to 0.45
  const practicalWeight = remaining * (1.0 - preferenceShare);
  const preferenceWeight = remaining * preferenceShare;

  // Split practical: budget vs commute via slider 5
  const commuteRatio = hasOffice ? (sliders.budgetVsConvenience - 1) / 4 : 0;
  let budgetRaw = practicalWeight * (1 - commuteRatio);
  let commuteRaw = practicalWeight * commuteRatio;

  // Budget priority adjustment:
  // "save"  → boost budget weight (cheap = good)
  // "balanced" → no change
  // "spend" → boost budget weight (expensive = good, since scoreBudget
  //           rewards higher rent in spend mode)
  if (budgetPriority === "spend") {
    // Boost budget weight by 20% so the "reward expensive" scoring
    // curve actually moves premium neighborhoods to the top
    const budgetBoost = practicalWeight * 0.1;
    budgetRaw += budgetBoost;
  } else if (budgetPriority === "save") {
    // Boost budget weight by 30%, taking from lifestyle
    const budgetBoost = practicalWeight * 0.15;
    budgetRaw += budgetBoost;
  }

  // Split preference: lifestyle vs community (slider 4 influences)
  const communityBias = (5 - sliders.communityVsPrivacy) / 4; // 0-1
  const communityRatio = 0.3 + communityBias * 0.4;
  let lifestyleRaw = preferenceWeight * (1 - communityRatio);
  const communityRaw = preferenceWeight * communityRatio;

  // Normalize to ensure sum = 1.0
  const rawTotal = budgetRaw + commuteRaw + lifestyleRaw + communityRaw;
  const scale = remaining / rawTotal;

  return {
    budget: budgetRaw * scale,
    commute: commuteRaw * scale,
    safety: SAFETY_BASELINE,
    lifestyle: lifestyleRaw * scale,
    community: communityRaw * scale,
  };
}
