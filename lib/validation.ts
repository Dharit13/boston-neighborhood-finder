// Shared validation for the money fields in the wizard.
//
// All values are whole-dollar monthly amounts. Bounds are deliberately wide
// — we want to catch typos like an extra zero, not police what people earn.

export const MIN_MONTHLY_INCOME = 500;
export const MAX_MONTHLY_INCOME = 100_000;

export const MIN_MAX_RENT = 500;
export const MAX_MAX_RENT = 20_000;

/**
 * Strip everything except digits from raw input. We use this in `onChange`
 * so a `type="text"` field with `inputMode="numeric"` still rejects letters,
 * decimals, scientific notation, etc. Returns 0 for empty input so callers
 * can keep their existing `value > 0` checks.
 */
export function parseMoneyInput(raw: string): number {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits === "") return 0;
  // Cap at 9 digits so a stuck key can't push us into Number.MAX overflow.
  return parseInt(digits.slice(0, 9), 10);
}

/**
 * Returns null when the value is valid (or empty / 0, which is "not yet
 * filled in" — surfacing a "too low" error before the user finishes typing
 * is annoying). Returns a human-readable error string otherwise.
 */
export function validateMonthlyIncome(value: number): string | null {
  if (value === 0) return null;
  if (value < MIN_MONTHLY_INCOME) {
    return `Income should be at least $${MIN_MONTHLY_INCOME.toLocaleString()}/month`;
  }
  if (value > MAX_MONTHLY_INCOME) {
    return `Income should be under $${MAX_MONTHLY_INCOME.toLocaleString()}/month`;
  }
  return null;
}

export function validateMaxRent(
  value: number,
  monthlyIncome: number
): string | null {
  if (value === 0) return null;
  if (value < MIN_MAX_RENT) {
    return `Rent should be at least $${MIN_MAX_RENT.toLocaleString()}/month`;
  }
  if (value > MAX_MAX_RENT) {
    return `Rent should be under $${MAX_MAX_RENT.toLocaleString()}/month`;
  }
  if (monthlyIncome > 0 && value >= monthlyIncome) {
    return "Rent should be less than your monthly income";
  }
  return null;
}

/** Convenience: true when both inputs pass and both are non-zero. */
export function isMonthlyIncomeValid(value: number): boolean {
  return value > 0 && validateMonthlyIncome(value) === null;
}

export function isMaxRentValid(value: number, monthlyIncome: number): boolean {
  return value > 0 && validateMaxRent(value, monthlyIncome) === null;
}
