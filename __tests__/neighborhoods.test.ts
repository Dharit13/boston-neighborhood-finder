import { getPerPersonRent } from "@/lib/neighborhoods";
import type { Neighborhood } from "@/lib/types";

const fakeNeighborhood = {
  rent: {
    studio: [2000, 2400],
    oneBr: [3000, 3600],
    twoBr: [4200, 4800],
  },
} as unknown as Neighborhood;

// oneBrMid = 3300, twoBrMid = 4500
describe("getPerPersonRent", () => {
  it("uses 2BR mid split across 2 people for own-room + 1 roommate", () => {
    // 4500 / 2 = 2250
    expect(getPerPersonRent(fakeNeighborhood, 1, "own-room")).toBe(2250);
  });

  it("uses 1BR mid split across 2 people for shared-room + 1 roommate", () => {
    // bedrooms = ceil(2 / 2) = 1 → 3300 / 2 = 1650
    expect(getPerPersonRent(fakeNeighborhood, 1, "shared-room")).toBe(1650);
  });

  it("uses 2BR mid split across 4 people for shared-room + 3 roommates", () => {
    // bedrooms = ceil(4 / 2) = 2 → 4500 / 4 = 1125
    expect(getPerPersonRent(fakeNeighborhood, 3, "shared-room")).toBe(1125);
  });

  it("returns full household rent for couples (no split)", () => {
    // 1BR mid = 3300
    expect(getPerPersonRent(fakeNeighborhood, 1, "couple", "1br")).toBe(3300);
  });

  it("returns studio mid for alone + studio", () => {
    // (2000 + 2400) / 2 = 2200
    expect(getPerPersonRent(fakeNeighborhood, 0, "alone", "studio")).toBe(2200);
  });

  it("returns 2BR mid for alone + 2br (no split, single occupant)", () => {
    // (4200 + 4800) / 2 = 4500, no split
    expect(getPerPersonRent(fakeNeighborhood, 0, "alone", "2br")).toBe(4500);
  });
});
