import type { BudgetTiers } from "./types";

export function calculateBudgetTiers(
  monthlyIncome: number,
  maxRent: number
): BudgetTiers {
  const saverRaw = Math.round(monthlyIncome * 0.45);
  const balancedRaw = Math.round(monthlyIncome * 0.6);

  return {
    saver: Math.min(saverRaw, maxRent),
    balanced: Math.min(balancedRaw, maxRent),
    stretched: maxRent,
  };
}

export function calculatePerPersonBudget(
  totalBudget: number,
  roommates: number
): number {
  return Math.round(totalBudget / (roommates + 1));
}

export function getActiveTiers(
  monthlyIncome: number,
  maxRent: number
): ("saver" | "balanced" | "stretched")[] {
  const saver45 = Math.round(monthlyIncome * 0.45);
  const balanced60 = Math.round(monthlyIncome * 0.6);

  // Always return 3 tiers — if balanced/stretched collapse to the same
  // budget, the recommendation engine handles deduplication
  if (maxRent < saver45) return ["stretched"];
  if (maxRent < balanced60) {
    // Saver and stretched are distinct; add balanced even if it equals stretched
    // so we always try to recommend 3 neighborhoods
    return ["saver", "balanced", "stretched"];
  }
  return ["saver", "balanced", "stretched"];
}

export function getRentAsPercentOfIncome(
  rent: number,
  monthlyIncome: number
): number {
  if (monthlyIncome === 0) return 0;
  return Math.round((rent / monthlyIncome) * 100);
}
