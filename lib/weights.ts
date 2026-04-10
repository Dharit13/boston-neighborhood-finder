import type { SliderValues, ScoringWeights, BudgetPriority } from "./types";

export function deriveWeights(
  sliders: SliderValues,
  hasOffice: boolean,
  budgetPriority: BudgetPriority = "balanced"
): ScoringWeights {
  const SAFETY_BASELINE = 0.15;
  const remaining = 1.0 - SAFETY_BASELINE;

  // How strong are the lifestyle/community preferences? (deviation from center)
  const deviations = [
    Math.abs(sliders.nightlifeVsQuiet - 3),
    Math.abs(sliders.urbanVsSuburban - 3),
    Math.abs(sliders.trendyVsFamily - 3),
    Math.abs(sliders.communityVsPrivacy - 3),
  ];
  const avgDeviation = deviations.reduce((a, b) => a + b, 0) / 4; // 0-2
  const lifestyleStrength = avgDeviation / 2; // 0-1

  // Split remaining between practical (budget+commute) and preference (lifestyle+community)
  const preferenceShare = 0.15 + lifestyleStrength * 0.3; // 0.15 to 0.45
  const practicalWeight = remaining * (1.0 - preferenceShare);
  const preferenceWeight = remaining * preferenceShare;

  // Split practical: budget vs commute via slider 5
  const commuteRatio = hasOffice ? (sliders.budgetVsConvenience - 1) / 4 : 0;
  let budgetRaw = practicalWeight * (1 - commuteRatio);
  let commuteRaw = practicalWeight * commuteRatio;

  // Budget priority adjustment:
  // "save" → budget weight stays high (default behavior)
  // "balanced" → no change
  // "spend" → budget weight drops significantly, redistributed to lifestyle/commute
  if (budgetPriority === "spend") {
    // Cut budget weight by 70%, redistribute to other dimensions
    const budgetReduction = budgetRaw * 0.7;
    budgetRaw -= budgetReduction;
    // Give most of the freed weight to lifestyle, some to commute
    commuteRaw += budgetReduction * 0.3;
    // The rest goes to preference via scaling below
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

  // For "spend" mode, boost lifestyle weight with the freed budget weight
  if (budgetPriority === "spend") {
    const budgetFreed = practicalWeight * (1 - commuteRatio) * 0.7 * 0.7;
    lifestyleRaw += budgetFreed;
  }

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
