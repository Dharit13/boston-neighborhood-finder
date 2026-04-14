# Boston Neighborhood Finder

## Why this project exists

Apartment sites like Zillow and Apartments.com are great once you already know *where* you want to live. They're useless for the actual hard question — **which neighborhood is right for me?** — because they filter listings by bedroom count and price, not by lifestyle fit, commute reality, safety, transit access, or vibe.

Anyone moving to a new city (students, relocating professionals, families) ends up cobbling together the answer from 10 browser tabs: a city subreddit for vibe, Google Maps for commute, a crime map for safety, MBTA's site for transit, Walk Score for walkability, a half-dozen rent listings to sanity-check budget. It's tedious, slow, and easy to get wrong.

**Boston Neighborhood Finder collapses that whole workflow into a 4-question wizard.** You tell it your budget, commute, and vibe — and it ranks all **44 Greater Boston neighborhoods** by how well they fit *you*, grounded in real rent data, MBTA transit coverage, Boston Police crime statistics, and Walk Score / Transit Score data.

## What makes it different

- **Vibe-based matching, not just filters.** Pick one or more of six lifestyle archetypes (City Life, Young Professional, Quiet & Cozy, Social Butterfly, Commute First, Family Friendly) — each maps to a 5-dimensional preference vector (nightlife↔quiet, urban↔suburban, trendy↔family, community↔privacy, budget↔convenience). Blend multiple vibes and the app averages them into a custom lifestyle profile. Zillow can't do this.
- **TOPSIS multi-criteria ranking** — instead of a naive weighted sum, neighborhoods are scored by their geometric distance to both an *ideal* point (best on every axis) and an *anti-ideal* point. That surfaces **well-rounded neighborhoods over lopsided ones** with one great stat and three terrible ones.
- **Three budget tiers surfaced side by side** — Save Money, Balanced, and Stretch — so you don't just see the cheapest fit, you see how much more you'd get by stretching (or how much you'd save by compromising).
- **Real commute times**, not straight-line distance, via Google Maps Directions for the actual office address you enter.
- **AI explanations grounded in real data** — Claude-powered per-neighborhood summaries and a top-3 overview explain *why* each pick was chosen, plus a follow-up chat assistant for "what's the late-night food scene like in East Boston?"–type questions.
- **Live Boston news and live MBTA service alerts** filtered to the lines that matter for your picks — so the recommendation reflects what's actually happening today, not a static snapshot.
- **Embedded Zillow and Apartments.com links** on every recommendation, so once you've picked a neighborhood you can jump straight to real listings.

## Features

- **Four-step wizard** — collects income, living arrangement, commute, and lifestyle preferences (multi-select vibes with blended scoring)
- **TOPSIS-based ranking** across five weighted dimensions (budget, commute, safety, lifestyle, community)
- **Three budget tiers** — Save Money (45% of income), Balanced (your entered rent), Stretch Budget (min of 115% rent or 70% income); each tier gets its own top pick
- **Real commute times** via Google Maps Directions (transit + walking) when the user provides an office address
- **AI explanations** — Claude Haiku generates per-neighborhood summaries and a top-3 overview
- **Neighborhood chat** — multi-turn conversation about any of the 44 neighborhoods, with Fair Housing guardrails and prompt-injection protection
- **Live Boston news** from Google News RSS and **live MBTA service alerts** for the user's preferred lines
- **Direct links** to Zillow and Apartments.com listings for each neighborhood
- **Interactive map** with recommendation pins and an optional office marker
- **Full sign-in gate** (Google OAuth via Supabase)
- **Per-user rate limiting** on AI routes (20/hr) with input validation on all API routes
- **Public user counter** on sign-in page

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5
- **Styling:** Tailwind CSS 4, Framer Motion
- **AI:** Anthropic Claude Haiku via the official SDK
- **Rate limiting:** Upstash Redis sliding window (20 req/hr per user for AI routes)
- **Maps:** Google Maps JavaScript API + Directions API
- **Data parsing:** fast-xml-parser for RSS
- **Testing:** Jest + Testing Library (138 tests covering scoring, weights, budget, TOPSIS, auth, input validation, rate-limit, news, chat prompt, MBTA alerts)

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/<your-fork>/boston-neighborhood-finder.git
cd boston-neighborhood-finder/neighbourhood_finder
npm install
```

### 2. Bring your own API keys

Copy the example env file and fill in your own keys:

```bash
cp .env.local.example .env.local
```

You will need to create accounts on the providers below. None of them come with the repository — **you are responsible for getting and paying for your own credentials.**

| Variable | Provider | Purpose | Cost |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/settings/keys) | Claude Haiku for AI summaries, overview, and chat | Pay per token (Haiku is cheap) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials) | Client-side map rendering | Free tier covers most personal use |
| `GOOGLE_MAPS_API_KEY` | Same as above, different key | Server-side Directions API for commute routing | Free tier covers most personal use |
| `UPSTASH_REDIS_REST_URL` | [Upstash Console](https://console.upstash.com/redis) | Rate limiting for AI routes | Free tier is plenty |
| `UPSTASH_REDIS_REST_TOKEN` | Same as above | Same as above | — |
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase](https://supabase.com) | Project URL for auth gate | Free tier covers this |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same | Anon public key | — |

**Upstash credentials are optional.** If you leave them blank, the rate limiter falls back to "allow everything" mode, which is fine for local development but **not safe for production** — an anonymous user could rack up unbounded Anthropic charges on your account.

For Google Maps, create two separate keys if you can: one restricted to HTTP referrers for the client-side key, and one restricted to server IP for the Directions API key.

### 3. Run it

```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # production build
npm test         # run the Jest suite (138 tests)
npm run lint     # ESLint (currently clean)
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the app is structured, the scoring algorithm, and the full data flow from wizard to recommendations
- [DATA_SOURCES.md](./DATA_SOURCES.md) — every external data source, where it comes from, how to attribute it, and whether it's pre-computed or fetched live
- [docs/superpowers/specs/](./docs/superpowers/specs/) — design specs for major features
- [docs/superpowers/plans/](./docs/superpowers/plans/) — implementation plans for those features

## Project layout (at a glance)

```
neighbourhood_finder/
├── app/                    # Next.js App Router pages and API routes
│   ├── page.tsx            # Wizard landing
│   ├── results/page.tsx    # Scoring + recommendations UI
│   └── api/                # /commute, /news, /mbta-alerts, /ai-*, /chat
├── components/
│   ├── wizard/             # Four wizard steps + container
│   ├── results/            # Recommendation cards, map, profile, chat, news, alerts
│   └── ui/                 # Shared visual bits (sliders, effects)
├── lib/                    # Scoring, weights, budget, commute, rate limit, chat prompt
├── scripts/                # Data pipeline (MBTA, crime, rent, Places)
├── public/data/            # Pre-computed neighborhoods.json + Zillow snapshots
├── __tests__/              # Jest unit tests
└── docs/                   # Specs and plans
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full breakdown.

## Disclaimers

- **Fair Housing compliance is non-negotiable.** The chat assistant is instructed to refuse any request that involves steering based on protected characteristics (race, religion, familial status, disability, etc.). See the guardrails in [lib/chatPrompt.ts](./lib/chatPrompt.ts). If you fork this, **keep those guardrails.**
- **Rent figures are snapshots, not real-time.** The neighborhood rent ranges in [public/data/neighborhoods.json](./public/data/neighborhoods.json) come from a dated snapshot — check [DATA_SOURCES.md](./DATA_SOURCES.md) for provenance and re-run the pipeline if you want fresher numbers.
- **This is a research/portfolio project, not housing advice.** Don't make lease decisions solely based on what this app tells you.

## Credits

External data sources are documented in [DATA_SOURCES.md](./DATA_SOURCES.md).

## License

MIT — see [LICENSE](./LICENSE).

## Contributing

Issues and PRs welcome. This is a personal/portfolio project, so response times may vary.
