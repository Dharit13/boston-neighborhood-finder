# Architecture

This document describes how the Boston Neighborhood Finder is put together: the directory layout, the data flow from the wizard to the results page, the scoring algorithm, and the role of each API route.

## Mental model

The app is a **Next.js 16 App Router** project with a client-heavy architecture:

- The **scoring happens in the browser**, not on the server. The results page fetches a pre-computed `neighborhoods.json` (44 records), scores them against the user's inputs, and renders the top picks. This keeps the server stateless and cheap.
- The **server only does three things**: proxy calls that need a secret API key (Anthropic, Google Directions), fetch data that benefits from server-side caching (MBTA alerts, news RSS), and enforce rate limits on the AI routes.
- The **pipeline scripts** in `scripts/` are run manually (not on request) to refresh `public/data/neighborhoods.json` from upstream sources. If you fork the repo and want fresher data, you re-run the pipeline — the app itself never hits Walk Score, Zillow, or the Census API at request time.

## Directory layout

```
neighbourhood_finder/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (fonts, metadata)
│   ├── page.tsx                  # Wizard landing — wraps WizardContainer
│   ├── results/page.tsx          # Scoring + recommendations (client component)
│   └── api/
│       ├── commute/route.ts      # Google Directions proxy (transit + walking)
│       ├── mbta-alerts/route.ts  # MBTA v3 alerts filtered by line
│       ├── news/route.ts         # Google News RSS → NewsItem[]
│       ├── ai-summary/route.ts   # Per-neighborhood Claude summary
│       ├── ai-overview/route.ts  # Top-3 recommendations overview
│       └── chat/route.ts         # Streaming multi-turn chat
│
├── components/
│   ├── wizard/
│   │   ├── WizardContainer.tsx   # Manages step state, persists to sessionStorage
│   │   ├── StepAboutYou.tsx      # Age, income
│   │   ├── StepHousing.tsx       # Roommates, living arrangement, max rent
│   │   ├── StepCommute.tsx       # Office days, office address, MBTA preference
│   │   └── StepPreferences.tsx   # Multi-select "Vibe" presets → averaged sliders + vibeStrength
│   │
│   ├── results/
│   │   ├── RecommendationOverview.tsx    # Claude "why these three" card
│   │   ├── RecommendationCards.tsx       # Three budget-tier picks
│   │   ├── NeighborhoodProfile.tsx       # Deep-dive for a selected neighborhood
│   │   ├── CompareView.tsx               # Side-by-side of up to 3 neighborhoods
│   │   ├── NeighborhoodMap.tsx           # Google Maps with pins (dynamic import, ssr: false)
│   │   ├── ChatPanel.tsx                 # Floating Claude chat with streaming
│   │   ├── NewsPanel.tsx                 # Latest Boston news via /api/news
│   │   └── MbtaAlertsPanel.tsx           # Live MBTA alerts for user's lines
│   │
│   └── ui/
│       ├── BudgetSelector.tsx          # Merged budget priority + tier display
│       ├── TradeoffSlider.tsx
│       ├── pixel-trail.tsx               # Decorative cursor-trail effect
│       └── gooey-filter.tsx              # SVG filter for animated blobs
│
├── lib/                          # Shared, stateless logic
│   ├── types.ts                  # All TypeScript interfaces (UserInput, Neighborhood, etc.)
│   ├── scoring.ts                # Dimension scorers + TOPSIS + post-TOPSIS adjustments
│   ├── weights.ts                # Slider → normalized weights
│   ├── budget.ts                 # Budget tier math (saver/balanced/stretched)
│   ├── commute.ts                # Client-side batching helper for /api/commute
│   ├── neighborhoods.ts          # Per-person rent helper
│   ├── neighborhoodsServer.ts    # Server-side compact summary + "mentioned" lookup for chat
│   ├── news.ts                   # Generic RSS 2.0 parser (used by /api/news)
│   ├── mbtaAlerts.ts             # Line → route mapping, alert filter/normalizer
│   ├── rateLimit.ts              # Upstash sliding-window wrapper
│   ├── chatPrompt.ts             # Chat guardrails, pre-check, system prompt builder
│   └── utils.ts                  # cn() className helper
│
├── scripts/                      # Data pipeline (manual, not runtime)
│   ├── fetch-real-data.ts        # Main pipeline: --mbta, --rent, --crime, --places, --all
│   └── fetch-neighborhood-data.ts # Earlier/complementary fetcher
│
├── public/data/
│   ├── neighborhoods.json        # The 44-neighborhood dataset the app reads
│   ├── boston-neighborhoods.geojson
│   ├── ma-towns.geojson
│   ├── zillow-*.csv / *.md       # Zillow rent snapshots + methodology notes
│   └── 2022/ 2023/ 2024/         # Historical Zillow data
│
├── __tests__/                    # Jest unit tests (138 total)
│   ├── scoring.test.ts           # Dimension scorers, TOPSIS, MBTA/age/urban adjustments
│   ├── weights.test.ts           # Weight derivation under different inputs
│   ├── budget.test.ts            # Tier math, per-person rent, percentages
│   ├── news.test.ts              # RSS parser edge cases
│   ├── mbtaAlerts.test.ts        # Line-to-route mapping, alert normalization
│   ├── rateLimit.test.ts         # Upstash presence/absence fallback
│   ├── chatPrompt.test.ts        # Pre-check, guardrails, prompt builder
│   ├── auth.test.ts              # requireUser auth enforcement
│   ├── neighborhoods.test.ts     # Neighborhood data integrity (44 records)
│   ├── validation.test.ts        # API input validation (commute, AI routes)
│   └── userCount.test.ts         # Public user count function
│
├── docs/
│   └── superpowers/              # Design specs and implementation plans
│       ├── specs/
│       └── plans/
│
├── .env.local.example            # Template for required env vars
├── jest.config.ts
├── jest.setup.ts                 # jsdom Request polyfill
├── next.config.ts
└── tsconfig.json
```

