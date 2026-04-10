// --- User Input Types ---

export type AgeGroup = "21-25" | "26-29" | "30-35";

export type OfficeDays = 0 | 1 | 2 | 3 | 4 | 5;

export type MbtaLine = "red" | "green" | "blue" | "orange" | "silver" | "bus" | "ferry";

export interface SliderValues {
  nightlifeVsQuiet: number; // 1-5 (1=nightlife, 5=quiet)
  urbanVsSuburban: number; // 1-5 (1=urban, 5=suburban)
  trendyVsFamily: number; // 1-5 (1=trendy, 5=family)
  communityVsPrivacy: number; // 1-5 (1=community, 5=privacy)
  budgetVsConvenience: number; // 1-5 (1=budget, 5=convenience)
}

export type BudgetPriority = "save" | "balanced" | "spend";

export interface UserInput {
  ageGroup: AgeGroup;
  monthlyIncome: number;
  roommates: number; // 0, 1, or 2 — total other people you live with
  livingArrangement: "alone" | "couple" | "own-room" | "shared-room";
  apartmentSize: "studio" | "1br" | "2br"; // only relevant when alone or couple
  maxRent: number;
  budgetPriority: BudgetPriority;
  officeDays: OfficeDays;
  officeAddress: string | null;
  mbtaPreference: MbtaLine[];
  sliders: SliderValues;
  avoidCollegeArea: boolean;
  needsParking: boolean;
}

// --- Neighborhood Data Types ---

export type Region = "boston" | "inner-suburb" | "outer-ring";

export type SafetyTrend = "improving" | "stable" | "declining";

export interface RentRange {
  studio: [number, number]; // [low, high]
  oneBr: [number, number];
  twoBr: [number, number];
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
  collegeArea: boolean; // true if major university presence
  parkingFriendly: boolean; // true if street parking is reasonable (no garage needed)
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
  overBudget: boolean; // rent exceeds user's max — not a valid match
}

// --- AI Chat Types ---

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// --- News & Alerts Types ---

export interface NewsItem {
  title: string;
  url: string;
  source: string; // e.g. "Boston Globe"
  publishedAt: string; // ISO 8601
}

export interface MbtaAlert {
  id: string;
  header: string;
  description: string;
  severity: number; // 0-10; always >= 3 after filtering
  effect: string; // "DELAY" | "DETOUR" | "SUSPENSION" | "SHUTTLE" | "STATION_CLOSURE" | "SERVICE_CHANGE"
  routes: MbtaLine[]; // which of the requested lines this alert touches
  url: string | null;
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
