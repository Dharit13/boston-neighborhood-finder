# Neighborhood Dashboard — Design Spec

## Overview

A standalone `/dashboard` page behind auth that presents aggregate insights across all 44 neighborhoods. No wizard input required — purely data-driven from `neighborhoods.json`. Static infographic layout (scrollable, no drill-down interactivity). Mobile-first responsive design.

## Route

- **Path:** `/dashboard`
- **Auth:** Required (same Supabase auth gate as all other pages)
- **Data source:** `public/data/neighborhoods.json` fetched client-side
- **Navigation:** Back button at top (uses `router.back()`). Accessible from the main app (e.g., nav link or user menu).

## Page Structure

### Header

- Back button (← Back) at top-left
- Title: "Boston Neighborhoods at a Glance"
- Subtitle: "44 neighborhoods compared across rent, safety, transit, and lifestyle"

### 1. Hero Stats Row

Four compact stat cards in a row (2x2 on mobile, 4-across on desktop). Each card shows:

- **Label** (uppercase small text)
- **Hero number** (large, bold)
- **Neighborhood name** (muted text)

The four stats:

| Card | Color | Metric | How computed |
|------|-------|--------|--------------|
| Most Expensive | Red | Highest median 1BR rent | Max of `(rent.oneBr[0] + rent.oneBr[1]) / 2` across all neighborhoods |
| Safest | Green | Highest safety score | Max of `neighborhood.safety` |
| Best Transit | Blue | Highest transit score | Max of `neighborhood.transitScore` |
| Best Value | Purple | Highest value composite | Max of value score (see Value section) |

### 2. Rent Leaderboard

Full-width card with two sub-sections:

**Most Expensive (top 5):**
- Ranked list showing neighborhood name, horizontal bar (proportional to max rent), and dollar amount
- Bar color: red
- Uses median 1BR rent: `(rent.oneBr[0] + rent.oneBr[1]) / 2`

**Most Affordable (top 5):**
- Same layout, bar color: green
- Sorted ascending by median 1BR rent

Subtitle: "1BR median rent"

### 3. Best Value for Money

Full-width card. Ranked list of top 5 neighborhoods by a "value score" composite:

**Value score formula:**
```
valueScore = (safety + walkScore + transitScore) / 3 / medianRent * 1000
```

This produces a "quality points per rent dollar" metric. Higher = better value.

Each row shows:
- Rank number
- Neighborhood name
- Inline stats: `Safety X · Walk X · Transit X`
- Rent in green

Subtitle: "Composite of safety + walk score + transit score per rent dollar"

### 4. Commute-Friendly

Full-width card. Top 5 neighborhoods ranked by a commute composite:

**Commute score formula:**
```
commuteScore = transitScore * 0.5 + walkScore * 0.3 + (mbtaLines.length / 7) * 100 * 0.2
```

Each row shows:
- Rank number
- Neighborhood name
- Colored MBTA line badges (Red, Orange, Green, Blue, Silver — using standard MBTA colors)
- Transit score

Subtitle: "Ranked by transit score, walk score, and MBTA line coverage"

### 5. Safety Rankings

Full-width card with a 2-column layout (stacked on mobile):

**Left column — Safest (top 5):**
- Neighborhood name, safety score, and trend indicator
- Trend: `▲ improving` (green), `— stable` (gray), `▼ declining` (red)

**Right column — Trending Safer (top 5):**
- Filtered to neighborhoods where `safetyTrend === "improving"`, sorted by safety score descending
- Shows neighborhood name and `score → improving`

### 6. Lifestyle Clusters

Full-width card with a 2x2 grid (stacked on mobile). Four cluster cards:

| Cluster | Color | Filter logic |
|---------|-------|-------------|
| Nightlife Hubs | Amber | `lifestyleProfile.nightlifeVsQuiet >= 4` |
| Family-Friendly | Green | `lifestyleProfile.trendyVsFamily <= 2` |
| Urban Core | Blue | `lifestyleProfile.urbanVsSuburban >= 4` |
| Quiet & Suburban | Purple | `lifestyleProfile.urbanVsSuburban <= 2` |

Each card shows the cluster label with an emoji and a comma-separated list of matching neighborhood names.

## Responsive Behavior

All grids use Tailwind responsive classes:

- **Hero stats:** `grid-cols-2 md:grid-cols-4`
- **Safety columns:** `grid-cols-1 md:grid-cols-2`
- **Lifestyle clusters:** `grid-cols-1 sm:grid-cols-2`
- **Rent bars and ranked lists:** Full-width, already mobile-friendly
- **MBTA line badges in commute section:** Wrap naturally with `flex-wrap`

Padding and font sizes follow the existing app's mobile patterns.

## Visual Style

Matches the existing app's dark theme:

- Page background: same gradient as results page
- Cards: `bg-white/5 border border-white/10 rounded-xl`
- Hero stat cards: colored backgrounds matching their theme (red/green/blue/purple at ~15% opacity with matching border)
- Typography: white headings, `text-slate-400` for muted text
- Bar charts: simple `div` elements with percentage widths and colored backgrounds

No charts library needed — all visualizations are CSS bars and text.

## Architecture

### New files:

- `app/dashboard/page.tsx` — the page component (client component)
- `lib/dashboardData.ts` — pure functions that compute all rankings and clusters from a `Neighborhood[]` array

### Why separate the data logic:

`dashboardData.ts` takes the raw neighborhood array and returns a typed object with all computed rankings. This keeps the page component focused on rendering, and makes the ranking logic unit-testable.

```typescript
interface DashboardData {
  heroStats: {
    mostExpensive: { name: string; rent: number };
    safest: { name: string; safety: number };
    bestTransit: { name: string; transitScore: number };
    bestValue: { name: string; valueScore: number };
  };
  rentLeaderboard: {
    mostExpensive: Array<{ name: string; rent: number }>;
    mostAffordable: Array<{ name: string; rent: number }>;
  };
  bestValue: Array<{ name: string; rent: number; safety: number; walkScore: number; transitScore: number; valueScore: number }>;
  commuteFriendly: Array<{ name: string; transitScore: number; walkScore: number; mbtaLines: string[]; commuteScore: number }>;
  safety: {
    safest: Array<{ name: string; safety: number; safetyTrend: string }>;
    trendingSafer: Array<{ name: string; safety: number }>;
  };
  lifestyleClusters: {
    nightlife: string[];
    family: string[];
    urban: string[];
    quiet: string[];
  };
}

function computeDashboardData(neighborhoods: Neighborhood[]): DashboardData;
```

### Navigation entry point:

Add a "Dashboard" link in the `UserMenu` dropdown, placed above the existing GitHub link. The dashboard is independent of the wizard flow — no wizard input needed.

## Testing

- `__tests__/dashboardData.test.ts` — unit tests for all ranking/clustering functions
  - Rent sorting (most/least expensive)
  - Value score computation and ranking
  - Commute score computation and ranking
  - Safety filtering (improving trend)
  - Lifestyle cluster membership
  - Edge cases: ties, neighborhoods with identical scores

## Out of Scope

- No migration/population movement data (no reliable free source at neighborhood granularity)
- No interactivity beyond scrolling and the back button
- No map overlay on this page
- No AI-generated insights
- No filtering or sorting controls
