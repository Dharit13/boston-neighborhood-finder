# News & MBTA Alerts — Design

**Date:** 2026-04-10
**Status:** Approved
**Scope:** Add a Boston news panel and a neighborhood-scoped MBTA alerts panel to the results page.

## Goal

Give users two extra signals while browsing recommendations:

1. **Global Boston news** — generic top headlines, not tied to any neighborhood. Shown on the results page below the map.
2. **Neighborhood-scoped MBTA service alerts** — service-impacting alerts (delays, detours, suspensions) on the lines that serve the currently selected neighborhood. Shown inside `NeighborhoodProfile`.

The two surfaces are independent. News never depends on selection; alerts never render without one.

## Non-Goals

- Personalized or user-curated news.
- Area-specific news (user explicitly opted out).
- Real-time push updates. Polling via revalidation is sufficient.
- Historical alert archives.
- Alerts for `bus` or `ferry`-tagged neighborhoods (too noisy without station-level filtering).
- Retry UI, toasts, or error recovery flows. Both widgets degrade silently.

## Architecture

Two independent server routes, two independent client components. No shared state.

```
Results page                            Neighborhood profile
 │                                       │
 ├── NewsPanel ───▶ /api/news            ├── MbtaAlertsPanel ───▶ /api/mbta-alerts?lines=red,orange
 │                   │                   │                         │
 │                   └─▶ Yahoo RSS       │                         └─▶ api-v3.mbta.com/alerts
 │                        (cached 15m)   │                              (cached 3m, filtered)
```

- Routes live under `app/api/` alongside existing `commute` and `ai-*` routes.
- Both return JSON arrays. No pagination.
- Server-side caching via Next's `fetch(..., { next: { revalidate: N } })`. News 900s, alerts 180s. No in-memory store, no Redis.
- `NewsPanel` knows nothing about selection. `MbtaAlertsPanel` knows nothing about news.

## Files

**New**

- `app/api/news/route.ts` — GET handler, returns `NewsItem[]` or `{ error: "unavailable" }`
- `app/api/mbta-alerts/route.ts` — GET handler, accepts `lines` query param, returns `MbtaAlert[]` or `{ error: "unavailable" }`
- `components/results/NewsPanel.tsx` — self-contained card
- `components/results/MbtaAlertsPanel.tsx` — self-contained card
- `lib/news.ts` — Yahoo RSS fetch + parse + normalize
- `lib/mbtaAlerts.ts` — MBTA fetch + line mapping + severity/effect filter + sort
- `lib/news.test.ts` — unit tests for parsing
- `lib/mbtaAlerts.test.ts` — unit tests for filtering and mapping

**Modified**

- `lib/types.ts` — add `NewsItem` and `MbtaAlert` interfaces
- `app/results/page.tsx` — render `<NewsPanel />` below the map
- `components/results/NeighborhoodProfile.tsx` — render `<MbtaAlertsPanel lines={...} />` inside the profile

## Types

Added to `lib/types.ts`:

```ts
export interface NewsItem {
  title: string;
  url: string;
  source: string;      // e.g. "Boston Globe"
  publishedAt: string; // ISO 8601
}

export interface MbtaAlert {
  id: string;
  header: string;      // short summary
  description: string; // longer text
  severity: number;    // 0-10 (always >= 3 after filtering)
  effect: string;      // "DELAY" | "DETOUR" | "SUSPENSION" | "SHUTTLE" | "STATION_CLOSURE" | "SERVICE_CHANGE"
  routes: MbtaLine[];  // which of the requested lines this alert touches
  url: string | null;  // deep link to mbta.com alert page
}
```

## Component Interfaces

```tsx
// Global. No props, no selection awareness.
<NewsPanel />

// Contextual. Refetches when `lines` changes.
<MbtaAlertsPanel lines={MbtaLine[]} />
```

Each component owns its own fetch, loading, empty, and error states. Neither exposes callbacks or shared state.

### `NewsPanel` behavior

- On mount, calls `fetch('/api/news')`.
- Shows a 3-row skeleton while loading.
- On success, renders up to 8 items as a list: title (link), source, relative time.
- Empty: "No recent Boston headlines."
- Error: "Couldn't load news right now."
- Does not refetch on remount within the same session beyond what the server cache dictates.

### `MbtaAlertsPanel` behavior

- Accepts `lines: MbtaLine[]`.
- If `lines` is empty OR contains only `bus`/`ferry`, the panel does not render.
- Otherwise, calls `fetch('/api/mbta-alerts?lines=' + lines.join(','))`.
- Refetches when `lines` changes (new neighborhood selected).
- Shows "Checking alerts…" while loading.
- On success, renders each alert as a row with: severity badge, effect label, route badges (`Red`, `Orange`, etc.), header, truncated description with a "more" expander, and an external link if present. Caps at 10 rows.
- Empty: positive-toned "No service-impacting alerts right now ✓"
- Error: "Couldn't load alerts right now."

