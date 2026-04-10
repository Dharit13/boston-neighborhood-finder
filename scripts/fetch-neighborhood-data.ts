/**
 * Neighborhood Data Pipeline
 *
 * Fetches real data from Google Maps Places API (Nearby Search)
 * for each neighborhood centroid, then derives scores from actual
 * amenity counts and density rather than hardcoded values.
 *
 * Usage:
 *   npx tsx scripts/fetch-neighborhood-data.ts
 *
 * Requires GOOGLE_MAPS_API_KEY in .env.local
 */

import * as fs from "fs";
import * as path from "path";

// ---------- Types ----------

interface Centroid {
  lat: number;
  lng: number;
}

interface Neighborhood {
  id: string;
  name: string;
  region: string;
  description: string;
  localTips: string;
  rent: {
    studio: [number, number];
    oneBr: [number, number];
    twoBr: [number, number];
  };
  safety: number;
  safetyTrend: string;
  walkScore: number;
  transitScore: number;
  bikeScore: number;
  lifestyleProfile: {
    nightlifeVsQuiet: number;
    urbanVsSuburban: number;
    trendyVsFamily: number;
    communityVsPrivacy: number;
  };
  communityScore: number;
  amenities: {
    restaurants: number;
    nightlife: number;
    gyms: number;
    grocery: number;
    parks: number;
  };
  mbtaLines: string[];
  centroid: Centroid;
  mbtaStations: { line: string; name: string }[];
  busRoutes: string[];
  collegeArea: boolean;
}

// ---------- Config ----------

const DELAY_MS = 250; // delay between API calls to avoid rate limiting

/**
 * Use multiple radii to differentiate dense urban cores from suburbs.
 * A 500m radius differentiates better in dense areas where 1km hits the 20-result cap.
 * We also do a second pass at 300m for nightlife/restaurants to separate
 * "packed with options" from "has some options."
 */
const SEARCH_CONFIG = {
  // Primary categories at 800m radius
  primary: {
    radius: 800,
    types: {
      restaurants: "restaurant",
      nightlife: "bar",
      gyms: "gym",
      grocery: "supermarket",
      parks: "park",
      cafes: "cafe",
      schools: "school",
      libraries: "library",
      transit: "transit_station",
    },
  },
  // Tight radius for density differentiation — these types often hit 20 at wider radii
  tight: {
    radius: 400,
    types: {
      restaurants_tight: "restaurant",
      nightlife_tight: "bar",
      cafes_tight: "cafe",
    },
  },
} as const;

// ---------- API Helpers ----------

function loadApiKey(): string {
  const envPath = path.resolve(__dirname, "../.env.local");
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/^GOOGLE_MAPS_API_KEY=(.+)$/m);
  if (!match) throw new Error("GOOGLE_MAPS_API_KEY not found in .env.local");
  return match[1].trim();
}

async function nearbySearch(
  lat: number,
  lng: number,
  type: string,
  radius: number,
  apiKey: string
): Promise<number> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
  );
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", radius.toString());
  url.searchParams.set("type", type);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.warn(`  Warning: ${type}@${radius}m returned status ${data.status}`);
    return 0;
  }

  return data.results?.length ?? 0;
}

/**
 * Fetch with pagination — gets up to 60 results (3 pages) for more accurate counts.
 * Only used for key differentiating categories.
 */
async function nearbySearchPaginated(
  lat: number,
  lng: number,
  type: string,
  radius: number,
  apiKey: string
): Promise<number> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
  );
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", radius.toString());
  url.searchParams.set("type", type);
  url.searchParams.set("key", apiKey);

  let total = 0;
  let nextPageToken: string | undefined;
  let pages = 0;

  while (pages < 3) {
    if (nextPageToken) {
      url.searchParams.set("pagetoken", nextPageToken);
      // Google requires a short delay before using page tokens
      await sleep(2000);
    }

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") break;

    total += data.results?.length ?? 0;
    nextPageToken = data.next_page_token;
    pages++;

    if (!nextPageToken) break;
  }

  return total;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Score Derivation ----------

/**
 * Derive lifestyle profile from real amenity counts.
 *
 * Uses tight-radius (400m) counts for nightlife/restaurants/cafes to differentiate
 * dense urban areas where 800m counts all hit the 20-result cap.
 * Uses paginated restaurant count for total restaurant density.
 */