## Data flow: wizard → results

```
┌─────────────────┐
│  Wizard (client)│  WizardContainer holds React state for 4 steps
│                 │  On "Finish" → sessionStorage.setItem("wizardInput", …)
└────────┬────────┘  → router.push("/results")
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  /results page (client component)                          │
│                                                             │
│  1. On mount: sessionStorage.getItem("wizardInput")         │
│     → if missing, redirect to "/"                           │
│                                                             │
│  2. fetch("/data/neighborhoods.json")                       │
│     → 44 Neighborhood records                               │
│                                                             │
│  3. If officeDays > 2 && officeAddress:                     │
│     POST /api/commute  ──────────────▶ Google Directions    │
│     (batched, one round-trip per neighborhood)              │
│                                                             │
│  4. Score all 44 neighborhoods locally:                     │
│     - deriveWeights(sliders, hasOffice, budgetPriority,     │
│       vibeStrength)                                         │
│     - scoreBudget / scoreCommute / scoreSafety              │
│     - scoreLifestyle / scoreCommunity                       │
│     - applyMbtaBonus (5-15 bonus or 15% penalty)            │
│     - computeMatchScoresTopsis(all dimensions + weights)    │
│     - applyAgeAdjustment (±5-10% by age group)              │
│     - applyUrbanAdjustment (±12-15% for extreme prefs)      │
│     - collegeArea / parking multiplicative penalties        │
│     - over-budget → match score 0                           │
│                                                             │
│  5. Build 3 budget-tier picks (saver / balanced / stretched)│
│                                                             │
│  6. Render: RecommendationCards, Map, NeighborhoodProfile,  │
│     ChatPanel, NewsPanel, MbtaAlertsPanel                   │
│                                                             │
│  7. On demand:                                              │
│     - POST /api/ai-summary   ──────▶ Claude Haiku           │
│     - POST /api/ai-overview  ──────▶ Claude Haiku           │
│     - POST /api/chat         ──────▶ Claude Haiku (stream)  │
│     - GET  /api/news         ──────▶ Google News RSS        │
│     - GET  /api/mbta-alerts  ──────▶ MBTA v3 API            │
└─────────────────────────────────────────────────────────────┘
```

State lives in **sessionStorage** between the wizard and the results page. There is no backend database — refreshing the results page re-runs the scoring from scratch against the stored input.

## Scoring algorithm

The app uses **TOPSIS** (Technique for Order Preference by Similarity to Ideal Solution), a classic multi-criteria decision-making method.

### 1. Dimension scoring (each 0–100)

Every neighborhood is scored on five independent dimensions in [lib/scoring.ts](./lib/scoring.ts):

| Dimension | What it measures | Key inputs |
|---|---|---|
| **Budget** | How much headroom the user has vs. rent | `perPersonRent`, `stretched` tier, `budgetPriority` |
| **Commute** | Piecewise-linear from 5 min (=100) to 75 min (=0) | Google Directions result, or 100 if officeDays ≤ 2 |
| **Safety** | Crime score from the pipeline (0–100) | `neighborhood.safety` |
| **Lifestyle** | Inverse distance between the user's sliders and the neighborhood's lifestyle profile | `sliders`, `neighborhood.lifestyleProfile` |
| **Community** | Neighborhood community score | `neighborhood.communityScore` |

### 2. Weight derivation ([lib/weights.ts](./lib/weights.ts))

