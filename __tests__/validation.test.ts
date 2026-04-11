import {
  parseMoneyInput,
  validateMonthlyIncome,
  validateMaxRent,
  isMonthlyIncomeValid,
  isMaxRentValid,
} from "@/lib/validation";

describe("parseMoneyInput", () => {
  it("strips commas and currency formatting", () => {
    expect(parseMoneyInput("$5,000")).toBe(5000);
  });

  it("rejects letters and scientific notation", () => {
    expect(parseMoneyInput("5e10")).toBe(510);
    expect(parseMoneyInput("abc1234xyz")).toBe(1234);
  });

  it("returns 0 for empty input", () => {
    expect(parseMoneyInput("")).toBe(0);
    expect(parseMoneyInput("$")).toBe(0);
  });

  it("caps absurdly long input to 9 digits", () => {
    expect(parseMoneyInput("123456789012345")).toBe(123456789);
  });
});

describe("validateMonthlyIncome", () => {
  it("accepts 0 (not yet filled in)", () => {
    expect(validateMonthlyIncome(0)).toBeNull();
  });

  it("rejects values below the floor", () => {
    expect(validateMonthlyIncome(100)).toMatch(/at least/);
  });

  it("accepts a normal salary", () => {
    expect(validateMonthlyIncome(6500)).toBeNull();
  });

  it("rejects values above the ceiling", () => {
    expect(validateMonthlyIncome(500_000)).toMatch(/under/);
  });
});

describe("validateMaxRent", () => {
  it("accepts 0 (not yet filled in)", () => {
    expect(validateMaxRent(0, 5000)).toBeNull();
  });

  it("rejects values below the floor", () => {
    expect(validateMaxRent(200, 5000)).toMatch(/at least/);
  });

  it("rejects rent that meets or exceeds income", () => {
    expect(validateMaxRent(5000, 5000)).toMatch(/less than/);
    expect(validateMaxRent(6000, 5000)).toMatch(/less than/);
  });

  it("accepts a sensible rent below income", () => {
    expect(validateMaxRent(2500, 6000)).toBeNull();
  });

  it("does not reference income when income is 0 (not yet entered)", () => {
    expect(validateMaxRent(2500, 0)).toBeNull();
  });
});

describe("convenience helpers", () => {
  it("isMonthlyIncomeValid requires non-zero", () => {
    expect(isMonthlyIncomeValid(0)).toBe(false);
    expect(isMonthlyIncomeValid(6000)).toBe(true);
  });

  it("isMaxRentValid requires non-zero and a valid pair", () => {
    expect(isMaxRentValid(0, 6000)).toBe(false);
    expect(isMaxRentValid(2500, 6000)).toBe(true);
    expect(isMaxRentValid(7000, 6000)).toBe(false);
  });
});