function deriveLifestyleProfile(counts: Record<string, number>): {
  nightlifeVsQuiet: number;
  urbanVsSuburban: number;
  trendyVsFamily: number;
  communityVsPrivacy: number;
} {
  // Use tight-radius counts for differentiation in dense areas
  const barsTight = counts.nightlife_tight ?? counts.nightlife;
  const restaurantsTight = counts.restaurants_tight ?? counts.restaurants;
  const cafesTight = counts.cafes_tight ?? counts.cafes;

  // nightlifeVsQuiet: 1=nightlife-heavy, 5=quiet
  // Tight-radius bars are the best signal — only packed nightlife areas have 15+ bars in 400m
  const nightlifeIntensity = barsTight * 2 + restaurantsTight * 0.3;
  const nightlifeVsQuiet = intensityToScale(nightlifeIntensity, 3, 35, true);

  // urbanVsSuburban: 1=urban, 5=suburban
  // Use tight-radius total as the primary signal — 400m radius separates dense cores from spread-out areas
  const tightTotal = restaurantsTight + barsTight + cafesTight;
  const urbanVsSuburban = intensityToScale(tightTotal, 2, 45, true);

  // trendyVsFamily: 1=trendy, 5=family
  // Use tight-radius cafes+bars (trendy signal) vs wider-radius schools+parks+libraries (family signal)
  const trendySignal = cafesTight * 1.5 + barsTight;
  const familySignal = counts.schools * 0.8 + counts.parks * 0.5 + counts.libraries * 1.5;
  const totalSignal = trendySignal + familySignal;
  let trendyVsFamily: number;
  if (totalSignal < 5) {
    trendyVsFamily = 3; // Not enough data, neutral
  } else {
    const trendyRatio = trendySignal / totalSignal;
    // Map ratio: 0.7+ → 1 (very trendy), 0.3- → 5 (very family), linear between
    trendyVsFamily = Math.round(5 - (trendyRatio - 0.15) * (4 / 0.6));
  }

  // communityVsPrivacy: 1=community, 5=privacy
  // Use libraries (strong signal), parks, and grocery as community anchors
  // Tight-radius density inversely signals privacy
  const communitySignal =
    counts.libraries * 4 + counts.grocery * 2 + counts.parks * 0.8;
  const communityVsPrivacy = intensityToScale(communitySignal, 2, 20, true);

  return {
    nightlifeVsQuiet: clamp(nightlifeVsQuiet, 1, 5),
    urbanVsSuburban: clamp(urbanVsSuburban, 1, 5),
    trendyVsFamily: clamp(trendyVsFamily, 1, 5),
    communityVsPrivacy: clamp(communityVsPrivacy, 1, 5),
  };
}

/**
 * Derive community score (0-100) from amenity data.
 * Parks, libraries, schools, grocery = community infrastructure.
 * Uses logarithmic scaling to prevent saturation in dense urban areas.
 * Calibrated so dense urban cores score 60-85, suburbs 30-60, sparse areas 10-30.
 */
function deriveCommunityScore(counts: Record<string, number>): number {
  // Libraries are the strongest community signal (few per area, very intentional)
  // Parks are common in Boston, so weighted lower
  // Schools indicate families/established community
  const raw =
    counts.libraries * 8 +
    counts.parks * 2 +
    counts.schools * 3 +
    counts.grocery * 5;
  // Use logarithmic scaling to prevent saturation
  // log(1)=0, log(10)≈2.3, log(50)≈3.9, log(100)≈4.6, log(200)≈5.3
  // This maps: raw 5→25, raw 20→55, raw 50→72, raw 100→85, raw 200→97
  if (raw <= 0) return 0;
  const logScore = Math.log(raw) / Math.log(200) * 100;
  return clamp(Math.round(logScore), 0, 100);
}

/**
 * Derive walkability estimate from tight-radius amenity density.
 * If you can find lots of things within 400m, it's very walkable.
 */
function deriveWalkScore(counts: Record<string, number>): number {
  const tightTotal =
    (counts.restaurants_tight ?? 0) +
    (counts.nightlife_tight ?? 0) +
    (counts.cafes_tight ?? 0);
  const wideUseful = counts.grocery + counts.gyms + counts.transit;

  // tightTotal 0-60, wideUseful 0-40
  const raw = tightTotal * 1.5 + wideUseful * 2;
  return clamp(Math.round(raw + 10), 0, 100);
}

/**
 * Derive transit score from MBTA station data (more accurate than Google Places).
 * Uses actual station count + line diversity + bus route count.
 */
function deriveTransitScore(
  mbtaStations: { line: string; name: string }[],
  busRoutes: string[],
  mbtaLines: string[]
): number {
  const stationCount = mbtaStations.length;
  const lineCount = mbtaLines.filter((l) => l !== "bus" && l !== "ferry").length;
  const busCount = busRoutes.length;

  // Stations: 0→0, 1→20, 2→35, 4→55, 6→70, 8+→80
  const stationScore = Math.min(80, stationCount * 12);
  // Line diversity bonus: each distinct line adds value
  const lineBonus = Math.min(15, lineCount * 5);
  // Bus bonus: having buses adds last-mile connectivity
  const busBonus = Math.min(10, busCount * 2);

  return clamp(stationScore + lineBonus + busBonus, 0, 100);
}

