# Neighborhood Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static `/dashboard` page showing aggregate neighborhood insights (rent, value, transit, safety, lifestyle) from the existing 44-neighborhood dataset.

**Architecture:** A single client-side page (`app/dashboard/page.tsx`) fetches `neighborhoods.json` and passes it to a pure-function data module (`lib/dashboardData.ts`) that computes all rankings and clusters. The page renders the results as a scrollable infographic with a hero stats row and five category cards. A "Dashboard" link is added to the existing `UserMenu` dropdown.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4

---

### Task 1: Dashboard Data Logic — Types and Rent Rankings

**Files:**
- Create: `lib/dashboardData.ts`
- Test: `__tests__/dashboardData.test.ts`

- [ ] **Step 1: Write failing tests for rent ranking functions**

Create `__tests__/dashboardData.test.ts`:

```typescript
import type { Neighborhood } from "@/lib/types";
import {
  computeMedianRent,
  computeRentLeaderboard,
} from "@/lib/dashboardData";

// Minimal neighborhood factory — only fields used by dashboard logic
function makeNeighborhood(
  overrides: Partial<Neighborhood> & { name: string }
): Neighborhood {
  return {
    id: overrides.name.toLowerCase().replace(/\s/g, "-"),
    region: "boston",
    description: "",
    localTips: "",
    rent: { studio: [1000, 1200], oneBr: [1500, 1700], twoBr: [2000, 2400] },
    safety: 70,
    safetyTrend: "stable",
    walkScore: 70,
    transitScore: 60,
    bikeScore: 50,
    lifestyleProfile: {
      nightlifeVsQuiet: 3,
      urbanVsSuburban: 3,
      trendyVsFamily: 3,
      communityVsPrivacy: 3,
    },
    communityScore: 60,
    amenities: { restaurants: 10, nightlife: 5, gyms: 3, grocery: 4, parks: 3 },
    mbtaLines: [],
    mbtaStations: [],
    busRoutes: [],
    collegeArea: false,
    parkingFriendly: true,
    centroid: { lat: 42.36, lng: -71.06 },
    ...overrides,
  };
}

describe("computeMedianRent", () => {
  it("returns the average of oneBr low and high", () => {
    const n = makeNeighborhood({ name: "Test", rent: { studio: [1000, 1200], oneBr: [2000, 3000], twoBr: [3000, 4000] } });
    expect(computeMedianRent(n)).toBe(2500);
  });
});

describe("computeRentLeaderboard", () => {
  it("returns top 5 most expensive and top 5 most affordable", () => {
    const neighborhoods = [
      makeNeighborhood({ name: "Cheap", rent: { studio: [800, 900], oneBr: [1000, 1200], twoBr: [1500, 1700] } }),
      makeNeighborhood({ name: "Mid", rent: { studio: [1200, 1400], oneBr: [1800, 2000], twoBr: [2500, 2700] } }),
      makeNeighborhood({ name: "Pricey", rent: { studio: [2000, 2400], oneBr: [3000, 3400], twoBr: [4000, 4600] } }),
    ];
    const result = computeRentLeaderboard(neighborhoods);
    expect(result.mostExpensive[0].name).toBe("Pricey");
    expect(result.mostExpensive[0].rent).toBe(3200);
    expect(result.mostAffordable[0].name).toBe("Cheap");
    expect(result.mostAffordable[0].rent).toBe(1100);
  });

  it("caps lists at 5 entries", () => {
    const neighborhoods = Array.from({ length: 10 }, (_, i) =>
      makeNeighborhood({
        name: `N${i}`,
        rent: { studio: [1000, 1200], oneBr: [1000 + i * 200, 1200 + i * 200], twoBr: [2000, 2400] },
      })
    );
    const result = computeRentLeaderboard(neighborhoods);
    expect(result.mostExpensive).toHaveLength(5);
    expect(result.mostAffordable).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest __tests__/dashboardData.test.ts --no-coverage 2>&1 | tail -10`

