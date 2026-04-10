/**
 * Comprehensive Neighborhood Data Pipeline
 *
 * Fetches real data from multiple public APIs:
 *  1. MBTA API — real stations, lines, bus routes per neighborhood
 *  2. Walk Score API — real walk/transit/bike scores
 *  3. Census ACS API — real rent data by bedroom count (tract-level)
 *  4. Crime Data — Boston Open Data + FBI UCR for safety scores
 *  5. Google Places API — amenity counts (existing)
 *
 * Usage:
 *   npx tsx scripts/fetch-real-data.ts [--mbta] [--rent] [--crime] [--places] [--all]
 *
 * Requires in .env.local:
 *   GOOGLE_MAPS_API_KEY=...  (for --places)
 */

import * as fs from "fs";
import * as path from "path";

// ---------- Types ----------

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
  centroid: { lat: number; lng: number };
  mbtaStations: { line: string; name: string }[];
  busRoutes: string[];
  collegeArea: boolean;
}

// ---------- Helpers ----------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function loadNeighborhoods(): Neighborhood[] {
  const inputPath = path.resolve(__dirname, "../public/data/neighborhoods.json");
  return JSON.parse(fs.readFileSync(inputPath, "utf-8"));
}

function saveNeighborhoods(neighborhoods: Neighborhood[]): void {
  const outputPath = path.resolve(__dirname, "../public/data/neighborhoods.json");
  const backupPath = outputPath.replace(".json", ".backup.json");
  fs.copyFileSync(outputPath, backupPath);
  fs.writeFileSync(outputPath, JSON.stringify(neighborhoods, null, 2) + "\n");
  console.log(`\nBackup → ${backupPath}`);
  console.log(`Updated → ${outputPath}`);
}

/** Map neighborhood to its municipality for crime data */
function getMunicipality(n: Neighborhood): string {
  if (n.region === "boston") return "Boston";
  if (n.id.startsWith("cambridge-")) return "Cambridge";
  if (n.id.startsWith("somerville-")) return "Somerville";
  // Outer ring + brookline: the neighborhood name IS the municipality
  const nameMap: Record<string, string> = {
    brookline: "Brookline",
    everett: "Everett",
    malden: "Malden",
    medford: "Medford",
    chelsea: "Chelsea",
    revere: "Revere",
    quincy: "Quincy",
    milton: "Milton",
    watertown: "Watertown",
    waltham: "Waltham",
    newton: "Newton",
  };
  return nameMap[n.id] || n.name;
}

// ============================================================
// 1. MBTA API — Real stations, lines, bus routes
// ============================================================

/** Map MBTA route ID to our line category */
function routeToLine(routeId: string, routeType: number): string | null {
  if (routeType === 4) return "ferry";
  if (routeType === 3) return "bus";
  const id = routeId.toLowerCase();
  if (id === "red" || id === "mattapan") return "red";
  if (id.startsWith("green")) return "green";
  if (id === "blue") return "blue";
  if (id === "orange") return "orange";
  if (id.startsWith("silver") || id.startsWith("sl")) return "silver";
  return null; // commuter rail, etc.
}

/** Haversine distance in miles between two lat/lng points */
function distanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------- Polygon geometry (for BPDA boundary matching) ----------

type Ring = [number, number][]; // [lng, lat] per GeoJSON convention
type Polygon = Ring[]; // [outer, ...holes]
type MultiPolygon = Polygon[];

interface NeighborhoodPolygon {
  name: string;
  polygons: MultiPolygon; // always stored as multipolygon
}