## Data Sources

### Yahoo News (`lib/news.ts`)

- **URL:** `https://news.search.yahoo.com/rss?p=Boston`
- **Fetch:** server-side `fetch` with `{ next: { revalidate: 900 } }`.
- **Parse:** `fast-xml-parser` (~30KB, no native deps). New dependency.
- **Extract:** first 8 `<item>` elements. For each: `title`, `link`, `source` (prefer `<source>` element, else hostname of link), `pubDate` → ISO via `new Date(pubDate).toISOString()`.
- **Sanitize:** strip HTML tags from title with a simple regex (`.replace(/<[^>]*>/g, '')`). Trim whitespace.
- **Validation:** drop items missing title or link. If fewer than 1 valid item remains, treat as empty (not error).
- **Errors:** network or parse failure → route returns `{ error: "unavailable" }`.

### MBTA Alerts (`lib/mbtaAlerts.ts`)

- **URL template:** `https://api-v3.mbta.com/alerts?filter[route]={routes}&filter[severity]=3,4,5,6,7,8,9,10&filter[activity]=BOARD,EXIT,RIDE`
- **Line mapping** (`MbtaLine` → MBTA route IDs):
  - `red` → `Red`
  - `orange` → `Orange`
  - `blue` → `Blue`
  - `green` → `Green-B,Green-C,Green-D,Green-E`
  - `silver` → `741,742,743,746,749,751`
  - `bus` → skipped
  - `ferry` → skipped
- If after mapping the route list is empty, return `[]` without making the upstream call.
- **Fetch:** server-side `fetch` with `{ next: { revalidate: 180 } }`. No API key (public tier is sufficient for read-only alerts).
- **Post-fetch filter:** drop alerts where `attributes.effect` is in `{ ELEVATOR_CLOSURE, ESCALATOR_CLOSURE, ACCESS_ISSUE, FACILITY_ISSUE, OTHER_EFFECT }`.
- **Map to `MbtaAlert`:**
  - `id`: alert id
  - `header`: `attributes.header`
  - `description`: `attributes.description ?? attributes.header`
  - `severity`: `attributes.severity`
  - `effect`: `attributes.effect`
  - `routes`: reverse-map the alert's informed entities' route IDs back to the requester's `MbtaLine` values (collapse `Green-*` → `green`, Silver Line route numbers → `silver`)
  - `url`: `attributes.url ?? null`
- **Sort:** severity desc, then header asc.
- **Cap:** first 10.
- **Errors:** network or parse failure → route returns `{ error: "unavailable" }`.

## Caching

- News: `revalidate: 900` (15 min). Each visitor shares the cache; refetched at most 4 times/hour.
- Alerts: `revalidate: 180` (3 min). Per-URL cache key handles different `lines` combinations automatically.
- Client components do not cache across mounts. Server cache makes this cheap.

## Error Handling

Both routes wrap upstream `fetch` in try/catch. On any failure (network, non-200, parse error):

- Return HTTP 200 with body `{ error: "unavailable" }`. This is not a critical path, so 500s would pollute logs.
- Log the underlying error server-side via `console.error`.
- Clients detect the `error` field and render a muted one-line fallback message. No retry, no toast.

Next's `revalidate` cache handles the happy path automatically: within the revalidation window, responses are served from cache. When the window expires, the next request triggers a background refetch; if that refetch fails, Next keeps serving the last-good cached value until the next attempt. This is the desired behavior — no extra stale-handling code is needed.

## Testing

Unit tests with vitest-style mocked `fetch`:

**`lib/news.test.ts`**
- Parses a well-formed Yahoo RSS response into `NewsItem[]`.
- Drops items missing title or link.
- Strips HTML from titles.
- Extracts source from `<source>` element when present, falls back to link hostname.
- Normalizes `pubDate` to ISO.
- Returns empty array on parse failure (not a throw).

**`lib/mbtaAlerts.test.ts`**
- Maps `MbtaLine` inputs to MBTA route IDs correctly, including `green` fanout and silver bus routes.
- Skips `bus` and `ferry` lines; returns `[]` if those are the only lines.
- Filters out `ELEVATOR_CLOSURE` and other excluded effects.
- Sorts by severity desc.
- Caps at 10 items.
- Reverse-maps `Green-B/C/D/E` back to `green` in the output `routes` field.
- Handles empty upstream response.

UI components (`NewsPanel`, `MbtaAlertsPanel`) are thin presenters and are not unit-tested.

## Dependencies

- **New:** `fast-xml-parser` (for RSS parsing)
- **Existing:** everything else — Next.js fetch, React, Tailwind.

## Rollout

Single PR. No feature flag. Both panels degrade to silent failure if either upstream is unreachable, so there's no user-visible regression if Yahoo or MBTA is down at ship time.
