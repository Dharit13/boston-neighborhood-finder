import { calculateBudgetTiers } from "@/lib/budget";

describe("calculateBudgetTiers", () => {
  it("calculates correct tiers for $5000 income with $3000 max", () => {
    const tiers = calculateBudgetTiers(5000, 3000);
    expect(tiers.saver).toBe(2250); // 45% of 5000
    expect(tiers.balanced).toBe(3000); // 60% of 5000
    expect(tiers.stretched).toBe(3000); // user max
  });

  it("caps balanced tier at user max when max is below 60%", () => {
    const tiers = calculateBudgetTiers(5000, 2500);
    expect(tiers.saver).toBe(2250);
    expect(tiers.balanced).toBe(2500); // capped at max
    expect(tiers.stretched).toBe(2500);
  });

  it("caps saver tier at user max when max is below 45%", () => {
    const tiers = calculateBudgetTiers(5000, 2000);
    expect(tiers.saver).toBe(2000); // capped at max
    expect(tiers.balanced).toBe(2000);
    expect(tiers.stretched).toBe(2000);
  });
});