Expected: FAIL — cannot find module `@/lib/dashboardData`

- [ ] **Step 3: Implement computeMedianRent and computeRentLeaderboard**

Create `lib/dashboardData.ts`:

```typescript
import type { Neighborhood, MbtaLine, SafetyTrend } from "./types";

// --- Helpers ---

export function computeMedianRent(n: Neighborhood): number {
  return Math.round((n.rent.oneBr[0] + n.rent.oneBr[1]) / 2);
}

// --- Rent Leaderboard ---

interface RentEntry {
  name: string;
  rent: number;
}

interface RentLeaderboard {
  mostExpensive: RentEntry[];
  mostAffordable: RentEntry[];
}

export function computeRentLeaderboard(
  neighborhoods: Neighborhood[]
): RentLeaderboard {
  const entries: RentEntry[] = neighborhoods.map((n) => ({
    name: n.name,
    rent: computeMedianRent(n),
  }));

  const byRentDesc = [...entries].sort((a, b) => b.rent - a.rent);
  const byRentAsc = [...entries].sort((a, b) => a.rent - b.rent);

  return {
    mostExpensive: byRentDesc.slice(0, 5),
    mostAffordable: byRentAsc.slice(0, 5),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest __tests__/dashboardData.test.ts --no-coverage 2>&1 | tail -10`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder && git add lib/dashboardData.ts __tests__/dashboardData.test.ts && git commit -m "feat(dashboard): add rent leaderboard data logic with tests"
```

---

### Task 2: Value Score and Commute Score

**Files:**
- Modify: `lib/dashboardData.ts`
- Modify: `__tests__/dashboardData.test.ts`

- [ ] **Step 1: Write failing tests for value and commute scores**

Append to `__tests__/dashboardData.test.ts`:

```typescript
import {
  computeValueScore,
  computeBestValue,
  computeCommuteScore,
  computeCommuteFriendly,
} from "@/lib/dashboardData";

describe("computeValueScore", () => {
  it("computes (safety + walkScore + transitScore) / 3 / medianRent * 1000", () => {
    const n = makeNeighborhood({
      name: "Test",
      safety: 80,
      walkScore: 70,
      transitScore: 60,
      rent: { studio: [1000, 1200], oneBr: [2000, 2000], twoBr: [3000, 3000] },
    });
    // (80 + 70 + 60) / 3 / 2000 * 1000 = 70 / 2000 * 1000 = 35
    expect(computeValueScore(n)).toBeCloseTo(35, 1);
  });
});

describe("computeBestValue", () => {
  it("ranks neighborhoods by value score descending, top 5", () => {
    const neighborhoods = [
      makeNeighborhood({ name: "Expensive", safety: 80, walkScore: 80, transitScore: 80, rent: { studio: [3000, 3000], oneBr: [4000, 4000], twoBr: [5000, 5000] } }),
      makeNeighborhood({ name: "Bargain", safety: 80, walkScore: 80, transitScore: 80, rent: { studio: [800, 800], oneBr: [1000, 1000], twoBr: [1500, 1500] } }),
    ];
    const result = computeBestValue(neighborhoods);
    expect(result[0].name).toBe("Bargain");
    expect(result[0].valueScore).toBeGreaterThan(result[1].valueScore);
  });
});

describe("computeCommuteScore", () => {
  it("weights transit 50%, walk 30%, MBTA coverage 20%", () => {
    const n = makeNeighborhood({
      name: "Test",
      transitScore: 90,
      walkScore: 80,
      mbtaLines: ["red", "green", "orange"] as MbtaLine[],
    });
    // 90 * 0.5 + 80 * 0.3 + (3/7)*100 * 0.2 = 45 + 24 + 8.57 = 77.57
    expect(computeCommuteScore(n)).toBeCloseTo(77.57, 0);
  });
});

