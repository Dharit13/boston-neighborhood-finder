import { deriveWeights } from "@/lib/weights";
import type { SliderValues } from "@/lib/types";

describe("deriveWeights", () => {
  it("gives equal budget and commute weight when slider 5 is centered", () => {
    const sliders: SliderValues = {
      nightlifeVsQuiet: 3,
      urbanVsSuburban: 3,
      trendyVsFamily: 3,
      communityVsPrivacy: 3,
      budgetVsConvenience: 3,
    };
    const weights = deriveWeights(sliders, true);
    expect(weights.budget).toBeCloseTo(weights.commute, 1);
    expect(weights.safety).toBe(0.15);
  });

  it("prioritizes budget when slider 5 is all the way left", () => {
    const sliders: SliderValues = {
      nightlifeVsQuiet: 3,
      urbanVsSuburban: 3,
      trendyVsFamily: 3,
      communityVsPrivacy: 3,
      budgetVsConvenience: 1,
    };
    const weights = deriveWeights(sliders, true);
    expect(weights.budget).toBeGreaterThan(weights.commute);
  });

  it("prioritizes commute when slider 5 is all the way right", () => {
    const sliders: SliderValues = {
      nightlifeVsQuiet: 3,
      urbanVsSuburban: 3,
      trendyVsFamily: 3,
      communityVsPrivacy: 3,
      budgetVsConvenience: 5,
    };
    const weights = deriveWeights(sliders, true);
    expect(weights.commute).toBeGreaterThan(weights.budget);
  });

  it("increases lifestyle weight when sliders have strong preferences", () => {
    const neutral: SliderValues = {
      nightlifeVsQuiet: 3,
      urbanVsSuburban: 3,
      trendyVsFamily: 3,
      communityVsPrivacy: 3,
      budgetVsConvenience: 3,
    };
    const strong: SliderValues = {
      nightlifeVsQuiet: 1,
      urbanVsSuburban: 1,
      trendyVsFamily: 5,
      communityVsPrivacy: 1,
      budgetVsConvenience: 3,
    };
    const neutralWeights = deriveWeights(neutral, true);
    const strongWeights = deriveWeights(strong, true);
    expect(strongWeights.lifestyle + strongWeights.community).toBeGreaterThan(
      neutralWeights.lifestyle + neutralWeights.community
    );
  });

  it("all weights sum to 1.0", () => {
    const sliders: SliderValues = {
      nightlifeVsQuiet: 2,
      urbanVsSuburban: 4,
      trendyVsFamily: 1,
      communityVsPrivacy: 5,
      budgetVsConvenience: 2,
    };
    const weights = deriveWeights(sliders, true);
    const sum =
      weights.budget +
      weights.commute +
      weights.safety +
      weights.lifestyle +
      weights.community;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("zeros commute weight when hasOffice is false", () => {
    const sliders: SliderValues = {
      nightlifeVsQuiet: 3,
      urbanVsSuburban: 3,
      trendyVsFamily: 3,
      communityVsPrivacy: 3,
      budgetVsConvenience: 3,
    };
    const weights = deriveWeights(sliders, false);
    expect(weights.commute).toBe(0);
    const sum =
      weights.budget +
      weights.commute +
      weights.safety +
      weights.lifestyle +
      weights.community;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});