`deriveWeights(sliders, hasLongCommute, budgetPriority, vibeStrength?)` returns normalized weights across the five dimensions. Four knobs shape it:

1. **Budget priority** (save / balanced / spend) — "save" boosts budget weight +15%; "spend" boosts budget weight +25% (since the scoring curve rewards expensive neighborhoods in spend mode)
2. **Office days** — long-commute users get commute weighted more heavily
3. **Lifestyle slider strength** — the farther a user's sliders are from center (3), the more weight lifestyle and community get relative to practical dimensions
4. **vibeStrength override** — when the user selects multiple vibes, averaging sliders dilutes their deviation from center. `vibeStrength` is the *max* deviation across the original vibes, passed to preserve the user's conviction level even after averaging

Safety always gets a fixed ~15% baseline. The remaining 85% is split between "practical" (budget + commute) and "preference" (lifestyle + community) based on the knobs above.

### 3. TOPSIS ([lib/scoring.ts](./lib/scoring.ts) — `computeMatchScoresTopsis`)

For the full 44-neighborhood decision matrix:

1. Vector-normalize each column (so dimensions are comparable)
2. Multiply by the derived weights
3. Compute the ideal best (column maxima) and ideal worst (column minima) across all neighborhoods
4. For each neighborhood, compute Euclidean distance to the ideal best (`d+`) and ideal worst (`d-`)
5. The match score is `d- / (d+ + d-) * 100` — the closeness coefficient, bounded 0–100

This produces a ranking that respects trade-offs: a neighborhood doesn't have to be best on any single axis to score well, as long as its weighted distance to the best-case is small.

### 4. Post-TOPSIS adjustments

Applied in order on [app/results/page.tsx](./app/results/page.tsx):

- `applyMbtaBonus`: +5–15 points if the neighborhood serves the user's preferred MBTA lines (proportional to how many match), or a **15% penalty** if none match
- `applyAgeAdjustment`: soft nudges for age group (e.g., 21–25 gets a lift for nightlife-heavy neighborhoods, 30–35 gets a lift for family-friendly ones). Clamped to ±10%
- `applyUrbanAdjustment`: ±12–15% nudge when the user has a strong urban or suburban preference (sliders 1–2 or 4–5). Prevents suburban neighborhoods from outranking urban ones for city-oriented users
- `avoidCollegeArea` + `neighborhood.collegeArea` → multiply by 0.3
- `needsParking` + `!parkingFriendly` → multiply by 0.3
- `overBudget` → match score set to 0 (recommendation disqualified)

### 5. Budget tiers ([lib/budget.ts](./lib/budget.ts))

`calculateBudgetTiers(income, maxRent)` returns:

- **Save Money**: `min(income * 0.45, maxRent)` — prioritize cheaper areas
- **Balanced**: `maxRent` — the rent the user said they'd normally pay
- **Stretch Budget**: `min(maxRent * 1.15, income * 0.70)` — willing to spend more for the right spot (capped at 15% above entered rent or 70% of income, whichever is lower)

The user picks their budget priority in the wizard (merged into a single `BudgetSelector` component showing the label, dollar amount, and description for each tier). The selection affects both the budget used for scoring and the scoring curve shape (save rewards cheap, balanced is pass/fail, spend rewards expensive).

## API routes

| Route | Method | Purpose | Env vars | External API | Rate limited? | Streaming? | Auth required? |
|---|---|---|---|---|---|---|---|
| `/api/commute` | POST | Transit + walking route from neighborhood to office | `GOOGLE_MAPS_API_KEY` | Google Directions | No | No | Yes |
| `/api/news` | GET | Boston news headlines (8 latest) | — | Google News RSS | No | Cached 15 min | Yes |
| `/api/mbta-alerts` | GET | Service alerts for requested lines | — | MBTA v3 | No | Cached 3 min | Yes |
| `/api/ai-summary` | POST | Per-neighborhood 2–3 sentence summary | `ANTHROPIC_API_KEY` | Claude Haiku | Yes (Upstash) | No | Yes |
| `/api/ai-overview` | POST | 3–4 sentence overview of top 3 picks | `ANTHROPIC_API_KEY` | Claude Haiku | Yes (Upstash) | No | Yes |
| `/api/chat` | POST | Multi-turn chat, grounded in the 44-neighborhood dataset | `ANTHROPIC_API_KEY` | Claude Haiku (streaming) | Yes (Upstash) | Yes (SSE) | Yes |

### Chat route specifics ([app/api/chat/route.ts](./app/api/chat/route.ts))

The `/api/chat` route is the most complex and deserves its own callout:

- **Request validation**: rejects if `messages.length > 10`, any message `content.length > 2000`, or any field has the wrong shape
- **Pre-check**: [lib/chatPrompt.ts](./lib/chatPrompt.ts) scans the latest user message for known prompt-injection phrases ("ignore previous instructions", "system prompt", etc.) and returns a fixed refusal stream without touching Claude
- **System prompt**: built from [COMPACT_SUMMARY](./lib/neighborhoodsServer.ts) (all 44 neighborhoods compressed to a few KB) plus detailed records for any neighborhoods mentioned in the user's question, plus the user's preferences translated to natural language, plus the Fair Housing / scope guardrails
- **Model**: `claude-haiku-4-5-20251001`, max 600 tokens
- **Streaming**: Server-Sent Events (`text/event-stream`) with an envelope format `{type: "text" | "done" | "error", delta?: string}`

## Rate limiting ([lib/rateLimit.ts](./lib/rateLimit.ts))

All three AI routes (`/api/ai-summary`, `/api/ai-overview`, `/api/chat`) share a single Upstash-backed sliding-window limiter: **20 requests per hour per authenticated user**. If `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` aren't set, the limiter returns `{ ok: true }` unconditionally — convenient for local dev, dangerous in production.

The rate-limit key is `user.id` (from the authenticated Supabase session), not the IP address.

## Authentication

All pages and API routes are gated behind Supabase Auth (Google + GitHub OAuth). Enforcement is a single [proxy.ts](./proxy.ts) at the project root (Next.js 16 renamed middleware to proxy):

- Unauth'd visits to any page → redirect to `/sign-in?next=<path>`
- Auth'd visits to `/sign-in` → redirect to `/`
- `/api/*` routes → never redirected; each route calls `requireUser()` from [lib/auth.ts](./lib/auth.ts) and returns 401 JSON on failure
- Every request refreshes the Supabase session cookie via `supabase.auth.getUser()`

The sign-in page at [app/sign-in/page.tsx](./app/sign-in/page.tsx) also renders a public user count by calling the `get_total_users` Postgres function (defined with `SECURITY DEFINER` so the anon role can read `auth.users` without the service role key).

The root layout at [app/layout.tsx](./app/layout.tsx) reads the current user server-side and mounts a [UserMenu](./components/UserMenu.tsx) dropdown in the top-right corner of every authenticated page.

See [DATA_SOURCES.md](./DATA_SOURCES.md) for the Supabase Auth entry and the spec at [docs/superpowers/specs/2026-04-10-supabase-auth-design.md](./docs/superpowers/specs/2026-04-10-supabase-auth-design.md) for the full design.

## Data pipeline ([scripts/fetch-real-data.ts](./scripts/fetch-real-data.ts))

The pipeline is a standalone Node script that writes to [public/data/neighborhoods.json](./public/data/neighborhoods.json). It's not hit at request time. Flags:

- `--mbta` — fetch MBTA stations and bus routes for each neighborhood from `api-v3.mbta.com`
- `--rent` — import Zillow rent snapshots from CSV files in `public/data/`
- `--crime` — Boston Open Data + FBI UCR for safety scores and trends
- `--places` — Google Places API for amenity counts (restaurants, nightlife, gyms, grocery, parks)
- `--all` — run everything

See [DATA_SOURCES.md](./DATA_SOURCES.md) for the full provenance of each field.

## Testing

Run `npm test` for the full Jest suite (138 tests). Coverage focuses on pure logic:

- [scoring.test.ts](./__tests__/scoring.test.ts) — dimension scorers, TOPSIS, bonuses
- [weights.test.ts](./__tests__/weights.test.ts) — weight derivation under different inputs
- [budget.test.ts](./__tests__/budget.test.ts) — tier math, per-person rent, percentages
- [news.test.ts](./__tests__/news.test.ts) — RSS parser edge cases
- [mbtaAlerts.test.ts](./__tests__/mbtaAlerts.test.ts) — line-to-route mapping, alert normalization
- [rateLimit.test.ts](./__tests__/rateLimit.test.ts) — Upstash presence/absence fallback
- [chatPrompt.test.ts](./__tests__/chatPrompt.test.ts) — pre-check, guardrails, prompt builder

UI components are not unit-tested — they rely on the pure logic they consume being correct.

## Deployment notes

- The app is designed to run on **Vercel**. `next build` produces a static `/` and `/results` plus dynamic `/api/*` routes.
- `NeighborhoodMap` is dynamically imported with `ssr: false` because Google Maps needs `window`.
- `/api/news` and `/api/mbta-alerts` use Next.js `{ next: { revalidate: N } }` for per-response caching — works out of the box on Vercel, no Redis needed.
- Without Upstash configured, `/api/chat` and friends have **no rate limiting** — do not ship to a public URL without setting up Upstash.
