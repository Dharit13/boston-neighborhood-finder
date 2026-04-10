# News & MBTA Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Boston news panel on the results page and a neighborhood-scoped MBTA service-alerts panel inside the neighborhood profile.

**Architecture:** Two independent server route handlers (`/api/news`, `/api/mbta-alerts`) fetch upstream data with Next.js `revalidate` caching and return normalized JSON. Two independent client components (`NewsPanel`, `MbtaAlertsPanel`) render the data with their own loading / empty / error states. The two surfaces share no state.

**Tech Stack:** Next.js 16.2.3 (App Router route handlers), React 19, TypeScript, Jest + ts-jest, Tailwind, `fast-xml-parser` (new dependency, for Yahoo RSS parsing).

**Reference spec:** [docs/superpowers/specs/2026-04-10-news-and-mbta-alerts-design.md](../specs/2026-04-10-news-and-mbta-alerts-design.md)

---

## File Structure

**New files**

| Path | Responsibility |
|---|---|
| `lib/news.ts` | Parse Yahoo News RSS XML → `NewsItem[]`. Pure function (takes XML string, returns array). |
| `lib/mbtaAlerts.ts` | Map `MbtaLine[]` → MBTA route IDs; filter/sort the JSON:API alerts response → `MbtaAlert[]`. Pure functions. |
| `app/api/news/route.ts` | GET handler. Fetches Yahoo RSS, calls `parseYahooRss`, returns JSON. |
| `app/api/mbta-alerts/route.ts` | GET handler. Reads `lines` query, calls helpers in `lib/mbtaAlerts.ts`, fetches MBTA API, returns JSON. |
| `components/results/NewsPanel.tsx` | Client component. Owns loading/empty/error for the news card. |
| `components/results/MbtaAlertsPanel.tsx` | Client component. Owns loading/empty/error; refetches when `lines` prop changes. |
| `__tests__/news.test.ts` | Unit tests for `parseYahooRss`. |
| `__tests__/mbtaAlerts.test.ts` | Unit tests for `mapLinesToRoutes`, `filterAndNormalizeAlerts`. |

**Modified files**

| Path | Change |
|---|---|
| `lib/types.ts` | Add `NewsItem` and `MbtaAlert` interfaces. |
| `app/results/page.tsx` | Render `<NewsPanel />` below `<NeighborhoodMap />`. |
| `components/results/NeighborhoodProfile.tsx` | Render `<MbtaAlertsPanel lines={n.mbtaLines} />` inside the profile. |
| `package.json` / `package-lock.json` | New dep: `fast-xml-parser`. |

---

## Task 1: Add shared types

**Files:**
- Modify: `lib/types.ts` (append new interfaces after `ScoredNeighborhood`, before `BudgetTier` section)

- [ ] **Step 1: Add the interfaces**

Open `lib/types.ts`. Find the line `// --- Budget Tier Types ---`. Immediately before it, insert:

```ts
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

```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx tsc --noEmit`
Expected: clean, no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder
git add lib/types.ts
git commit -m "feat(types): add NewsItem and MbtaAlert"
```

---

## Task 2: Install fast-xml-parser

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install the dependency**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npm install fast-xml-parser`
Expected: `fast-xml-parser` added to `dependencies` in `package.json`. Output includes "added 1 package".

- [ ] **Step 2: Verify install**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && node -e "require('fast-xml-parser'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder
git add package.json package-lock.json
git commit -m "chore(deps): add fast-xml-parser for RSS parsing"
```

---

## Task 3: `lib/news.ts` — parseYahooRss (TDD)

**Files:**
- Create: `lib/news.ts`
- Test: `__tests__/news.test.ts`

The parser is a pure function: XML string in, `NewsItem[]` out. No network calls here — those happen in the route handler. Rules from spec:
- First 8 items only.
- Drop items missing `title` or `link`.
- Strip HTML tags from title.
- Source: prefer `<source>` element text, else hostname of link.
- `pubDate` → ISO via `new Date(pubDate).toISOString()`.
- Return `[]` on parse failure (do not throw).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/news.test.ts`:

```ts
import { parseYahooRss } from "@/lib/news";

const wrap = (items: string) => `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Yahoo News Search</title>
    ${items}
  </channel>
</rss>`;

