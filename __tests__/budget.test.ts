import { calculateBudgetTiers } from "@/lib/budget";

describe("calculateBudgetTiers", () => {
  it("calculates correct tiers for $5000 income with $3000 rent", () => {
    const tiers = calculateBudgetTiers(5000, 3000);
    expect(tiers.saver).toBe(2250); // 45% of 5000
    expect(tiers.balanced).toBe(3000); // entered rent
    expect(tiers.stretched).toBe(3450); // min(3000*1.15=3450, 5000*0.7=3500) = 3450
  });

  it("caps stretched at 70% of income when that is lower than 115% of rent", () => {
    // 70% of 4000 = 2800, 115% of 2500 = 2875 → stretched = 2800
    const tiers = calculateBudgetTiers(4000, 2500);
    expect(tiers.saver).toBe(1800); // 45% of 4000
    expect(tiers.balanced).toBe(2500);
    expect(tiers.stretched).toBe(2800);
  });

  it("caps saver tier at entered rent when rent is below 45%", () => {
    const tiers = calculateBudgetTiers(5000, 2000);
    expect(tiers.saver).toBe(2000); // capped at rent
    expect(tiers.balanced).toBe(2000);
    expect(tiers.stretched).toBe(2300); // min(2000*1.15=2300, 5000*0.7=3500) = 2300
  });

  it("stretched equals balanced when 115% and 70% are both at or below rent", () => {
    // income=3000, rent=2500 → 70%=2100 < rent, 115%=2875 > rent
    // stretched = max(min(2875,2100), 2500) = max(2100, 2500) = 2500
    const tiers = calculateBudgetTiers(3000, 2500);
    expect(tiers.saver).toBe(1350);
    expect(tiers.balanced).toBe(2500);
    expect(tiers.stretched).toBe(2500); // both caps below rent, so stays at rent
  });
});
