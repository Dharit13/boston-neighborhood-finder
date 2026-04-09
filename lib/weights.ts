import type { SliderValues, ScoringWeights } from "./types";

export function deriveWeights(
  sliders: SliderValues,
  hasOffice: boolean
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

  // Split preference: lifestyle vs community (slider 4 influences)
  const communityBias = (5 - sliders.communityVsPrivacy) / 4; // 0-1
  const communityRatio = 0.3 + communityBias * 0.4;
  const lifestyleRaw = preferenceWeight * (1 - communityRatio);
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