describe("parseYahooRss", () => {
  it("returns NewsItem[] for a well-formed feed", () => {
    const xml = wrap(`
      <item>
        <title>Boston mayor announces plan</title>
        <link>https://www.bostonglobe.com/2026/04/10/news/story</link>
        <source>Boston Globe</source>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
    `);
    const result = parseYahooRss(xml);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      title: "Boston mayor announces plan",
      url: "https://www.bostonglobe.com/2026/04/10/news/story",
      source: "Boston Globe",
      publishedAt: new Date("Fri, 10 Apr 2026 12:00:00 GMT").toISOString(),
    });
  });

  it("caps results at 8 items", () => {
    const items = Array.from({ length: 12 }, (_, i) => `
      <item>
        <title>Headline ${i}</title>
        <link>https://example.com/${i}</link>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
    `).join("");
    const result = parseYahooRss(wrap(items));
    expect(result).toHaveLength(8);
  });

  it("drops items missing title or link", () => {
    const xml = wrap(`
      <item>
        <title>Has title</title>
        <link>https://example.com/a</link>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Missing link</title>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
      <item>
        <link>https://example.com/c</link>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
    `);
    const result = parseYahooRss(xml);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Has title");
  });

  it("strips HTML tags from titles", () => {
    const xml = wrap(`
      <item>
        <title><![CDATA[<b>Bold</b> headline]]></title>
        <link>https://example.com/a</link>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
    `);
    const result = parseYahooRss(xml);
    expect(result[0].title).toBe("Bold headline");
  });

  it("falls back to link hostname when source element is missing", () => {
    const xml = wrap(`
      <item>
        <title>Headline</title>
        <link>https://www.wbur.org/news/story</link>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
    `);
    const result = parseYahooRss(xml);
    expect(result[0].source).toBe("www.wbur.org");
  });

  it("normalizes pubDate to ISO", () => {
    const xml = wrap(`
      <item>
        <title>Headline</title>
        <link>https://example.com/a</link>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
    `);
    const result = parseYahooRss(xml);
    expect(result[0].publishedAt).toBe("2026-04-10T12:00:00.000Z");
  });

  it("returns [] on malformed XML", () => {
    expect(parseYahooRss("<<<not xml>>>")).toEqual([]);
    expect(parseYahooRss("")).toEqual([]);
  });

  it("returns [] when channel has no items", () => {
    expect(parseYahooRss(wrap(""))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest __tests__/news.test.ts`
Expected: FAIL — `Cannot find module '@/lib/news'` or similar.

- [ ] **Step 3: Implement `lib/news.ts`**

Create `lib/news.ts`:

```ts
import { XMLParser } from "fast-xml-parser";
import type { NewsItem } from "./types";

const MAX_ITEMS = 8;

interface RawItem {
  title?: string | { "#text"?: string };
  link?: string;
  source?: string | { "#text"?: string };
  pubDate?: string;
}

function textOf(value: string | { "#text"?: string } | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value["#text"] ?? "";
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function toIsoDate(pubDate: string | undefined): string {
  if (!pubDate) return new Date(0).toISOString();
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return new Date(0).toISOString();
  return d.toISOString();
}

export function parseYahooRss(xml: string): NewsItem[] {
  if (!xml) return [];
  let parsed: unknown;
  try {
    const parser = new XMLParser({
      ignoreAttributes: true,
      cdataPropName: "#text",
    });
    parsed = parser.parse(xml);
  } catch {
    return [];
  }

  const channel = (parsed as { rss?: { channel?: { item?: RawItem | RawItem[] } } })
    ?.rss?.channel;
  if (!channel) return [];

  const rawItems = Array.isArray(channel.item)
    ? channel.item
    : channel.item
    ? [channel.item]
    : [];

  const items: NewsItem[] = [];
  for (const raw of rawItems) {
    if (items.length >= MAX_ITEMS) break;

    const title = stripHtml(textOf(raw.title));
    const url = (raw.link ?? "").trim();
    if (!title || !url) continue;

    const sourceText = stripHtml(textOf(raw.source));
    const source = sourceText || hostnameOf(url);

    items.push({
      title,
      url,
      source,
      publishedAt: toIsoDate(raw.pubDate),
    });
  }

  return items;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest __tests__/news.test.ts`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder
git add lib/news.ts __tests__/news.test.ts
git commit -m "feat(news): add Yahoo RSS parser"
```

---

## Task 4: `/api/news` route handler

**Files:**
- Create: `app/api/news/route.ts`

This is a thin wrapper around `parseYahooRss`. It fetches the feed with Next's revalidate cache, parses, and returns JSON. On failure, returns `{ error: "unavailable" }` with HTTP 200.

- [ ] **Step 1: Create the route handler**

Create `app/api/news/route.ts`:

```ts
import { NextResponse } from "next/server";
import { parseYahooRss } from "@/lib/news";

const YAHOO_RSS_URL = "https://news.search.yahoo.com/rss?p=Boston";
const REVALIDATE_SECONDS = 900; // 15 min

export async function GET() {
  try {
    const res = await fetch(YAHOO_RSS_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "User-Agent": "neighborhood-finder/1.0" },
    });
    if (!res.ok) {
      console.error(`[api/news] upstream status ${res.status}`);
      return NextResponse.json({ error: "unavailable" });
    }
    const xml = await res.text();
    const items = parseYahooRss(xml);
    return NextResponse.json(items);
  } catch (err) {
    console.error("[api/news] fetch failed", err);
    return NextResponse.json({ error: "unavailable" });
  }
}
```

- [ ] **Step 2: Smoke test by starting dev server**

Run (in background): `cd /Users/dhshah/boston_nh/neighbourhood_finder && npm run dev`
Then in another shell: `curl -s http://localhost:3000/api/news | head -c 500`
Expected: a JSON array with title/url/source/publishedAt fields, OR `{"error":"unavailable"}` (if Yahoo is down — not a bug).
Stop the dev server after verification.

- [ ] **Step 3: Typecheck**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder
git add app/api/news/route.ts
git commit -m "feat(api): add /api/news route"
```

---

## Task 5: `lib/mbtaAlerts.ts` — line mapping + filter (TDD)

**Files:**
- Create: `lib/mbtaAlerts.ts`
- Test: `__tests__/mbtaAlerts.test.ts`

Two pure functions:
- `mapLinesToRoutes(lines: MbtaLine[]): string[]` — our lines → MBTA route IDs. Expands `green` to Green-B/C/D/E, `silver` to 741/742/743/746/749/751. Skips `bus` and `ferry`.
- `filterAndNormalizeAlerts(rawResponse: unknown, requestedLines: MbtaLine[]): MbtaAlert[]` — takes the raw JSON:API response from MBTA, drops excluded effects, maps to `MbtaAlert`, reverse-maps routes to `MbtaLine[]`, sorts by severity desc, caps at 10.

Excluded effects: `ELEVATOR_CLOSURE`, `ESCALATOR_CLOSURE`, `ACCESS_ISSUE`, `FACILITY_ISSUE`, `OTHER_EFFECT`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/mbtaAlerts.test.ts`:

```ts
import {
  mapLinesToRoutes,
  filterAndNormalizeAlerts,
} from "@/lib/mbtaAlerts";

describe("mapLinesToRoutes", () => {
  it("maps basic heavy rail lines", () => {
    expect(mapLinesToRoutes(["red", "orange", "blue"])).toEqual([
      "Red",
      "Orange",
      "Blue",
    ]);
  });

  it("expands green to all four branches", () => {
    expect(mapLinesToRoutes(["green"])).toEqual([
      "Green-B",
      "Green-C",
      "Green-D",
      "Green-E",
    ]);
  });

  it("expands silver to SL bus routes", () => {
    expect(mapLinesToRoutes(["silver"])).toEqual([
      "741",
      "742",
      "743",
      "746",
      "749",
      "751",
    ]);
  });

  it("skips bus and ferry", () => {
    expect(mapLinesToRoutes(["bus", "ferry"])).toEqual([]);
    expect(mapLinesToRoutes(["red", "bus"])).toEqual(["Red"]);
  });

  it("returns empty for empty input", () => {
    expect(mapLinesToRoutes([])).toEqual([]);
  });

  it("combines multiple lines", () => {
    expect(mapLinesToRoutes(["red", "green"])).toEqual([
      "Red",
      "Green-B",
      "Green-C",
      "Green-D",
      "Green-E",
    ]);
  });
});

const makeRaw = (alerts: Array<Record<string, unknown>>) => ({
  data: alerts.map((a, i) => ({
    id: (a.id as string) ?? `alert-${i}`,
    type: "alert",
    attributes: {
      header: a.header ?? "Header",
      description: a.description ?? "Description",
      severity: a.severity ?? 5,
      effect: a.effect ?? "DELAY",
      url: a.url ?? null,
      informed_entity: a.informed_entity ?? [{ route: "Red" }],
    },
  })),
});

describe("filterAndNormalizeAlerts", () => {
  it("maps a basic alert", () => {
    const raw = makeRaw([
      {
        id: "a1",
        header: "Red Line delays",
        description: "Signal problem near JFK",
        severity: 7,
        effect: "DELAY",
        url: "https://www.mbta.com/alerts/a1",
        informed_entity: [{ route: "Red" }],
      },
    ]);
    const result = filterAndNormalizeAlerts(raw, ["red"]);
    expect(result).toEqual([
      {
        id: "a1",
        header: "Red Line delays",
        description: "Signal problem near JFK",
        severity: 7,
        effect: "DELAY",
        routes: ["red"],
        url: "https://www.mbta.com/alerts/a1",
      },
    ]);
  });

  it("drops alerts with excluded effects", () => {
    const raw = makeRaw([
      { id: "a1", effect: "DELAY" },
      { id: "a2", effect: "ELEVATOR_CLOSURE" },
      { id: "a3", effect: "ESCALATOR_CLOSURE" },
      { id: "a4", effect: "ACCESS_ISSUE" },
      { id: "a5", effect: "FACILITY_ISSUE" },
      { id: "a6", effect: "OTHER_EFFECT" },
      { id: "a7", effect: "DETOUR" },
    ]);
    const result = filterAndNormalizeAlerts(raw, ["red"]);
    expect(result.map((a) => a.id)).toEqual(["a1", "a7"]);
  });

  it("sorts by severity descending", () => {
    const raw = makeRaw([
      { id: "a1", severity: 3 },
      { id: "a2", severity: 9 },
      { id: "a3", severity: 6 },
    ]);
    const result = filterAndNormalizeAlerts(raw, ["red"]);
    expect(result.map((a) => a.id)).toEqual(["a2", "a3", "a1"]);
  });

  it("caps at 10 alerts", () => {
    const raw = makeRaw(
      Array.from({ length: 15 }, (_, i) => ({ id: `a${i}`, severity: 5 }))
    );
    const result = filterAndNormalizeAlerts(raw, ["red"]);
    expect(result).toHaveLength(10);
  });

  it("reverse-maps Green branches to green", () => {
    const raw = makeRaw([
      {
        id: "a1",
        informed_entity: [
          { route: "Green-B" },
          { route: "Green-C" },
        ],
      },
    ]);
    const result = filterAndNormalizeAlerts(raw, ["green"]);
    expect(result[0].routes).toEqual(["green"]);
  });

  it("reverse-maps silver bus routes to silver", () => {
    const raw = makeRaw([
      { id: "a1", informed_entity: [{ route: "741" }, { route: "749" }] },
    ]);
    const result = filterAndNormalizeAlerts(raw, ["silver"]);
    expect(result[0].routes).toEqual(["silver"]);
  });

  it("only includes requested lines in routes output", () => {
    // Alert touches Red and Orange but caller only asked for red
    const raw = makeRaw([
      {
        id: "a1",
        informed_entity: [{ route: "Red" }, { route: "Orange" }],
      },
    ]);
    const result = filterAndNormalizeAlerts(raw, ["red"]);
    expect(result[0].routes).toEqual(["red"]);
  });

  it("uses header as fallback when description is missing", () => {
    const raw = {
      data: [
        {
          id: "a1",
          type: "alert",
          attributes: {
            header: "Red Line delays",
            severity: 5,
            effect: "DELAY",
            url: null,
            informed_entity: [{ route: "Red" }],
          },
        },
      ],
    };
    const result = filterAndNormalizeAlerts(raw, ["red"]);
    expect(result[0].description).toBe("Red Line delays");
  });

  it("handles empty response", () => {
    expect(filterAndNormalizeAlerts({ data: [] }, ["red"])).toEqual([]);
  });

  it("handles malformed response", () => {
    expect(filterAndNormalizeAlerts(null, ["red"])).toEqual([]);
    expect(filterAndNormalizeAlerts({}, ["red"])).toEqual([]);
    expect(filterAndNormalizeAlerts({ data: "not array" }, ["red"])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest __tests__/mbtaAlerts.test.ts`
Expected: FAIL — `Cannot find module '@/lib/mbtaAlerts'`.

- [ ] **Step 3: Implement `lib/mbtaAlerts.ts`**

Create `lib/mbtaAlerts.ts`:

```ts
import type { MbtaAlert, MbtaLine } from "./types";

const EXCLUDED_EFFECTS = new Set([
  "ELEVATOR_CLOSURE",
  "ESCALATOR_CLOSURE",
  "ACCESS_ISSUE",
  "FACILITY_ISSUE",
  "OTHER_EFFECT",
]);

const MAX_ALERTS = 10;

const LINE_TO_ROUTES: Record<MbtaLine, string[]> = {
  red: ["Red"],
  orange: ["Orange"],
  blue: ["Blue"],
  green: ["Green-B", "Green-C", "Green-D", "Green-E"],
  silver: ["741", "742", "743", "746", "749", "751"],
  bus: [],
  ferry: [],
};

/**
 * Map our internal MbtaLine values to MBTA v3 route IDs.
 * Skips `bus` and `ferry` (too broad without station-level filtering).
 */
export function mapLinesToRoutes(lines: MbtaLine[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    for (const route of LINE_TO_ROUTES[line] ?? []) {
      out.push(route);
    }
  }
  return out;
}

/**
 * Reverse: given a raw MBTA route ID, which of our MbtaLine values
 * does it belong to?
 */
function routeIdToLine(routeId: string): MbtaLine | null {
  for (const [line, routes] of Object.entries(LINE_TO_ROUTES) as [
    MbtaLine,
    string[]
  ][]) {
    if (routes.includes(routeId)) return line;
  }
  return null;
}

interface RawAlert {
  id?: string;
  type?: string;
  attributes?: {
    header?: string;
    description?: string | null;
    severity?: number;
    effect?: string;
    url?: string | null;
    informed_entity?: Array<{ route?: string }>;
  };
}

/**
 * Take the raw JSON:API response from MBTA, drop excluded effects,
 * map to MbtaAlert, reverse-map routes to requested MbtaLine values,
 * sort by severity desc, cap at MAX_ALERTS.
 */
export function filterAndNormalizeAlerts(
  rawResponse: unknown,
  requestedLines: MbtaLine[]
): MbtaAlert[] {
  const data = (rawResponse as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];

  const requestedSet = new Set(requestedLines);

  const normalized: MbtaAlert[] = [];
  for (const raw of data as RawAlert[]) {
    const attrs = raw.attributes;
    if (!attrs) continue;

    const effect = attrs.effect ?? "";
    if (EXCLUDED_EFFECTS.has(effect)) continue;

    const header = attrs.header ?? "";
    if (!header) continue;

    const informed = attrs.informed_entity ?? [];
    const touchedLines = new Set<MbtaLine>();
    for (const entity of informed) {
      if (!entity.route) continue;
      const line = routeIdToLine(entity.route);
      if (line && requestedSet.has(line)) touchedLines.add(line);
    }
    if (touchedLines.size === 0) continue;

    normalized.push({
      id: raw.id ?? "",
      header,
      description: attrs.description ?? header,
      severity: attrs.severity ?? 0,
      effect,
      routes: Array.from(touchedLines),
      url: attrs.url ?? null,
    });
  }

  normalized.sort((a, b) => b.severity - a.severity);
  return normalized.slice(0, MAX_ALERTS);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx jest __tests__/mbtaAlerts.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder
git add lib/mbtaAlerts.ts __tests__/mbtaAlerts.test.ts
git commit -m "feat(mbta): add alerts line-mapping and normalization"
```

---

## Task 6: `/api/mbta-alerts` route handler

**Files:**
- Create: `app/api/mbta-alerts/route.ts`

- [ ] **Step 1: Create the route handler**

Create `app/api/mbta-alerts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import type { MbtaLine } from "@/lib/types";
import {
  mapLinesToRoutes,
  filterAndNormalizeAlerts,
} from "@/lib/mbtaAlerts";

const VALID_LINES: ReadonlySet<MbtaLine> = new Set<MbtaLine>([
  "red",
  "orange",
  "blue",
  "green",
  "silver",
  "bus",
  "ferry",
]);

const REVALIDATE_SECONDS = 180; // 3 min

export async function GET(request: NextRequest) {
  const linesParam = request.nextUrl.searchParams.get("lines") ?? "";
  const requestedLines = linesParam
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is MbtaLine => VALID_LINES.has(s as MbtaLine));

  if (requestedLines.length === 0) {
    return NextResponse.json([]);
  }

  const routes = mapLinesToRoutes(requestedLines);
  if (routes.length === 0) {
    // Only bus/ferry requested — we don't query those.
    return NextResponse.json([]);
  }

  const params = new URLSearchParams();
  params.set("filter[route]", routes.join(","));
  params.set("filter[severity]", "3,4,5,6,7,8,9,10");
  params.set("filter[activity]", "BOARD,EXIT,RIDE");

  const url = `https://api-v3.mbta.com/alerts?${params.toString()}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/vnd.api+json" },
    });
    if (!res.ok) {
      console.error(`[api/mbta-alerts] upstream status ${res.status}`);
      return NextResponse.json({ error: "unavailable" });
    }
    const raw = await res.json();
    const alerts = filterAndNormalizeAlerts(raw, requestedLines);
    return NextResponse.json(alerts);
  } catch (err) {
    console.error("[api/mbta-alerts] fetch failed", err);
    return NextResponse.json({ error: "unavailable" });
  }
}
```

- [ ] **Step 2: Smoke test**

Run (in background): `cd /Users/dhshah/boston_nh/neighbourhood_finder && npm run dev`
Then: `curl -s "http://localhost:3000/api/mbta-alerts?lines=red,orange" | head -c 500`
Expected: a JSON array (possibly empty if no current alerts) OR `{"error":"unavailable"}`.

Also verify filtering works:
`curl -s "http://localhost:3000/api/mbta-alerts?lines=bus,ferry"`
Expected: `[]`.

Stop the dev server.

- [ ] **Step 3: Typecheck**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder
git add app/api/mbta-alerts/route.ts
git commit -m "feat(api): add /api/mbta-alerts route"
```

---

## Task 7: `NewsPanel` component

**Files:**
- Create: `components/results/NewsPanel.tsx`

Thin presenter. Fetches once on mount. States: loading (skeleton), empty, error, list.

- [ ] **Step 1: Create the component**

Create `components/results/NewsPanel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/types";

type Status = "loading" | "ok" | "empty" | "error";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function NewsPanel() {
  const [status, setStatus] = useState<Status>("loading");
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/news");
        const body = await res.json();
        if (cancelled) return;
        if (body && typeof body === "object" && "error" in body) {
          setStatus("error");
          return;
        }
        if (Array.isArray(body) && body.length > 0) {
          setItems(body);
          setStatus("ok");
        } else {
          setStatus("empty");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
      <h2 className="text-lg font-bold text-white mb-4">Boston News</h2>

      {status === "loading" && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 bg-white/10 rounded animate-pulse" />
          ))}
        </div>
      )}

      {status === "empty" && (
        <p className="text-sm text-white/60">No recent Boston headlines.</p>
      )}

      {status === "error" && (
        <p className="text-sm text-white/60">Couldn&apos;t load news right now.</p>
      )}

      {status === "ok" && (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.url}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white hover:text-blue-300 transition-colors block"
              >
                {item.title}
              </a>
              <div className="text-xs text-white/50 mt-0.5">
                {item.source} · {relativeTime(item.publishedAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder
git add components/results/NewsPanel.tsx
git commit -m "feat(ui): add NewsPanel component"
```

---

## Task 8: `MbtaAlertsPanel` component

**Files:**
- Create: `components/results/MbtaAlertsPanel.tsx`

Takes `lines: MbtaLine[]`. Refetches when `lines` changes. Does not render at all when there are no queryable lines.

- [ ] **Step 1: Create the component**

Create `components/results/MbtaAlertsPanel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { MbtaAlert, MbtaLine } from "@/lib/types";

interface Props {
  lines: MbtaLine[];
}

type Status = "loading" | "ok" | "empty" | "error";

const LINE_BADGE_COLORS: Record<MbtaLine, string> = {
  red: "bg-red-600",
  orange: "bg-orange-500",
  blue: "bg-blue-600",
  green: "bg-green-600",
  silver: "bg-gray-500",
  bus: "bg-yellow-600",
  ferry: "bg-cyan-600",
};

const LINE_LABELS: Record<MbtaLine, string> = {
  red: "Red",
  orange: "Orange",
  blue: "Blue",
  green: "Green",
  silver: "Silver",
  bus: "Bus",
  ferry: "Ferry",
};

function effectLabel(effect: string): string {
  return effect
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function MbtaAlertsPanel({ lines }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [alerts, setAlerts] = useState<MbtaAlert[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Only render for queryable lines (skip bus/ferry-only neighborhoods)
  const queryableLines = lines.filter(
    (l) => l !== "bus" && l !== "ferry"
  );

  useEffect(() => {
    if (queryableLines.length === 0) return;

    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const res = await fetch(
          `/api/mbta-alerts?lines=${queryableLines.join(",")}`
        );
        const body = await res.json();
        if (cancelled) return;
        if (body && typeof body === "object" && "error" in body) {
          setStatus("error");
          return;
        }
        if (Array.isArray(body) && body.length > 0) {
          setAlerts(body);
          setStatus("ok");
        } else {
          setStatus("empty");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryableLines.join(",")]);

  if (queryableLines.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-bold text-white mb-3">MBTA Service Alerts</h3>

      {status === "loading" && (
        <p className="text-xs text-white/60">Checking alerts…</p>
      )}

      {status === "empty" && (
        <p className="text-xs text-emerald-400">
          No service-impacting alerts right now ✓
        </p>
      )}

      {status === "error" && (
        <p className="text-xs text-white/60">
          Couldn&apos;t load alerts right now.
        </p>
      )}

      {status === "ok" && (
        <ul className="space-y-3">
          {alerts.map((alert) => {
            const isExpanded = expandedId === alert.id;
            const truncated =
              alert.description.length > 140 && !isExpanded
                ? alert.description.slice(0, 140).trimEnd() + "…"
                : alert.description;
            return (
              <li
                key={alert.id}
                className="border-l-2 border-white/20 pl-3"
              >
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  {alert.routes.map((route) => (
                    <span
                      key={route}
                      className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded ${LINE_BADGE_COLORS[route]}`}
                    >
                      {LINE_LABELS[route]}
                    </span>
                  ))}
                  <span className="text-[10px] text-white/60 uppercase tracking-wide">
                    {effectLabel(alert.effect)}
                  </span>
                </div>
                <div className="text-xs font-medium text-white">
                  {alert.header}
                </div>
                <div className="text-xs text-white/70 mt-0.5">
                  {truncated}
                  {alert.description.length > 140 && (
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : alert.id)
                      }
                      className="ml-1 text-blue-300 hover:underline"
                    >
                      {isExpanded ? "less" : "more"}
                    </button>
                  )}
                </div>
                {alert.url && (
                  <a
                    href={alert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-300 hover:underline mt-1 inline-block"
                  >
                    View on mbta.com →
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder
git add components/results/MbtaAlertsPanel.tsx
git commit -m "feat(ui): add MbtaAlertsPanel component"
```

---

## Task 9: Wire `NewsPanel` into results page

**Files:**
- Modify: `app/results/page.tsx`

- [ ] **Step 1: Add the import**

In `app/results/page.tsx`, after the line `import NeighborhoodProfile from "@/components/results/NeighborhoodProfile";` (around line 33), add:

```tsx
import NewsPanel from "@/components/results/NewsPanel";
```

- [ ] **Step 2: Render below the map**

In `app/results/page.tsx`, find this block (around line 326):

```tsx
          <NeighborhoodMap
            recommendations={recommendations}
            allNeighborhoods={scored}
            selectedId={selectedId}
            onSelect={setSelectedId}
            officeAddress={input?.officeAddress ?? null}
          />

          <div ref={profileRef} />
```

Replace with:

```tsx
          <NeighborhoodMap
            recommendations={recommendations}
            allNeighborhoods={scored}
            selectedId={selectedId}
            onSelect={setSelectedId}
            officeAddress={input?.officeAddress ?? null}
          />

          <NewsPanel />

          <div ref={profileRef} />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Visual smoke test**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npm run dev`
Open `http://localhost:3000`, complete the wizard, land on results. Verify a "Boston News" card appears below the map with ~8 items (or an empty/error state if Yahoo is down). Stop the server.

- [ ] **Step 5: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder
git add app/results/page.tsx
git commit -m "feat(results): add NewsPanel below map"
```

---

## Task 10: Wire `MbtaAlertsPanel` into neighborhood profile

**Files:**
- Modify: `components/results/NeighborhoodProfile.tsx`

- [ ] **Step 1: Add the import**

In `components/results/NeighborhoodProfile.tsx`, after the line `import { getRentAsPercentOfIncome } from "@/lib/budget";` (around line 5), add:

```tsx
import MbtaAlertsPanel from "./MbtaAlertsPanel";
```

- [ ] **Step 2: Render the panel inside the profile**

In `components/results/NeighborhoodProfile.tsx`, find the tail of the component (around line 323-327):

```tsx
              {n.safetyTrend === "improving"
                ? "Improving"
                : n.safetyTrend === "declining"
                ? "Declining"
                : "Stable"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Replace with:

```tsx
              {n.safetyTrend === "improving"
                ? "Improving"
                : n.safetyTrend === "declining"
                ? "Declining"
                : "Stable"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <MbtaAlertsPanel lines={n.mbtaLines} />
      </div>
    </div>
  );
}
```

Note: `n` is already defined inside the component at line 72 (`const n = scored.neighborhood;`), so `n.mbtaLines` is the correct reference — no additional destructuring needed.

- [ ] **Step 3: Typecheck**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Visual smoke test**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npm run dev`
Land on results, click a neighborhood that has a rapid-transit line (e.g. a Red Line neighborhood — Davis, Central, Harvard). Verify the profile opens and includes a "MBTA Service Alerts" section that either shows alerts, the positive empty state, or the error state. Also click a bus/ferry-only neighborhood (if any) and confirm the panel is not rendered at all. Stop the server.

- [ ] **Step 5: Commit**

```bash
cd /Users/dhshah/boston_nh/neighbourhood_finder
git add components/results/NeighborhoodProfile.tsx
git commit -m "feat(profile): add MbtaAlertsPanel to neighborhood profile"
```

---

## Task 11: Final checks

**Files:** none

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npm test`
Expected: all tests pass, including the two new files (`news.test.ts`, `mbtaAlerts.test.ts`) and existing tests (`budget.test.ts`, `scoring.test.ts`, `weights.test.ts`).

- [ ] **Step 2: Typecheck**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Lint**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npm run lint`
Expected: no errors. Warnings about `react-hooks/exhaustive-deps` in `MbtaAlertsPanel` are acceptable because we intentionally depend on `queryableLines.join(",")` (that disable comment is already in the code).

- [ ] **Step 4: Production build**

Run: `cd /Users/dhshah/boston_nh/neighbourhood_finder && npm run build`
Expected: build succeeds. New API routes (`/api/news`, `/api/mbta-alerts`) appear in the route summary.

---

## Done

All requirements from the spec are implemented:

- ✅ Global Boston news panel (Yahoo RSS, server-cached 15 min)
- ✅ Neighborhood-scoped MBTA alerts panel (server-cached 3 min)
- ✅ Service-impacting severity filter (≥3, excluded effects dropped)
- ✅ Line mapping with green fanout and silver bus routes
- ✅ Bus/ferry-only neighborhoods don't render the alerts panel
- ✅ Loading / empty / error states for both panels
- ✅ Silent degradation on upstream failure
- ✅ Unit tests for both parsers