function pointInRing(lat: number, lng: number, ring: Ring): boolean {
  let inside = false;
  const n = ring.length;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

function pointInMultiPolygon(lat: number, lng: number, mp: MultiPolygon): boolean {
  for (const poly of mp) {
    if (pointInRing(lat, lng, poly[0])) {
      const inHole = poly.slice(1).some((h) => pointInRing(lat, lng, h));
      if (!inHole) return true;
    }
  }
  return false;
}

/** Approximate miles from a lat/lng to the nearest edge of a ring. */
function distanceToRingMiles(lat: number, lng: number, ring: Ring): number {
  // Convert to an equirectangular projection local to the query point so
  // we can do fast 2D segment-distance math. Accurate to ~1% for short ranges.
  const MI_PER_DEG_LAT = 69.0;
  const miPerDegLng = 69.0 * Math.cos((lat * Math.PI) / 180);
  const px = 0; // query point at origin (in miles)
  const py = 0;

  let minDist = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - lng) * miPerDegLng;
    const ay = (ring[i][1] - lat) * MI_PER_DEG_LAT;
    const bx = (ring[i + 1][0] - lng) * miPerDegLng;
    const by = (ring[i + 1][1] - lat) * MI_PER_DEG_LAT;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.hypot(cx - px, cy - py);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/** 0 if point is inside the multipolygon, otherwise miles to nearest edge. */
function distanceToMultiPolygonMiles(
  lat: number,
  lng: number,
  mp: MultiPolygon
): number {
  if (pointInMultiPolygon(lat, lng, mp)) return 0;
  let minDist = Infinity;
  for (const poly of mp) {
    for (const ring of poly) {
      const d = distanceToRingMiles(lat, lng, ring);
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
}

/**
 * Load BPDA neighborhood boundary polygons and return a map from our
 * neighborhoods.json `name` to the polygon that should be used for matching.
 * Some of our neighborhoods are unions or aliases of BPDA neighborhoods.
 */
function loadNeighborhoodPolygons(): Map<string, NeighborhoodPolygon> {
  const geojsonPath = path.resolve(__dirname, "../public/data/boston-neighborhoods.geojson");
  if (!fs.existsSync(geojsonPath)) {
    console.warn(`  ⚠ boston-neighborhoods.geojson not found at ${geojsonPath}`);
    return new Map();
  }
  const g = JSON.parse(fs.readFileSync(geojsonPath, "utf-8"));

  // Index BPDA polygons by name
  const bpda = new Map<string, MultiPolygon>();
  for (const feat of g.features) {
    const name = feat.properties.name as string;
    const geom = feat.geometry;
    let mp: MultiPolygon;
    if (geom.type === "Polygon") mp = [geom.coordinates];
    else if (geom.type === "MultiPolygon") mp = geom.coordinates;
    else continue;
    bpda.set(name, mp);
  }

  // Map our neighborhood names → one or more BPDA polygon names to union
  const NAME_MAP: Record<string, string[]> = {
    "Back Bay": ["Back Bay"],
    "Beacon Hill": ["Beacon Hill"],
    "South End": ["South End"],
    "South End / SoWa": ["South End"],
    "South Boston": ["South Boston"],
    "East Boston": ["East Boston"],
    "North End": ["North End"],
    "Charlestown": ["Charlestown"],
    "Allston": ["Allston"],
    "Brighton": ["Brighton"],
    "Fenway/Kenmore": ["Fenway"],
    "Mission Hill": ["Mission Hill"],
    "Jamaica Plain": ["Jamaica Plain"],
    "Roxbury": ["Roxbury"],
    "Roslindale": ["Roslindale"],
    "Hyde Park": ["Hyde Park"],
    "Mattapan": ["Mattapan"],
    "West Roxbury": ["West Roxbury"],
    "West End": ["West End"],
    "Chinatown / Leather District": ["Chinatown", "Leather District"],
    "Seaport": ["South Boston Waterfront"],
    "South Boston Seaport": ["South Boston Waterfront"],
    "Dorchester North": ["Dorchester"],
    "Dorchester South": ["Dorchester"],
    "Financial District": ["Downtown"],
    "Downtown Crossing": ["Downtown"],
  };

  const result = new Map<string, NeighborhoodPolygon>();
  for (const [ourName, bpdaNames] of Object.entries(NAME_MAP)) {
    const combined: MultiPolygon = [];
    for (const bname of bpdaNames) {
      const mp = bpda.get(bname);
      if (mp) combined.push(...mp);
    }
    if (combined.length > 0) {
      result.set(ourName, { name: ourName, polygons: combined });
    }
  }

  // Also load MA town/city polygons from Census TIGER for suburban
  // neighborhoods. Our name → Census NAME (NAME column includes "Town" suffix
  // for a few incorporated towns — e.g. "Watertown Town").
  const maGeojsonPath = path.resolve(__dirname, "../public/data/ma-towns.geojson");
  if (fs.existsSync(maGeojsonPath)) {
    const ma = JSON.parse(fs.readFileSync(maGeojsonPath, "utf-8"));
    const maTowns = new Map<string, MultiPolygon>();
    for (const feat of ma.features) {
      const name = feat.properties.NAME as string;
      const geom = feat.geometry;
      let mp: MultiPolygon;
      if (geom.type === "Polygon") mp = [geom.coordinates];
      else if (geom.type === "MultiPolygon") mp = geom.coordinates;
      else continue;
      maTowns.set(name, mp);
    }

    const TOWN_MAP: Record<string, string> = {
      Brookline: "Brookline",
      Everett: "Everett",
      Malden: "Malden",
      Medford: "Medford",
      Chelsea: "Chelsea",
      Revere: "Revere",
      Quincy: "Quincy",
      Milton: "Milton",
      Watertown: "Watertown Town",
      Waltham: "Waltham",
      Newton: "Newton",
    };
    for (const [ourName, censusName] of Object.entries(TOWN_MAP)) {
      const mp = maTowns.get(censusName);
      if (mp) result.set(ourName, { name: ourName, polygons: mp });
    }
  } else {
    console.warn(`  ⚠ ma-towns.geojson not found at ${maGeojsonPath}`);
  }

  return result;
}

interface MbtaStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lines: string[]; // our line categories
  routeIds: string[]; // raw bus route IDs
  isBus: boolean;
}

/**
 * Strategy: Pre-fetch ALL MBTA route+stop data in bulk (~15 API calls),
 * then match to neighborhoods locally by distance. Much more efficient
 * than per-neighborhood queries which hit the 20 req/min rate limit.
 */
async function fetchMbtaData(neighborhoods: Neighborhood[]): Promise<void> {
  console.log("\n=== MBTA API ===");
  console.log("Pre-fetching all MBTA data in bulk, then matching by distance...\n");

  const DELAY = 3500;
  const allStops: MbtaStop[] = [];

  // Step 1: Get all subway/light rail routes
  console.log("Fetching subway/light rail routes...");
  const railRoutesRes = await fetch("https://api-v3.mbta.com/routes?filter[type]=0,1");
  const railRoutesData = await railRoutesRes.json();
  await sleep(DELAY);

  const railRoutes: { id: string; line: string }[] = [];
  if (railRoutesData.data) {
    for (const route of railRoutesData.data) {
      const line = routeToLine(route.id, route.attributes.type);
      if (line) railRoutes.push({ id: route.id, line });
    }
  }
  console.log(`  Found ${railRoutes.length} rail routes: ${railRoutes.map((r) => r.id).join(", ")}`);

  // Step 2: For each rail route, get its stops
  for (const route of railRoutes) {
    console.log(`  Fetching stops for ${route.id}...`);
    const stopsRes = await fetch(
      `https://api-v3.mbta.com/stops?filter[route]=${route.id}&page[limit]=200`
    );
    const stopsData = await stopsRes.json();
    await sleep(DELAY);

    if (stopsData.data) {
      // Deduplicate: use parent station to avoid platform duplicates
      const seen = new Set<string>();
      for (const stop of stopsData.data) {
        const parentId = stop.relationships?.parent_station?.data?.id;
        const key = parentId || stop.id;
        if (seen.has(key)) continue;
        seen.add(key);

        const existing = allStops.find((s) => s.id === key);
        if (existing) {
          if (!existing.lines.includes(route.line)) {
            existing.lines.push(route.line);
          }
        } else {
          allStops.push({
            id: key,
            name: stop.attributes.name,
            lat: stop.attributes.latitude,
            lng: stop.attributes.longitude,
            lines: [route.line],
            routeIds: [],
            isBus: false,
          });
        }
      }
    }
  }
  console.log(`  Total unique rail stations: ${allStops.filter((s) => !s.isBus).length}`);

  // Step 2b: Ferry routes (type=4). Same polygon-based matching as rail.
  console.log("\nFetching ferry routes...");
  const ferryRoutesRes = await fetch("https://api-v3.mbta.com/routes?filter[type]=4");
  const ferryRoutesData = await ferryRoutesRes.json();
  await sleep(DELAY);

  const ferryRoutes: { id: string }[] = [];
  if (ferryRoutesData.data) {
    for (const route of ferryRoutesData.data) ferryRoutes.push({ id: route.id });
  }
  console.log(`  Found ${ferryRoutes.length} ferry routes: ${ferryRoutes.map((r) => r.id).join(", ")}`);

  for (const route of ferryRoutes) {
    console.log(`  Fetching stops for ${route.id}...`);
    const stopsRes = await fetch(
      `https://api-v3.mbta.com/stops?filter[route]=${route.id}&page[limit]=100`
    );
    const stopsData = await stopsRes.json();
    await sleep(DELAY);

    if (stopsData.data) {
      const seen = new Set<string>();
      for (const stop of stopsData.data) {
        const parentId = stop.relationships?.parent_station?.data?.id;
        const key = parentId || stop.id;
        if (seen.has(key)) continue;
        seen.add(key);

        const existing = allStops.find((s) => s.id === key);
        if (existing) {
          if (!existing.lines.includes("ferry")) existing.lines.push("ferry");
        } else {
          allStops.push({
            id: key,
            name: stop.attributes.name,
            lat: stop.attributes.latitude,
            lng: stop.attributes.longitude,
            lines: ["ferry"],
            routeIds: [],
            isBus: false,
          });
        }
      }
    }
  }
  console.log(`  Total ferry stops added: ${allStops.filter((s) => s.lines.includes("ferry")).length}`);

  // Step 3: Bus data — per-neighborhood approach (simpler, 44 calls)
  // For each neighborhood, find nearby bus stops via location filter, then get their routes
  console.log("\nFetching bus data per neighborhood...");

  // Step 4: Match to neighborhoods + fetch bus per neighborhood
  console.log("\n--- Matching to neighborhoods ---\n");

  // Primary strategy: point-in-polygon using BPDA boundaries. A station is
  // considered part of a neighborhood if it's inside the polygon OR within
  // POLYGON_BUFFER_MILES of its edge (to catch stations sitting just on the
  // boundary, e.g. Haymarket for North End).
  //
  // Fallback strategy (for neighborhoods without BPDA polygons — Cambridge,
  // Somerville sub-hoods, suburbs): adaptive radius. Include stations within
  // (closest + FALLBACK_BUFFER) miles, capped at FALLBACK_MAX. This keeps
  // dense areas tight while still matching sparse suburban centroids.
  const POLYGON_BUFFER_MILES = 0.15;
  const FALLBACK_MAX_MILES = 0.6;
  const FALLBACK_BUFFER_MILES = 0.2;

  const polygonMap = loadNeighborhoodPolygons();
  console.log(`  Loaded ${polygonMap.size} neighborhood polygons from BPDA\n`);

  for (let i = 0; i < neighborhoods.length; i++) {
    const n = neighborhoods[i];
    const { lat, lng } = n.centroid;

    let nearbyRail: typeof allStops = [];
    const polygon = polygonMap.get(n.name);

    if (polygon) {
      // Polygon match: station is "in" this neighborhood if its distance to
      // the polygon edge is ≤ buffer (0 means inside).
      nearbyRail = allStops
        .filter((s) => !s.isBus)
        .filter(
          (s) =>
            distanceToMultiPolygonMiles(s.lat, s.lng, polygon.polygons) <=
            POLYGON_BUFFER_MILES
        );
    } else {
      // Fallback: adaptive radius from centroid
      const railWithDist = allStops
        .filter((s) => !s.isBus)
        .map((s) => ({ stop: s, dist: distanceMiles(lat, lng, s.lat, s.lng) }))
        .filter((x) => x.dist <= FALLBACK_MAX_MILES);

      if (railWithDist.length > 0) {
        const minDist = Math.min(...railWithDist.map((x) => x.dist));
        const threshold = minDist + FALLBACK_BUFFER_MILES;
        nearbyRail = railWithDist
          .filter((x) => x.dist <= threshold)
          .map((x) => x.stop);
      }
    }

    const stations: { line: string; name: string }[] = [];
    const lineSet = new Set<string>();
    const stationKeys = new Set<string>();

    for (const stop of nearbyRail) {
      for (const line of stop.lines) {
        const key = `${line}-${stop.name}`;
        if (!stationKeys.has(key)) {
          stationKeys.add(key);
          stations.push({ line, name: stop.name });
          lineSet.add(line);
        }
      }
    }

    // Fetch bus stops near this neighborhood (0.005 degrees ~ 0.3 miles)
    const busStopsUrl = `https://api-v3.mbta.com/stops?filter[latitude]=${lat}&filter[longitude]=${lng}&filter[radius]=0.005&filter[route_type]=3&page[limit]=50`;
    const busRes = await fetch(busStopsUrl);
    const busData = await busRes.json();
    await sleep(DELAY);

    const busRouteSet = new Set<string>();
    if (busData.data && busData.data.length > 0) {
      const busStopIds = busData.data
        .slice(0, 25)
        .map((s: { id: string }) => s.id);
      // Get routes serving these stops
      const routesUrl = `https://api-v3.mbta.com/routes?filter[stop]=${busStopIds.join(",")}&filter[type]=3`;
      const routesRes = await fetch(routesUrl);
      const routesData = await routesRes.json();
      await sleep(DELAY);

      if (routesData.data) {
        for (const route of routesData.data) {
          busRouteSet.add(route.id);
        }
      }
    }

    if (busRouteSet.size > 0) lineSet.add("bus");

    n.mbtaStations = stations;
    n.busRoutes = Array.from(busRouteSet).sort();
    n.mbtaLines = Array.from(lineSet).sort();

    console.log(`[${i + 1}/${neighborhoods.length}] ${n.name}:`);
    console.log(`  Stations: ${stations.map((s) => `${s.name} (${s.line})`).join(", ") || "none"}`);
    console.log(`  Bus: ${n.busRoutes.length} routes | Lines: ${n.mbtaLines.join(", ") || "none"}`);
  }
}

// ============================================================
// 2. Census ACS API — Real rent data by bedroom count
// ============================================================

/** Get census tract for a lat/lng coordinate */
async function getCensusTract(
  lat: number,
  lng: number
): Promise<{ state: string; county: string; tract: string } | null> {
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  const res = await fetch(url);
  const data = await res.json();

  const geographies = data.result?.geographies?.["Census Tracts"];
  if (!geographies || geographies.length === 0) return null;

  const geo = geographies[0];
  return {
    state: geo.STATE,
    county: geo.COUNTY,
    tract: geo.TRACT,
  };
}

async function fetchCensusRent(neighborhoods: Neighborhood[]): Promise<void> {
  console.log("\n=== CENSUS ACS RENT DATA ===");
  console.log("Fetching tract-level rent by bedroom count...\n");

  // Step 1: Get census tract for each neighborhood
  console.log("Step 1: Geocoding centroids to census tracts...");
  const tractMap = new Map<
    string,
    { state: string; county: string; tract: string; neighborhoods: number[] }
  >();

  for (let i = 0; i < neighborhoods.length; i++) {
    const n = neighborhoods[i];
    console.log(`  [${i + 1}/${neighborhoods.length}] ${n.name}...`);

    const tract = await getCensusTract(n.centroid.lat, n.centroid.lng);
    if (tract) {
      const key = `${tract.state}-${tract.county}-${tract.tract}`;
      if (!tractMap.has(key)) {
        tractMap.set(key, { ...tract, neighborhoods: [] });
      }
      tractMap.get(key)!.neighborhoods.push(i);
      console.log(`    → Tract ${tract.tract} (County ${tract.county})`);
    } else {
      console.log(`    → Could not geocode, keeping existing rent`);
    }
    await sleep(300);
  }

  // Step 2: Get unique counties we need to query
  const counties = new Map<string, Set<string>>(); // state-county → set of tracts
  for (const [, info] of tractMap) {
    const key = `${info.state}-${info.county}`;
    if (!counties.has(key)) counties.set(key, new Set());
    counties.get(key)!.add(info.tract);
  }

  // Step 3: Query ACS for rent by bedroom count per county
  // B25031: Median Gross Rent by Bedrooms
  // _002E = studio, _003E = 1BR, _004E = 2BR
  console.log("\nStep 2: Fetching ACS rent data by county...");

  const rentByTract = new Map<
    string,
    { studio: number; oneBr: number; twoBr: number }
  >();

  for (const [countyKey] of counties) {
    const [stateCode, countyCode] = countyKey.split("-");
    console.log(`  Querying state=${stateCode}, county=${countyCode}...`);

    const acsUrl = `https://api.census.gov/data/2022/acs/acs5?get=B25031_002E,B25031_003E,B25031_004E&for=tract:*&in=state:${stateCode}&in=county:${countyCode}`;
    const res = await fetch(acsUrl);
    const data = await res.json();

    if (!Array.isArray(data) || data.length < 2) {
      console.log(`    Warning: No ACS data returned`);
      continue;
    }

    // Skip header row, parse data
    // Columns: B25031_002E, B25031_003E, B25031_004E, state, county, tract
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      const studio = parseInt(row[0]) || 0;
      const oneBr = parseInt(row[1]) || 0;
      const twoBr = parseInt(row[2]) || 0;
      const state = row[3];
      const county = row[4];
      const tract = row[5];

      const key = `${state}-${county}-${tract}`;
      if (studio > 0 || oneBr > 0) {
        rentByTract.set(key, { studio, oneBr, twoBr });
      }
    }
    console.log(`    Got rent data for ${data.length - 1} tracts`);
    await sleep(300);
  }

  // Step 4: Apply rent data to neighborhoods
  console.log("\nStep 3: Applying rent data to neighborhoods...");
  let updated = 0;

  for (const [tractKey, info] of tractMap) {
    const rent = rentByTract.get(tractKey);
    if (!rent) continue;

    for (const idx of info.neighborhoods) {
      const n = neighborhoods[idx];
      // Census gives median rent. Create a range: median ± 15%
      const spread = 0.15;
      if (rent.studio > 0) {
        n.rent.studio = [
          Math.round(rent.studio * (1 - spread)),
          Math.round(rent.studio * (1 + spread)),
        ];
      }
      if (rent.oneBr > 0) {
        n.rent.oneBr = [
          Math.round(rent.oneBr * (1 - spread)),
          Math.round(rent.oneBr * (1 + spread)),
        ];
      }
      if (rent.twoBr > 0) {
        n.rent.twoBr = [
          Math.round(rent.twoBr * (1 - spread)),
          Math.round(rent.twoBr * (1 + spread)),
        ];
      }
      console.log(
        `  ${n.name}: studio=$${n.rent.studio[0]}-${n.rent.studio[1]}, 1BR=$${n.rent.oneBr[0]}-${n.rent.oneBr[1]}, 2BR=$${n.rent.twoBr[0]}-${n.rent.twoBr[1]}`
      );
      updated++;
    }
  }
  console.log(`\nUpdated rent for ${updated}/${neighborhoods.length} neighborhoods`);
}

// ============================================================
// 4. Crime/Safety Data
// ============================================================

/**
 * Boston: data.boston.gov crime incident reports with lat/lng
 * Count incidents within ~0.5 mile radius of centroid (last 12 months)
 * Other municipalities: FBI Crime Data Explorer API
 */

async function fetchBostonCrimeCount(lat: number, lng: number): Promise<number> {
  // Query incidents within a bounding box (~0.5 mile)
  const delta = 0.008; // ~0.5 mile in degrees
  const latMin = lat - delta;
  const latMax = lat + delta;
  const lngMin = lng - delta;
  const lngMax = lng + delta;

  // Use CKAN datastore_search with filters
  const url = `https://data.boston.gov/api/3/action/datastore_search_sql?sql=${encodeURIComponent(
    `SELECT COUNT(*) as count FROM "b973d8cb-eeb2-4e7e-99da-c92938efc9c0" WHERE "Lat" IS NOT NULL AND CAST("Lat" AS FLOAT) BETWEEN ${latMin} AND ${latMax} AND CAST("Long" AS FLOAT) BETWEEN ${lngMin} AND ${lngMax}`
  )}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.success && data.result?.records?.[0]) {
      return parseInt(data.result.records[0].count) || 0;
    }
  } catch {
    console.log(`    Warning: Boston API error, trying fallback...`);
  }

  // Fallback: simple datastore_search with limit
  const fallbackUrl = `https://data.boston.gov/api/3/action/datastore_search?resource_id=b973d8cb-eeb2-4e7e-99da-c92938efc9c0&limit=1`;
  try {
    const res = await fetch(fallbackUrl);
    const data = await res.json();
    return data.result?.total || 0;
  } catch {
    return 0;
  }
}

/**
 * Read crime rate from local CSV files (downloaded from MA crime reporting).
 * Files are in public/data/{year}/{Town}_-_{ORI}.csv
 * Line 2 has: label, population, offenses, cleared, pct, rate_per_100k, ...
 * Tries 2024 first, falls back to 2023, then 2022.
 */
function readLocalCrimeRate(municipality: string): { rate: number; population: number; offenses: number; year: number } | null {
  const dataDir = path.resolve(__dirname, "../public/data");

  for (const year of [2024, 2023, 2022]) {
    const yearDir = path.join(dataDir, year.toString());
    if (!fs.existsSync(yearDir)) continue;

    // Find CSV matching this municipality name
    const files = fs.readdirSync(yearDir);
    const match = files.find((f) =>
      f.toLowerCase().startsWith(municipality.toLowerCase() + "_-_") && f.endsWith(".csv")
    );

    if (!match) continue;

    try {
      const content = fs.readFileSync(path.join(yearDir, match), "utf-8");
      const lines = content.split("\n");
      if (lines.length < 2) continue;

      // Line 2 (index 1) has the data — CSV with quoted values containing commas
      const dataLine = lines[1];
      // Parse CSV respecting quoted fields
      const fields: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of dataLine) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === "," && !inQuotes) { fields.push(current.trim()); current = ""; continue; }
        current += ch;
      }
      fields.push(current.trim());

      // Fields: [label, population, offenses, cleared, pct_cleared, rate_per_100k, ...]
      const population = parseInt(fields[1].replace(/,/g, "")) || 0;
      const offenses = parseInt(fields[2].replace(/,/g, "")) || 0;
      const ratePer100k = parseFloat(fields[5].replace(/,/g, "")) || 0;

      if (population > 0 && ratePer100k > 0) {
        return { rate: ratePer100k, population, offenses, year };
      }
    } catch {}
  }

  return null;
}