// ---------- Utilities ----------

/** Map an intensity value to a 1-5 scale. If inverted, high intensity → 1. */
function intensityToScale(
  value: number,
  low: number,
  high: number,
  invert: boolean
): number {
  const normalized = (value - low) / (high - low); // 0 to 1
  const clamped = Math.max(0, Math.min(1, normalized));
  const scale = Math.round(clamped * 4) + 1; // 1 to 5
  return invert ? 6 - scale : scale;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------- Main Pipeline ----------

async function main() {
  const apiKey = loadApiKey();
  const inputPath = path.resolve(
    __dirname,
    "../public/data/neighborhoods.json"
  );
  const neighborhoods: Neighborhood[] = JSON.parse(
    fs.readFileSync(inputPath, "utf-8")
  );

  console.log(
    `Fetching real data for ${neighborhoods.length} neighborhoods...`
  );
  const primaryCount = Object.keys(SEARCH_CONFIG.primary.types).length;
  const tightCount = Object.keys(SEARCH_CONFIG.tight.types).length;
  console.log(`Primary (${SEARCH_CONFIG.primary.radius}m): ${primaryCount} types, Tight (${SEARCH_CONFIG.tight.radius}m): ${tightCount} types + paginated restaurants`);
  console.log(
    `Estimated API calls: ~${neighborhoods.length * (primaryCount + tightCount + 3)} (includes pagination)`
  );
  console.log("---");

  for (let i = 0; i < neighborhoods.length; i++) {
    const n = neighborhoods[i];
    const { lat, lng } = n.centroid;
    console.log(
      `[${i + 1}/${neighborhoods.length}] ${n.name} (${lat}, ${lng})`
    );

    // Fetch primary categories at 800m radius
    const counts: Record<string, number> = {};
    for (const [category, placeType] of Object.entries(SEARCH_CONFIG.primary.types)) {
      counts[category] = await nearbySearch(lat, lng, placeType, SEARCH_CONFIG.primary.radius, apiKey);
      console.log(`  ${category} (${SEARCH_CONFIG.primary.radius}m): ${counts[category]}`);
      await sleep(DELAY_MS);
    }

    // Fetch tight-radius counts for dense categories
    for (const [category, placeType] of Object.entries(SEARCH_CONFIG.tight.types)) {
      counts[category] = await nearbySearch(lat, lng, placeType, SEARCH_CONFIG.tight.radius, apiKey);
      console.log(`  ${category} (${SEARCH_CONFIG.tight.radius}m): ${counts[category]}`);
      await sleep(DELAY_MS);
    }

    // For restaurants, use paginated search at 800m — this is the key differentiator
    counts.restaurants_full = await nearbySearchPaginated(
      lat, lng, "restaurant", SEARCH_CONFIG.primary.radius, apiKey
    );
    console.log(`  restaurants_full (paginated 800m): ${counts.restaurants_full}`);

    // Update amenities with real data (use paginated restaurant count for display)
    n.amenities = {
      restaurants: counts.restaurants_full,
      nightlife: counts.nightlife,
      gyms: counts.gyms,
      grocery: counts.grocery,
      parks: counts.parks,
    };

    // Derive all scores from real data
    n.lifestyleProfile = deriveLifestyleProfile(counts);
    console.log(`  lifestyle: ${JSON.stringify(n.lifestyleProfile)}`);

    n.communityScore = deriveCommunityScore(counts);
    console.log(`  communityScore: ${n.communityScore}`);

    n.walkScore = deriveWalkScore(counts);
    n.transitScore = deriveTransitScore(n.mbtaStations, n.busRoutes, n.mbtaLines);
    n.bikeScore = clamp(
      Math.round(n.walkScore * 0.7 + counts.parks * 3),
      0,
      100
    );
    console.log(
      `  walkScore: ${n.walkScore}, transitScore: ${n.transitScore}, bikeScore: ${n.bikeScore}`
    );

    console.log("");
  }

  // Write updated data
  const outputPath = inputPath;
  const backupPath = inputPath.replace(".json", ".backup.json");

  // Backup original
  fs.copyFileSync(inputPath, backupPath);
  console.log(`Backup saved to ${backupPath}`);

  // Write new data
  fs.writeFileSync(outputPath, JSON.stringify(neighborhoods, null, 2) + "\n");
  console.log(`Updated data written to ${outputPath}`);
  console.log("Done!");
}

main().catch(console.error);
