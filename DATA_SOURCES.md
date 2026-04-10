# Data Sources

Every piece of data this app shows comes from one of the sources below. Some are fetched live on every request; others are pre-computed into [public/data/neighborhoods.json](./public/data/neighborhoods.json) by the scripts in [scripts/](./scripts/) and committed to the repo.

**If you fork this project, it is your responsibility to verify that your use of each data source complies with its terms of service** — especially for the scraped Zillow rent data, which is included in the repo as a snapshot and may not be redistributable.

## Quick reference

| Source | Live or pre-computed? | What it provides | Attribution needed? | License / terms |
|---|---|---|---|---|
| Supabase Auth | Live | Sign-in gate, session management, user count | No (service) | [Supabase ToS](https://supabase.com/terms) |
| Anthropic Claude API | Live | Per-neighborhood summaries, overview, chat | No (service) | Commercial API, per-token |
| Google Maps Directions API | Live | Commute routes (transit + walking) | Required ("powered by Google") | [Google Maps Platform ToS](https://cloud.google.com/maps-platform/terms) |
| Google Maps JavaScript API | Live | Map rendering on results page | Required | Same |
| Google News RSS | Live (cached 15m) | Latest Boston headlines | Link back to publisher | [Google News ToS](https://news.google.com/) |
| MBTA v3 API (alerts) | Live (cached 3m) | Service alerts for preferred lines | Suggested ("data from MBTA") | Public domain, [MBTA developer portal](https://www.mbta.com/developers) |
| MBTA v3 API (stops/routes) | Pre-computed | Station names, line coverage, bus routes | Same | Same |
| Walk Score API | Pre-computed | Walk / transit / bike scores | Required per [Walk Score ToS](https://www.walkscore.com/tile/) | Free tier for non-commercial use |
| Google Places API | Pre-computed | Amenity counts (restaurants, nightlife, gyms, grocery, parks) | Required | Same as Google Maps Platform |
| Zillow rent snapshots | Pre-computed (snapshot only) | Median studio / 1BR / 2BR rent per neighborhood | **Verify before redistributing** | [Zillow ToS](https://www.zillow.com/z/corp/terms/) — see warning below |
| Boston Open Data + FBI UCR | Pre-computed | Safety scores and trends | Recommended | Public domain |
| US Census ACS | Optional, pipeline | Demographic context (if queried) | Recommended | Public domain |

## Live sources (hit at request time)

### Supabase Auth

- **Endpoint:** `https://<project-ref>.supabase.co/auth/v1`
- **Used by:** [proxy.ts](./proxy.ts), [lib/supabase/server.ts](./lib/supabase/server.ts), [lib/supabase/client.ts](./lib/supabase/client.ts), [app/sign-in/page.tsx](./app/sign-in/page.tsx), [app/auth/callback/route.ts](./app/auth/callback/route.ts)
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Providers:** Google, GitHub (OAuth 2.0)
- **Attribution:** Not required (service)
- **Notes:** The app is fully gated behind sign-in. Rate limiting on AI routes is keyed on `user.id` (20 req/hour). Also provides a public user-count RPC (`get_total_users`) used for social proof on `/sign-in` — see the SQL migration at [supabase/migrations/001_get_total_users.sql](./supabase/migrations/001_get_total_users.sql).

### Anthropic Claude API

- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Model:** `claude-haiku-4-5-20251001`
- **Used by:** [app/api/ai-summary/route.ts](./app/api/ai-summary/route.ts), [app/api/ai-overview/route.ts](./app/api/ai-overview/route.ts), [app/api/chat/route.ts](./app/api/chat/route.ts)
- **Env var:** `ANTHROPIC_API_KEY` — [get one here](https://console.anthropic.com/settings/keys)
- **Rate limit:** 20 requests per hour per authenticated user (enforced by [lib/rateLimit.ts](./lib/rateLimit.ts), backed by Upstash Redis, keyed on `user.id`)
- **Notes:** Haiku is used everywhere for cost — the three AI routes are bounded at 200, 300, and 600 output tokens respectively. The chat route uses streaming (SSE). All prompts are built from the static neighborhood dataset, not from any external source.

### Google Maps Directions API

- **Endpoint:** `https://maps.googleapis.com/maps/api/directions/json`
- **Used by:** [app/api/commute/route.ts](./app/api/commute/route.ts)
- **Env var:** `GOOGLE_MAPS_API_KEY` (server-side)
- **Parameters:** Origin lat/lng, destination address, `mode=transit` and `mode=walking` in parallel, `departure_time` set to the next weekday 8:30 AM
- **Usage in app:** If the user has `officeDays > 2`, the results page batches requests for all 44 neighborhoods and picks the fastest transit route, falling back to walking only if no transit route exists
- **Attribution requirement:** Google Maps Platform requires a "powered by Google" attribution visible on any page that renders results derived from their API — currently this is implicit via the Google Map embed. If you use the commute API without rendering a Google Map, add the attribution text manually.

### Google Maps JavaScript API

- **Used by:** [components/results/NeighborhoodMap.tsx](./components/results/NeighborhoodMap.tsx)
- **Env var:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (client-side — restrict by HTTP referrer in Google Cloud Console)
- **Renders:** Recommendation pins, selected neighborhood highlight, optional office marker
- **Notes:** The map is dynamically imported with `ssr: false` to avoid SSR issues with the Google Maps runtime.

### Google News RSS

- **Endpoint:** `https://news.google.com/rss/search?q=Boston&hl=en-US&gl=US&ceid=US:en`
- **Used by:** [app/api/news/route.ts](./app/api/news/route.ts)
- **Parsed by:** [lib/news.ts](./lib/news.ts) using `fast-xml-parser`
- **Env var:** None
- **Cache:** Next.js `revalidate: 900` (15 minutes)
- **Rendering:** [components/results/NewsPanel.tsx](./components/results/NewsPanel.tsx) shows up to 8 items, sorted latest first, with a clickable link to the publisher
- **Attribution:** Each item displays its source (e.g., "WCVB", "MassLive"), and clicking the title deep-links to the publisher's site via the Google News redirect

### MBTA v3 API

- **Endpoint:** `https://api-v3.mbta.com/alerts`
- **Used by:** [app/api/mbta-alerts/route.ts](./app/api/mbta-alerts/route.ts)
- **Env var:** None (the v3 API allows unauthenticated requests with a lower rate limit)
- **Cache:** Revalidate 180 seconds
- **Filter:** Only alerts with `severity >= 3`; excludes `ELEVATOR_CLOSURE` / `FACILITY_CLOSURE` effects
- **Rendering:** [components/results/MbtaAlertsPanel.tsx](./components/results/MbtaAlertsPanel.tsx) shows alerts for the lines the user selected in the wizard
- **Attribution:** MBTA data is public domain. A soft "data from MBTA" line is suggested but not legally required.

## Pre-computed sources (baked into `neighborhoods.json`)

These are fetched by the pipeline scripts and written into [public/data/neighborhoods.json](./public/data/neighborhoods.json). The app itself never calls them at runtime.

### MBTA v3 API — stations and bus routes

- **Endpoints:** `https://api-v3.mbta.com/stops`, `https://api-v3.mbta.com/routes`
- **Fetched by:** [scripts/fetch-real-data.ts](./scripts/fetch-real-data.ts) (run with `--mbta`)
- **Fields populated:** `neighborhood.mbtaLines`, `neighborhood.mbtaStations`, `neighborhood.busRoutes`
- **License:** Public domain

### Walk Score API

- **Endpoint:** `https://api.walkscore.com/score`
- **Fetched by:** [scripts/fetch-real-data.ts](./scripts/fetch-real-data.ts)
- **Fields populated:** `neighborhood.walkScore`, `neighborhood.transitScore`, `neighborhood.bikeScore`
- **Terms:** Walk Score offers a free tier for non-commercial use. **Required attribution** is a "Walk Score" link visible somewhere on any page that shows the score. The pre-computed values are committed into `neighborhoods.json` — if you publish your deployment, add the attribution to the footer of your neighborhood profile page.
- **Get a key:** https://www.walkscore.com/professional/api.php

### Google Places API

- **Endpoint:** `https://maps.googleapis.com/maps/api/place/nearbysearch/json`
- **Fetched by:** [scripts/fetch-real-data.ts](./scripts/fetch-real-data.ts) (run with `--places`)
- **Fields populated:** `neighborhood.amenities` (restaurants, nightlife, gyms, grocery, parks)
- **Methodology:** The pipeline uses two radii — a "tight" 400m radius for dense-area differentiation and a "full" 1km radius for coverage. The tight counts feed into lifestyle-profile derivation (e.g., 15+ bars in 400m = nightlife-heavy).
- **Terms:** Google Maps Platform ToS; attribution required

### Zillow rent snapshots

- **Files:** [public/data/zillow-rent-snapshot-2026-04-09.md](./public/data/), [public/data/zillow-*.csv](./public/data/), plus historical subdirectories `2022/`, `2023/`, `2024/`
- **Fields populated:** `neighborhood.rent.studio`, `neighborhood.rent.oneBr`, `neighborhood.rent.twoBr` (each as `[low, high]` ranges)
- **Methodology:** See the markdown methodology files next to each snapshot for how the numbers were collected and normalized.

⚠️ **Legal warning:** Zillow's terms of service restrict automated scraping and redistribution of their data. The snapshots in this repository are historical and were collected for research purposes. **Before publishing this repo publicly or using it commercially, you should:**

1. Review the current [Zillow terms of service](https://www.zillow.com/z/corp/terms/)
2. Consider replacing the Zillow data with a source that permits redistribution — for example:
   - [HUD Fair Market Rent](https://www.huduser.gov/portal/datasets/fmr.html) (public domain)
   - [Apartment List Rent Estimates](https://www.apartmentlist.com/research/category/data-rent-estimates) (public, with attribution)
   - [Census ACS B25064 (median gross rent)](https://api.census.gov/data/2022/acs/acs5) (public domain)
3. If you keep the Zillow snapshot, make it clear in your UI that the numbers are an outdated research snapshot, not live listings.

The pre-computed nature of the data at least means your deployed app doesn't hit Zillow at request time — the scraping risk is in the pipeline, not the app.

### Boston Open Data + FBI UCR — crime

- **Sources:**
  - Boston: https://data.boston.gov/dataset/crime-incident-reports
  - FBI UCR: https://crime-data-explorer.fr.cloud.gov/api (for suburbs)
- **Fetched by:** [scripts/fetch-real-data.ts](./scripts/fetch-real-data.ts) (run with `--crime`)
- **Fields populated:** `neighborhood.safety` (0–100), `neighborhood.safetyTrend` (improving / stable / declining)
- **Methodology:** The pipeline normalizes incident rates per 100k population across all neighborhoods and scales the result into a 30–95 safety band, then classifies trend based on year-over-year change. See script source for the exact formula.
- **License:** Public domain — both datasets are open government data.

### US Census American Community Survey (optional)

- **Endpoint:** `https://api.census.gov/data/2021/acs/acs5`
- **Fetched by:** [scripts/fetch-real-data.ts](./scripts/fetch-real-data.ts) when demographic context is needed
- **License:** Public domain

## Pre-computed data files in the repo

Everything under [public/data/](./public/data/) is either committed output of the pipeline or input the pipeline consumes:

| File | What it is | Source |
|---|---|---|
| `neighborhoods.json` | The 44-neighborhood dataset — the main thing the app reads | Pipeline output |
| `boston-neighborhoods.geojson` | Neighborhood polygon boundaries (Boston proper) | City of Boston open data |
| `ma-towns.geojson` | Town polygons for inner-ring suburbs | MassGIS |
| `zillow-rent-snapshot-2026-04-09.md` | Methodology notes for the April 2026 rent snapshot | Manual |
| `zillow-*.csv` | Raw rent data per neighborhood | Zillow (see warning above) |
| `2022/`, `2023/`, `2024/` | Historical Zillow snapshots | Zillow |

## Dependencies that ship with the app

These are npm packages, not external data — but they're worth noting for attribution purposes:

- **[components/ui/pixel-trail.tsx](./components/ui/pixel-trail.tsx)** and **[components/ui/gooey-filter.tsx](./components/ui/gooey-filter.tsx)** — visual effects adapted from **[Fancy Components](https://fancycomponents.dev)** by Daniel Petho ([github.com/danielpetho/fancy](https://github.com/danielpetho/fancy), MIT License). Attribution comments are at the top of each file.

## If you want to refresh the data

Run the pipeline with whichever flag(s) you need:

```bash
# Pull new MBTA station / bus route data
npx tsx scripts/fetch-real-data.ts --mbta

# Refresh rent data (requires manually updating the CSVs first)
npx tsx scripts/fetch-real-data.ts --rent

# Refresh crime data
npx tsx scripts/fetch-real-data.ts --crime

# Refresh amenity counts
npx tsx scripts/fetch-real-data.ts --places

# Run everything
npx tsx scripts/fetch-real-data.ts --all
```

Note: `--places` requires a `GOOGLE_MAPS_API_KEY` with the Places API enabled, and `--crime` may require a Boston Open Data API token depending on rate limits. Check the script source for the exact requirements.

## Summary: attribution checklist before you deploy

If you publish a live deployment of this app, make sure your UI includes visible attribution for:

- [ ] **Google Maps** — satisfied by the map embed itself, but check that the "Powered by Google" badge is visible
- [ ] **Walk Score** — add a footer link wherever walk/transit/bike scores are shown
- [ ] **MBTA** — optional but polite ("MBTA alerts provided by api-v3.mbta.com")
- [ ] **News sources** — already handled per-item by `NewsPanel`
- [ ] **Zillow** — **either add attribution per their ToS, or replace the data source**
- [ ] **Anthropic** — no attribution required, but you may want to disclose "AI summaries by Claude" to users for transparency