async function fetchCrimeData(neighborhoods: Neighborhood[]): Promise<void> {
  console.log("\n=== CRIME / SAFETY DATA ===");

  // Group neighborhoods by municipality
  const byMunicipality = new Map<string, number[]>();
  for (let i = 0; i < neighborhoods.length; i++) {
    const muni = getMunicipality(neighborhoods[i]);
    if (!byMunicipality.has(muni)) byMunicipality.set(muni, []);
    byMunicipality.get(muni)!.push(i);
  }

  console.log(`Municipalities to query: ${Array.from(byMunicipality.keys()).join(", ")}\n`);

  // For Boston neighborhoods: use data.boston.gov with lat/lng
  console.log("--- Boston neighborhoods (data.boston.gov) ---");
  const bostonIndices = byMunicipality.get("Boston") || [];
  const bostonCounts: { index: number; count: number }[] = [];

  for (const idx of bostonIndices) {
    const n = neighborhoods[idx];
    console.log(`  ${n.name}...`);
    const count = await fetchBostonCrimeCount(n.centroid.lat, n.centroid.lng);
    bostonCounts.push({ index: idx, count });
    console.log(`    Incidents: ${count}`);
    await sleep(500);
  }

  // Normalize Boston crime counts to 0-100 safety score (inverse)
  if (bostonCounts.length > 0) {
    const counts = bostonCounts.map((b) => b.count);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    const range = maxCount - minCount || 1;

    for (const { index, count } of bostonCounts) {
      // Invert: low crime = high safety. Scale 30-95 range.
      const normalized = 1 - (count - minCount) / range;
      neighborhoods[index].safety = clamp(
        Math.round(normalized * 65 + 30),
        30,
        95
      );
      console.log(
        `  ${neighborhoods[index].name}: ${count} incidents → safety ${neighborhoods[index].safety}`
      );
    }
  }

  // For non-Boston municipalities: use local CSV crime data
  console.log("\n--- Non-Boston municipalities (local CSV data) ---");
  const csvRates: { municipality: string; rate: number; indices: number[] }[] = [];

  for (const [municipality, indices] of byMunicipality) {
    if (municipality === "Boston") continue;

    console.log(`  ${municipality}...`);
    const data = readLocalCrimeRate(municipality);
    if (data) {
      console.log(`    ${data.year}: ${data.offenses} offenses, pop ${data.population}, rate ${data.rate.toFixed(1)}/100k`);
      csvRates.push({ municipality, rate: data.rate, indices });
    } else {
      console.log(`    No CSV data found, keeping existing safety scores`);
    }
  }

  // Normalize CSV rates to safety scores (same scale as Boston: 30-95)
  if (csvRates.length > 0) {
    const rates = csvRates.map((f) => f.rate);
    const maxRate = Math.max(...rates);
    const minRate = Math.min(...rates);
    const range = maxRate - minRate || 1;

    for (const { rate, indices } of csvRates) {
      const normalized = 1 - (rate - minRate) / range;
      const safety = clamp(Math.round(normalized * 65 + 30), 30, 95);

      for (const idx of indices) {
        neighborhoods[idx].safety = safety;
        console.log(`  ${neighborhoods[idx].name}: rate ${rate.toFixed(1)}/100k → safety ${safety}`);
      }
    }
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.includes("--all") || args.length === 0;
  const runMbta = runAll || args.includes("--mbta");
  const runRent = runAll || args.includes("--rent");
  const runCrime = runAll || args.includes("--crime");

  const neighborhoods = loadNeighborhoods();
  console.log(`Loaded ${neighborhoods.length} neighborhoods\n`);

  const tasks: string[] = [];
  if (runMbta) tasks.push("MBTA");
  if (runRent) tasks.push("Census Rent");
  if (runCrime) tasks.push("Crime/Safety");
  console.log(`Running: ${tasks.join(", ")}\n`);

  if (runMbta) await fetchMbtaData(neighborhoods);
  if (runRent) await fetchCensusRent(neighborhoods);
  if (runCrime) await fetchCrimeData(neighborhoods);

  saveNeighborhoods(neighborhoods);
  console.log("\nDone!");
}

main().catch(console.error);
