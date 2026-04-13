import type { BudgetTiers } from "./types";

export function calculateBudgetTiers(
  monthlyIncome: number,
  maxRent: number
): BudgetTiers {
  // maxRent is the rent the user would normally pay (balanced tier).
  // Save Money = 45% of income (capped at what they entered).
  // Best Fit = 70% of income (stretch above what they entered).
  const saverRaw = Math.round(monthlyIncome * 0.45);
  const stretchedRaw = Math.round(monthlyIncome * 0.7);

  return {
    saver: Math.min(saverRaw, maxRent),
    balanced: maxRent,
    stretched: Math.max(stretchedRaw, maxRent),
  };
}

export function getActiveTiers(
  monthlyIncome: number,
  maxRent: number
): ("saver" | "balanced" | "stretched")[] {
  const saver45 = Math.round(monthlyIncome * 0.45);
  const stretched70 = Math.round(monthlyIncome * 0.7);

  const tiers: ("saver" | "balanced" | "stretched")[] = [];

  // Only show Save Money if 45% of income is meaningfully less than entered rent
  if (saver45 < maxRent - 50) tiers.push("saver");

  tiers.push("balanced");

  // Only show Best Fit if 70% of income is meaningfully more than entered rent
  if (stretched70 > maxRent + 50) tiers.push("stretched");

  return tiers;
}

export function getRentAsPercentOfIncome(
  rent: number,
  monthlyIncome: number
): number {
  if (monthlyIncome === 0) return 0;
  return Math.round((rent / monthlyIncome) * 100);
}