describe("computeCommuteFriendly", () => {
  it("ranks by commute score descending, top 5", () => {
    const neighborhoods = [
      makeNeighborhood({ name: "Low", transitScore: 30, walkScore: 30, mbtaLines: [] }),
      makeNeighborhood({ name: "High", transitScore: 95, walkScore: 90, mbtaLines: ["red", "orange", "green", "blue"] as MbtaLine[] }),
    ];
    const result = computeCommuteFriendly(neighborhoods);
    expect(result[0].name).toBe("High");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest __tests__/dashboardData.test.ts --no-coverage 2>&1 | tail -10`

Expected: FAIL — cannot find `computeValueScore`, etc.

- [ ] **Step 3: Implement value and commute functions**

Append to `lib/dashboardData.ts`:

```typescript
// --- Value for Money ---

export function computeValueScore(n: Neighborhood): number {
  const avgQuality = (n.safety + n.walkScore + n.transitScore) / 3;
  const rent = computeMedianRent(n);
  if (rent <= 0) return 0;
  return avgQuality / rent * 1000;
}

interface ValueEntry {
  name: string;
  rent: number;
  safety: number;
  walkScore: number;
  transitScore: number;
  valueScore: number;
}

export function computeBestValue(neighborhoods: Neighborhood[]): ValueEntry[] {
  return neighborhoods
    .map((n) => ({
      name: n.name,
      rent: computeMedianRent(n),
      safety: n.safety,
      walkScore: n.walkScore,
      transitScore: n.transitScore,
      valueScore: Math.round(computeValueScore(n) * 10) / 10,
    }))
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, 5);
}

// --- Commute-Friendly ---

export function computeCommuteScore(n: Neighborhood): number {
  const lineCoverage = (n.mbtaLines.length / 7) * 100;
  return n.transitScore * 0.5 + n.walkScore * 0.3 + lineCoverage * 0.2;
}

interface CommuteEntry {
  name: string;
  transitScore: number;
  walkScore: number;
  mbtaLines: MbtaLine[];
  commuteScore: number;
}

export function computeCommuteFriendly(neighborhoods: Neighborhood[]): CommuteEntry[] {
  return neighborhoods
    .map((n) => ({
      name: n.name,
      transitScore: n.transitScore,
      walkScore: n.walkScore,
      mbtaLines: n.mbtaLines,
      commuteScore: Math.round(computeCommuteScore(n) * 10) / 10,
    }))
    .sort((a, b) => b.commuteScore - a.commuteScore)
    .slice(0, 5);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest __tests__/dashboardData.test.ts --no-coverage 2>&1 | tail -10`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder && git add lib/dashboardData.ts __tests__/dashboardData.test.ts && git commit -m "feat(dashboard): add value score and commute score logic with tests"
```

---

### Task 3: Safety Rankings and Lifestyle Clusters

**Files:**
- Modify: `lib/dashboardData.ts`
- Modify: `__tests__/dashboardData.test.ts`

- [ ] **Step 1: Write failing tests for safety and lifestyle**

Append to `__tests__/dashboardData.test.ts`:

```typescript
import {
  computeSafetyRankings,
  computeLifestyleClusters,
} from "@/lib/dashboardData";

describe("computeSafetyRankings", () => {
  it("returns top 5 safest and top 5 trending safer", () => {
    const neighborhoods = [
      makeNeighborhood({ name: "Safe1", safety: 90, safetyTrend: "stable" }),
      makeNeighborhood({ name: "Safe2", safety: 85, safetyTrend: "improving" }),
      makeNeighborhood({ name: "Unsafe", safety: 40, safetyTrend: "declining" }),
      makeNeighborhood({ name: "Improving", safety: 60, safetyTrend: "improving" }),
    ];
    const result = computeSafetyRankings(neighborhoods);
    expect(result.safest[0].name).toBe("Safe1");
    expect(result.safest[0].safety).toBe(90);
    expect(result.trendingSafer[0].name).toBe("Safe2");
    expect(result.trendingSafer).toHaveLength(2); // only 2 improving
  });

  it("caps both lists at 5", () => {
    const neighborhoods = Array.from({ length: 10 }, (_, i) =>
      makeNeighborhood({ name: `N${i}`, safety: 50 + i * 5, safetyTrend: "improving" as SafetyTrend })
    );
    const result = computeSafetyRankings(neighborhoods);
    expect(result.safest).toHaveLength(5);
    expect(result.trendingSafer).toHaveLength(5);
  });
});

describe("computeLifestyleClusters", () => {
  it("assigns neighborhoods to correct clusters based on lifestyle thresholds", () => {
    const neighborhoods = [
      makeNeighborhood({ name: "Party", lifestyleProfile: { nightlifeVsQuiet: 1, urbanVsSuburban: 1, trendyVsFamily: 2, communityVsPrivacy: 3 } }),
      makeNeighborhood({ name: "Family", lifestyleProfile: { nightlifeVsQuiet: 4, urbanVsSuburban: 3, trendyVsFamily: 5, communityVsPrivacy: 3 } }),
      makeNeighborhood({ name: "Urban", lifestyleProfile: { nightlifeVsQuiet: 3, urbanVsSuburban: 1, trendyVsFamily: 3, communityVsPrivacy: 3 } }),
      makeNeighborhood({ name: "Suburb", lifestyleProfile: { nightlifeVsQuiet: 3, urbanVsSuburban: 5, trendyVsFamily: 3, communityVsPrivacy: 3 } }),
    ];
    const result = computeLifestyleClusters(neighborhoods);
    expect(result.nightlife).toContain("Party");
    expect(result.family).toContain("Family");
    expect(result.urban).toContain("Urban");
    expect(result.quiet).toContain("Suburb");
  });

  it("a neighborhood can appear in multiple clusters", () => {
    const neighborhoods = [
      makeNeighborhood({ name: "PartyUrban", lifestyleProfile: { nightlifeVsQuiet: 1, urbanVsSuburban: 1, trendyVsFamily: 3, communityVsPrivacy: 3 } }),
    ];
    const result = computeLifestyleClusters(neighborhoods);
    expect(result.nightlife).toContain("PartyUrban");
    expect(result.urban).toContain("PartyUrban");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest __tests__/dashboardData.test.ts --no-coverage 2>&1 | tail -10`

Expected: FAIL

- [ ] **Step 3: Implement safety and lifestyle functions**

Append to `lib/dashboardData.ts`:

```typescript
// --- Safety Rankings ---

interface SafetyEntry {
  name: string;
  safety: number;
  safetyTrend: SafetyTrend;
}

interface SafetyRankings {
  safest: SafetyEntry[];
  trendingSafer: SafetyEntry[];
}

export function computeSafetyRankings(neighborhoods: Neighborhood[]): SafetyRankings {
  const entries: SafetyEntry[] = neighborhoods.map((n) => ({
    name: n.name,
    safety: n.safety,
    safetyTrend: n.safetyTrend,
  }));

  const safest = [...entries]
    .sort((a, b) => b.safety - a.safety)
    .slice(0, 5);

  const trendingSafer = entries
    .filter((e) => e.safetyTrend === "improving")
    .sort((a, b) => b.safety - a.safety)
    .slice(0, 5);

  return { safest, trendingSafer };
}

// --- Lifestyle Clusters ---

interface LifestyleClusters {
  nightlife: string[];
  family: string[];
  urban: string[];
  quiet: string[];
}

export function computeLifestyleClusters(neighborhoods: Neighborhood[]): LifestyleClusters {
  return {
    nightlife: neighborhoods
      .filter((n) => n.lifestyleProfile.nightlifeVsQuiet <= 2)
      .map((n) => n.name),
    family: neighborhoods
      .filter((n) => n.lifestyleProfile.trendyVsFamily >= 4)
      .map((n) => n.name),
    urban: neighborhoods
      .filter((n) => n.lifestyleProfile.urbanVsSuburban <= 2)
      .map((n) => n.name),
    quiet: neighborhoods
      .filter((n) => n.lifestyleProfile.urbanVsSuburban >= 4)
      .map((n) => n.name),
  };
}
```

Note on lifestyle thresholds: The spec says `nightlifeVsQuiet >= 4` for nightlife, but in the data `1 = nightlife, 5 = quiet` — so nightlife hubs are `<= 2`. Same inversion for urban: `1 = urban, 5 = suburban`. The test fixtures above use the correct interpretation. Similarly, family-friendly is `trendyVsFamily >= 4` since `1 = trendy, 5 = family`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest __tests__/dashboardData.test.ts --no-coverage 2>&1 | tail -10`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder && git add lib/dashboardData.ts __tests__/dashboardData.test.ts && git commit -m "feat(dashboard): add safety rankings and lifestyle clusters with tests"
```

---

### Task 4: Hero Stats and computeDashboardData Orchestrator

**Files:**
- Modify: `lib/dashboardData.ts`
- Modify: `__tests__/dashboardData.test.ts`

- [ ] **Step 1: Write failing tests for hero stats and orchestrator**

Append to `__tests__/dashboardData.test.ts`:

```typescript
import { computeDashboardData } from "@/lib/dashboardData";

describe("computeDashboardData", () => {
  const neighborhoods = [
    makeNeighborhood({
      name: "Expensive",
      rent: { studio: [2500, 3000], oneBr: [3000, 3400], twoBr: [4000, 4600] },
      safety: 60,
      walkScore: 90,
      transitScore: 85,
      mbtaLines: ["red", "green"] as MbtaLine[],
      safetyTrend: "stable" as SafetyTrend,
      lifestyleProfile: { nightlifeVsQuiet: 2, urbanVsSuburban: 1, trendyVsFamily: 2, communityVsPrivacy: 2 },
    }),
    makeNeighborhood({
      name: "Safe",
      rent: { studio: [1500, 1700], oneBr: [2000, 2200], twoBr: [2800, 3000] },
      safety: 95,
      walkScore: 70,
      transitScore: 60,
      mbtaLines: ["green"] as MbtaLine[],
      safetyTrend: "improving" as SafetyTrend,
      lifestyleProfile: { nightlifeVsQuiet: 4, urbanVsSuburban: 4, trendyVsFamily: 4, communityVsPrivacy: 3 },
    }),
    makeNeighborhood({
      name: "Transit",
      rent: { studio: [1800, 2000], oneBr: [2200, 2600], twoBr: [3200, 3600] },
      safety: 70,
      walkScore: 85,
      transitScore: 96,
      mbtaLines: ["red", "orange", "green", "silver", "blue"] as MbtaLine[],
      safetyTrend: "stable" as SafetyTrend,
      lifestyleProfile: { nightlifeVsQuiet: 1, urbanVsSuburban: 1, trendyVsFamily: 3, communityVsPrivacy: 3 },
    }),
  ];

  it("returns hero stats with correct winners", () => {
    const data = computeDashboardData(neighborhoods);
    expect(data.heroStats.mostExpensive.name).toBe("Expensive");
    expect(data.heroStats.safest.name).toBe("Safe");
    expect(data.heroStats.bestTransit.name).toBe("Transit");
  });

  it("returns all sections populated", () => {
    const data = computeDashboardData(neighborhoods);
    expect(data.rentLeaderboard.mostExpensive.length).toBeGreaterThan(0);
    expect(data.rentLeaderboard.mostAffordable.length).toBeGreaterThan(0);
    expect(data.bestValue.length).toBeGreaterThan(0);
    expect(data.commuteFriendly.length).toBeGreaterThan(0);
    expect(data.safety.safest.length).toBeGreaterThan(0);
    expect(data.lifestyleClusters.nightlife.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest __tests__/dashboardData.test.ts --no-coverage 2>&1 | tail -10`

Expected: FAIL

- [ ] **Step 3: Implement computeDashboardData**

Append to `lib/dashboardData.ts`:

```typescript
// --- Orchestrator ---

export interface DashboardData {
  heroStats: {
    mostExpensive: { name: string; rent: number };
    safest: { name: string; safety: number };
    bestTransit: { name: string; transitScore: number };
    bestValue: { name: string; valueScore: number };
  };
  rentLeaderboard: RentLeaderboard;
  bestValue: ValueEntry[];
  commuteFriendly: CommuteEntry[];
  safety: SafetyRankings;
  lifestyleClusters: LifestyleClusters;
}

export function computeDashboardData(neighborhoods: Neighborhood[]): DashboardData {
  const rentLeaderboard = computeRentLeaderboard(neighborhoods);
  const bestValue = computeBestValue(neighborhoods);
  const commuteFriendly = computeCommuteFriendly(neighborhoods);
  const safety = computeSafetyRankings(neighborhoods);
  const lifestyleClusters = computeLifestyleClusters(neighborhoods);

  return {
    heroStats: {
      mostExpensive: rentLeaderboard.mostExpensive[0],
      safest: safety.safest[0],
      bestTransit: {
        name: commuteFriendly[0].name,
        transitScore: commuteFriendly[0].transitScore,
      },
      bestValue: {
        name: bestValue[0].name,
        valueScore: bestValue[0].valueScore,
      },
    },
    rentLeaderboard,
    bestValue,
    commuteFriendly,
    safety,
    lifestyleClusters,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest __tests__/dashboardData.test.ts --no-coverage 2>&1 | tail -10`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder && git add lib/dashboardData.ts __tests__/dashboardData.test.ts && git commit -m "feat(dashboard): add hero stats and computeDashboardData orchestrator"
```

---

### Task 5: Dashboard Page — Header, Hero Stats, and Rent Leaderboard

**Files:**
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page with header, hero stats, and rent section**

Create `app/dashboard/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Neighborhood } from "@/lib/types";
import { computeDashboardData, type DashboardData } from "@/lib/dashboardData";

const MBTA_COLORS: Record<string, string> = {
  red: "bg-red-600",
  orange: "bg-orange-600",
  green: "bg-green-600",
  blue: "bg-blue-600",
  silver: "bg-purple-600",
  bus: "bg-yellow-600",
  ferry: "bg-cyan-600",
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/data/neighborhoods.json")
      .then((r) => r.json())
      .then((neighborhoods: Neighborhood[]) => {
        setData(computeDashboardData(neighborhoods));
      });
  }, []);

  if (!data) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/60 animate-pulse">Loading dashboard...</p>
      </main>
    );
  }

  const maxRent = data.rentLeaderboard.mostExpensive[0]?.rent ?? 1;

  return (
    <main className="min-h-screen bg-black">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
        >
          ← Back
        </button>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            Boston Neighborhoods at a Glance
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            44 neighborhoods compared across rent, safety, transit, and lifestyle
          </p>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-red-300">Most Expensive</p>
            <p className="text-xl font-bold text-white mt-1">${data.heroStats.mostExpensive.rent.toLocaleString()}/mo</p>
            <p className="text-sm text-slate-400 mt-0.5">{data.heroStats.mostExpensive.name} (1BR)</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-emerald-300">Safest</p>
            <p className="text-xl font-bold text-white mt-1">{data.heroStats.safest.safety} / 100</p>
            <p className="text-sm text-slate-400 mt-0.5">{data.heroStats.safest.name}</p>
          </div>
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/15 p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-blue-300">Best Transit</p>
            <p className="text-xl font-bold text-white mt-1">Score: {data.heroStats.bestTransit.transitScore}</p>
            <p className="text-sm text-slate-400 mt-0.5">{data.heroStats.bestTransit.name}</p>
          </div>
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/15 p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-purple-300">Best Value</p>
            <p className="text-xl font-bold text-white mt-1">Score: {data.heroStats.bestValue.valueScore}</p>
            <p className="text-sm text-slate-400 mt-0.5">{data.heroStats.bestValue.name}</p>
          </div>
        </div>

        {/* Rent Leaderboard */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🏠</span>
            <h2 className="text-base font-semibold text-white">Rent Leaderboard</h2>
            <span className="text-slate-500 text-xs ml-auto">1BR median rent</span>
          </div>

          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-red-400 mb-2">Most Expensive</p>
            <div className="space-y-2">
              {data.rentLeaderboard.mostExpensive.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-4">{i + 1}.</span>
                  <span className="text-sm text-white flex-1 min-w-0 truncate">{entry.name}</span>
                  <div className="w-28 sm:w-36 h-2 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${(entry.rent / maxRent) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-red-400 w-16 text-right flex-shrink-0">
                    ${entry.rent.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-emerald-400 mb-2">Most Affordable</p>
            <div className="space-y-2">
              {data.rentLeaderboard.mostAffordable.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-4">{i + 1}.</span>
                  <span className="text-sm text-white flex-1 min-w-0 truncate">{entry.name}</span>
                  <div className="w-28 sm:w-36 h-2 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${(entry.rent / maxRent) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-emerald-400 w-16 text-right flex-shrink-0">
                    ${entry.rent.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify the page loads in the browser**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx next build 2>&1 | tail -5`

Expected: Build succeeds. Also manually check `http://localhost:3000/dashboard` if dev server is running.

- [ ] **Step 3: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder && git add app/dashboard/page.tsx && git commit -m "feat(dashboard): add page with header, hero stats, and rent leaderboard"
```

---

### Task 6: Dashboard Page — Value, Commute, Safety, and Lifestyle Sections

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add the Value for Money section**

Insert after the Rent Leaderboard `</section>` closing tag, before the closing `</div></main>`:

```tsx
        {/* Best Value for Money */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">💰</span>
            <h2 className="text-base font-semibold text-white">Best Value for Money</h2>
          </div>
          <p className="text-xs text-slate-500 ml-7 mb-4">
            Composite of safety + walk score + transit score per rent dollar
          </p>
          <div className="space-y-2">
            {data.bestValue.map((entry, i) => (
              <div
                key={entry.name}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                  i === 0
                    ? "border-purple-500/20 bg-purple-500/10"
                    : "border-white/5 bg-white/[0.03]"
                }`}
              >
                <span className="text-purple-300 font-bold text-base w-5">{i + 1}</span>
                <span className="text-sm text-white flex-1 min-w-0 truncate">{entry.name}</span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Safety {entry.safety} · Walk {entry.walkScore} · Transit {entry.transitScore}
                </span>
                <span className="text-sm font-semibold text-emerald-400 flex-shrink-0">
                  ${entry.rent.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Commute-Friendly */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🚇</span>
            <h2 className="text-base font-semibold text-white">Commute-Friendly</h2>
          </div>
          <p className="text-xs text-slate-500 ml-7 mb-4">
            Ranked by transit score, walk score, and MBTA line coverage
          </p>
          <div className="space-y-2">
            {data.commuteFriendly.map((entry, i) => (
              <div
                key={entry.name}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                  i === 0
                    ? "border-blue-500/20 bg-blue-500/10"
                    : "border-white/5 bg-white/[0.03]"
                }`}
              >
                <span className="text-blue-300 font-bold text-base w-5">{i + 1}</span>
                <span className="text-sm text-white flex-1 min-w-0 truncate">{entry.name}</span>
                <div className="flex flex-wrap gap-1">
                  {entry.mbtaLines
                    .filter((line) => line !== "bus" && line !== "ferry")
                    .map((line) => (
                      <span
                        key={line}
                        className={`${MBTA_COLORS[line] ?? "bg-gray-600"} text-white text-[10px] px-1.5 py-0.5 rounded`}
                      >
                        {line.charAt(0).toUpperCase() + line.slice(1)}
                      </span>
                    ))}
                </div>
                <span className="text-xs text-blue-300 flex-shrink-0">
                  Transit: {entry.transitScore}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Safety Rankings */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🛡️</span>
            <h2 className="text-base font-semibold text-white">Safety Rankings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-400 mb-3">Safest</p>
              <div className="space-y-2">
                {data.safety.safest.map((entry, i) => (
                  <div key={entry.name} className="flex justify-between items-center">
                    <span className="text-sm text-white">{i + 1}. {entry.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-emerald-400">{entry.safety}</span>
                      <span
                        className={`text-[10px] ${
                          entry.safetyTrend === "improving"
                            ? "text-emerald-400"
                            : entry.safetyTrend === "declining"
                              ? "text-red-400"
                              : "text-slate-500"
                        }`}
                      >
                        {entry.safetyTrend === "improving"
                          ? "▲ improving"
                          : entry.safetyTrend === "declining"
                            ? "▼ declining"
                            : "— stable"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-blue-400 mb-3">Trending Safer ▲</p>
              <div className="space-y-2">
                {data.safety.trendingSafer.map((entry, i) => (
                  <div key={entry.name} className="flex justify-between items-center">
                    <span className="text-sm text-white">{i + 1}. {entry.name}</span>
                    <span className="text-sm text-blue-400">{entry.safety} → improving</span>
                  </div>
                ))}
                {data.safety.trendingSafer.length === 0 && (
                  <p className="text-sm text-slate-500">No neighborhoods currently trending safer</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Lifestyle Clusters */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🎭</span>
            <h2 className="text-base font-semibold text-white">Lifestyle Clusters</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <p className="text-sm font-semibold text-amber-300 mb-1">🌃 Nightlife Hubs</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {data.lifestyleClusters.nightlife.join(" · ") || "None"}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
              <p className="text-sm font-semibold text-emerald-300 mb-1">👨‍👩‍👧 Family-Friendly</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {data.lifestyleClusters.family.join(" · ") || "None"}
              </p>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
              <p className="text-sm font-semibold text-blue-300 mb-1">🏙️ Urban Core</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {data.lifestyleClusters.urban.join(" · ") || "None"}
              </p>
            </div>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-3">
              <p className="text-sm font-semibold text-purple-300 mb-1">🌳 Quiet & Suburban</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {data.lifestyleClusters.quiet.join(" · ") || "None"}
              </p>
            </div>
          </div>
        </section>
```

- [ ] **Step 2: Verify the full page builds and renders**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx next build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder && git add app/dashboard/page.tsx && git commit -m "feat(dashboard): add value, commute, safety, and lifestyle sections"
```

---

### Task 7: Add Dashboard Link to UserMenu

**Files:**
- Modify: `components/UserMenu.tsx`

- [ ] **Step 1: Add Dashboard link above the GitHub link**

In `components/UserMenu.tsx`, insert a new `<a>` element between the email `<div>` block (line 75) and the GitHub `<a>` block (line 76). The new link:

```tsx
          <a
            href="/dashboard"
            className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 text-white/70"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            Dashboard
          </a>
```

- [ ] **Step 2: Verify build succeeds**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx next build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder && git add components/UserMenu.tsx && git commit -m "feat(dashboard): add Dashboard link to UserMenu dropdown"
```

---

### Task 8: Run Full Test Suite and Lint

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest --no-coverage 2>&1 | tail -10`

Expected: All tests pass (previous 138 + new dashboard tests).

- [ ] **Step 2: Run lint**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npm run lint 2>&1`

Expected: Clean, no errors.

- [ ] **Step 3: Run production build**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx next build 2>&1 | tail -10`

Expected: Build succeeds with `/dashboard` in the output.

- [ ] **Step 4: Commit any lint fixes if needed, then push**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder && git push origin master
```
