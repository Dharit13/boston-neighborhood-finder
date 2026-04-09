// --- User Input Types ---

export type AgeGroup = "18-24" | "25-30" | "31-40" | "41-50" | "50+";

export type OfficeDays = 0 | 1 | 2 | 3 | 4 | 5;

export type MbtaLine = "red" | "green" | "blue" | "orange" | "silver" | "bus" | "ferry";

export interface SliderValues {
  nightlifeVsQuiet: number; // 1-5 (1=nightlife, 5=quiet)
  urbanVsSuburban: number; // 1-5 (1=urban, 5=suburban)
  trendyVsFamily: number; // 1-5 (1=trendy, 5=family)
  communityVsPrivacy: number; // 1-5 (1=community, 5=privacy)
  budgetVsConvenience: number; // 1-5 (1=budget, 5=convenience)
}

export interface UserInput {
  ageGroup: AgeGroup;
  monthlyIncome: number;
  hasCar: boolean;
  roommates: number; // 0, 1, 2, or 3 — total other people you live with
  livingArrangement: "alone" | "couple" | "own-room" | "shared-room";
  maxRent: number;
  officeDays: OfficeDays;
  officeAddress: string | null;
  mbtaPreference: MbtaLine[];
  sliders: SliderValues;
}

// --- Neighborhood Data Types ---

export type Region = "boston" | "inner-suburb" | "outer-ring";

export type SafetyTrend = "improving" | "stable" | "declining";

export interface RentRange {
  studio: [number, number]; // [low, high]
  oneBr: [number, number];
  twoBr: [number, number];
  threeBr: [number, number];
}

export interface LifestyleProfile {
  nightlifeVsQuiet: number; // 1-5
  urbanVsSuburban: number; // 1-5
  trendyVsFamily: number; // 1-5
  communityVsPrivacy: number; // 1-5
}

export interface Amenities {
  restaurants: number;
  nightlife: number;
  gyms: number;
  grocery: number;
  parks: number;
}

export interface Neighborhood {
  id: string;
  name: string;
  region: Region;
  description: string;
  localTips: string;
  rent: RentRange;
  safety: number; // 0-100
  safetyTrend: SafetyTrend;
  walkScore: number; // 0-100
  transitScore: number; // 0-100
  bikeScore: number; // 0-100
  lifestyleProfile: LifestyleProfile;
  communityScore: number; // 0-100
  amenities: Amenities;
  mbtaLines: MbtaLine[];
  mbtaStations: { line: MbtaLine; name: string }[];
  busRoutes: string[];
  parkingCost: number; // monthly estimate in dollars
  centroid: { lat: number; lng: number };
}

// --- Scoring Types ---

export interface ScoringWeights {
  budget: number;
  commute: number;
  safety: number;
  lifestyle: number;
  community: number;
}

export interface DimensionScores {
  budget: number; // 0-100
  commute: number; // 0-100
  safety: number; // 0-100
  lifestyle: number; // 0-100
  community: number; // 0-100
}

export interface ScoredNeighborhood {
  neighborhood: Neighborhood;
  scores: DimensionScores;
  matchScore: number; // 0-100 composite
  commuteMinutes: number | null;
  commuteRoute: string | null;
  perPersonRent: number; // calculated for user's roommate count
  rentPercent: number; // what % of income this represents
}

// --- Budget Tier Types ---

export type BudgetTier = "saver" | "balanced" | "stretched";

export interface BudgetTiers {
  saver: number; // 45% of income, adjusted for roommates
  balanced: number; // 60% of income, adjusted for roommates
  stretched: number; // user's max rent
}

export interface TieredRecommendation {
  tier: BudgetTier;
  label: string;
  color: string; // tailwind color class
  neighborhood: ScoredNeighborhood;
  tradeoffVsPrev: string | null; // e.g. "Save $400/mo, +15 min commute"
}

// --- Commute API Types ---

export interface CommuteResult {
  durationMinutes: number;
  routeSummary: string; // e.g. "Orange Line → Red Line"
  steps: CommuteStep[];
}

export interface CommuteStep {
  mode: "WALKING" | "TRANSIT";
  instruction: string;
  durationMinutes: number;
  transitLine?: string;
  transitColor?: string;
}
