# Supabase Auth — Design Spec

**Date:** 2026-04-10
**Status:** Approved, ready for implementation plan
**Goal:** Gate the entire Boston Neighborhood Finder app behind Supabase-authenticated sessions so that AI-route cost protection shifts from IP-based rate limiting to per-user accountability.

---

## 1. Scope and motivation

The unauthenticated app has three paid external dependencies that are abusable by anonymous traffic:

- `/api/chat` — Claude Haiku streaming (max 600 tokens per request)
- `/api/ai-summary` — Claude Haiku (max 200 tokens)
- `/api/ai-overview` — Claude Haiku (max 300 tokens)

Today these are protected by an Upstash sliding-window limiter keyed on `x-forwarded-for`. IP-based limits are trivially defeated by residential proxies and rotating IPs, which is an unacceptable cost risk for a public deploy.

**In scope for this spec:**

- Full sign-in gate in front of every page and API route (no anonymous access anywhere)
- Supabase Auth with Google and GitHub OAuth providers only
- Per-`user.id` rate limiting (20 requests/hour, shared across the three AI routes)
- Sign-out UI accessible from every authenticated page
- Graceful 401 handling on the client when sessions expire mid-use
- **Public user count** on the sign-in page (total registered users) — exposed via a `SECURITY DEFINER` Postgres function, no service role key
- **GitHub Actions CI workflow** — lint, typecheck, test, build on every push and PR

**Out of scope:**

- User profile pages
- Server-side persistence of wizard inputs, favorites, or chat history (the app remains stateless except for the session cookie)
- Email/password sign-in
- Admin vs. regular user roles
- Account deletion flows (Supabase dashboard handles this manually for now)
- Row Level Security policies (we never write to Supabase tables)
- Per-user analytics beyond the total count (no session tracking, no funnel metrics, no event logs)
- Auto-deploy from CI (Vercel's native GitHub integration handles deploys)

## 2. Architecture

### 2.1 Library choice

**Package:** `@supabase/ssr` — the official Next.js App Router package. Handles cookie-based sessions consistently across Server Components, Route Handlers, and Middleware. We do **not** use `@supabase/auth-helpers-nextjs` (deprecated) or roll our own cookie management.

### 2.2 Client factories

Two small modules under `lib/supabase/`:

**`lib/supabase/server.ts`** — server-side factory for Server Components, Route Handlers, and Middleware:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component — writing cookies is not
            // allowed there, so silently no-op. The middleware will
            // refresh the cookie on the next request.
          }
        },
      },
    }
  );
}

export async function getUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

**`lib/supabase/client.ts`** — browser factory for Client Components (sign-in buttons, sign-out button):

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 2.3 Route map after auth

| Route | Access | Redirect behavior |
|---|---|---|
| `/` (wizard) | Protected | Unauth → `/sign-in` |
| `/results` | Protected | Unauth → `/sign-in?next=/results` |
| `/sign-in` | Public | Authed → `/` |
| `/auth/callback` | Public | Always callable (used by OAuth flow) |
| `/api/commute` | Protected | 401 JSON |
| `/api/news` | Protected | 401 JSON |
| `/api/mbta-alerts` | Protected | 401 JSON |
| `/api/ai-summary` | Protected + rate-limited | 401 or 429 JSON |
| `/api/ai-overview` | Protected + rate-limited | 401 or 429 JSON |
| `/api/chat` | Protected + rate-limited | 401 or 429 (SSE-friendly) |

Every API route is gated, not just AI routes. The non-AI routes stay unlimited (they're cheap) but still require a session — the app is entirely behind the wall, so leaving them anonymous would be an inconsistency, not a feature.

### 2.4 Middleware (enforcement layer)

**File:** `middleware.ts` at the project root.

Runs on every request matching the config matcher (all paths except Next.js internals and static assets). Responsibilities:

1. Create a Supabase server client bound to the request/response cookie jar
2. Call `supabase.auth.getUser()` — this refreshes the session cookie if needed (critical: without this call, sessions never refresh and users get logged out every hour)
3. Pathname check (order matters):
   1. If path starts with `/api/` → never redirect; just return the response with cookie updates and let the API route handle auth via its own `requireUser()` check (returning 401 JSON). Middleware's job for APIs is purely to keep the cookie fresh.
   2. If path is `/auth/callback` → always allow (needed for the OAuth exchange to succeed)
   3. If path is `/sign-in`:
      - If authenticated → `NextResponse.redirect("/")`
      - Otherwise → allow
   4. Any other path:
      - If unauthenticated → `NextResponse.redirect("/sign-in?next=<pathname>")`
      - Otherwise → allow, returning the response with any cookie updates

**Matcher config:**
```ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Return-to URL handling:**
- Redirect to `/sign-in?next=<pathname>` when kicking an unauth'd user off a protected page
- The `/sign-in` page reads `next` from the query string, stores it in a hidden input, and the `/auth/callback` route reads it from state (passed through Supabase OAuth's `redirectTo` option) and forwards the user there after successful code exchange
- Validate `next` is a same-origin path (starts with `/`, no `//`, no protocol) to prevent open-redirect vulnerabilities

### 2.5 Data flow

```
Cold visit to https://app.vercel.app/results
  ↓
middleware: getUser() → null
  ↓
redirect → /sign-in?next=/results
  ↓
user clicks "Continue with Google"
  ↓
client calls supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: "https://app.vercel.app/auth/callback?next=/results" }
})
  ↓
browser navigates to Supabase → Google consent → Supabase callback
  ↓
Supabase redirects to https://app.vercel.app/auth/callback?code=XYZ&next=/results
  ↓
/auth/callback route handler:
  - supabase.auth.exchangeCodeForSession(code) → sets session cookie
  - validates `next` is a safe same-origin path
  - redirects to `next` (or "/" if invalid/missing)
  ↓
middleware: getUser() → { id, email, ... }
  ↓
/results renders
```

## 3. Sign-in UX

### 3.1 `/sign-in` page

**File:** `app/sign-in/page.tsx` (Server Component)

Visual style matches the wizard landing: black background, pixel-trail background effect, centered glassmorphic card. Content:

- Title: "Boston Neighbourhood Finder"
- Subtitle: "Sign in to get started"
- Two buttons stacked vertically:
  - "Continue with Google" (white button, Google icon)
  - "Continue with GitHub" (dark button, GitHub icon)
- **Public user counter** (small text, white/50, below the buttons): `"Join N others finding their neighborhood"` where `N` is the total registered user count. Falls back to the subtitle-only state if the RPC fails or returns 0/1 (we don't render "Join 0 others" — see rendering rules in Section 3.4).
- Footer line (small text, white/50): "We use your account only to prevent abuse of AI features. No profile data is stored."
- If `?error=<code>` is present, show a small red banner above the buttons with a human message

**Fetching the count:** the Server Component calls `supabase.rpc("get_total_users")` at render time using the anon client. The Postgres function is set up once (see Section 7.3 step 6) with `SECURITY DEFINER` so it can read from `auth.users` despite the anon role not normally having that access. No service role key is needed.

### 3.4 User count rendering rules

- If RPC returns `null` or errors → render only the "Sign in to get started" subtitle (no counter line); do not surface the error to the user, log it server-side
- If RPC returns `0` → render only the subtitle (no "Join 0 others" because it reads badly)
- If RPC returns `1` → render "Be the second to find your neighborhood" (grammatical singular handling)
- If RPC returns `2+` → render "Join N others finding their neighborhood"

Page uses Next.js segment config `export const dynamic = "force-dynamic"` so the count is always fresh; caching would make the counter stale without giving users much benefit.

**Error codes to handle:**
- `oauth_denied` — "Sign-in cancelled."
- `oauth_failed` — "Couldn't complete sign-in. Please try again."
- `missing_code` — "Sign-in link was invalid. Please try again."

### 3.2 `SignInButtons` (Client Component)

**File:** `app/sign-in/SignInButtons.tsx`

- Reads `next` from `useSearchParams()`
- Each button's `onClick` calls:
  ```ts
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: "google" | "github",
    options: {
      redirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
    },
  });
  ```
- Buttons show a subtle disabled/loading state while the redirect is in flight

### 3.3 `/auth/callback` route handler

**File:** `app/auth/callback/route.ts`

```ts
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Open-redirect protection: only allow same-origin relative paths
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth_failed`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
```

## 4. Sign-out UX

### 4.1 `UserMenu` component

**File:** `components/UserMenu.tsx` (Client Component)

- Fixed position: top-right corner of the viewport, `top-4 right-4 z-50`
- Closed state: small circular button (32px)
  - If `user.user_metadata.avatar_url` exists, render the avatar image
  - Otherwise, render a colored disc with the first letter of the email
- Click → dropdown panel:
  - Email (read-only, small gray text)
  - "Sign out" button
- Sign out handler:
  ```ts
  const supabase = createClient();
  await supabase.auth.signOut();
  router.push("/sign-in");
  router.refresh();
  ```
- Closes on outside click (useEffect + mousedown listener)

### 4.2 Mounting in the layout

`app/layout.tsx` is modified to:
1. Read the current user server-side via `getUser()` from `lib/supabase/server.ts`
2. Pass `email` and `avatarUrl` as props to a small wrapper that conditionally renders `<UserMenu>` only when a user exists AND the pathname is not `/sign-in` / `/auth/callback`

Because the root layout wraps both `/` and `/results`, the menu appears on both without per-page wiring.

## 5. API route protection

### 5.1 Shared guard helper

**File:** `lib/auth.ts`

```ts
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export async function requireUser(): Promise<
  | { user: User; response: null }
  | { user: null; response: NextResponse }
> {
  const user = await getUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
  return { user, response: null };
}
```

### 5.2 Usage in API routes

Every protected API route opens with:

```ts
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  // ...existing route logic...
}
```

For the three rate-limited routes, the rate limit call becomes:

```ts
const rl = await checkRateLimit(user.id);
if (!rl.ok) {
  return NextResponse.json(
    { error: "Rate limit exceeded", resetAt: rl.resetAt },
    { status: 429 }
  );
}
```

The old IP extraction (`req.headers.get("x-forwarded-for") ?? "unknown"`) is deleted from all three routes.

### 5.3 Routes to modify

| File | Add `requireUser()` | Rate-limit on `user.id` |
|---|---|---|
| `app/api/commute/route.ts` | Yes | No |
| `app/api/news/route.ts` | Yes | No |
| `app/api/mbta-alerts/route.ts` | Yes | No |
| `app/api/ai-summary/route.ts` | Yes | Yes |
| `app/api/ai-overview/route.ts` | Yes | Yes |
| `app/api/chat/route.ts` | Yes | Yes |

### 5.4 SSE 401/429 for `/api/chat`

The chat route is SSE-streaming. The pattern for auth/rate-limit failures:

- If `requireUser()` or the rate-limit check fails **before** the stream starts, return a normal JSON 401/429 (not an SSE envelope) — the `ChatPanel` client handles both HTTP 200 (SSE stream) and HTTP 4xx (JSON error) code paths.
- Failures cannot occur mid-stream because the auth check runs before `anthropic.messages.stream(...)` is called.

### 5.5 Client 401 handling

`ChatPanel.tsx`, `RecommendationOverview.tsx`, and `NeighborhoodProfile.tsx` each get a small helper that:
1. Checks the fetch response for `status === 401`
2. Shows a small inline banner: "Your session expired — please sign in again"
3. Provides a button that does `router.push("/sign-in?next=/results")`

The rest of the results page (rankings, map, cards, budget tiers) continues to render normally. Only the three AI features degrade.

For 429 responses, the same banner pattern shows: "You've used all 20 of your hourly AI requests. Try again at <resetAt formatted time>." No re-auth button, just a disabled state until reset.

## 6. Rate limiting

### 6.1 Configuration changes

**File:** `lib/rateLimit.ts`

- Parameter rename: `ip: string` → `identifier: string`
- Sliding window: 20 requests / 1 hour (was 10 / 1 hour)
- Return type extended with `resetAt?: number` (epoch milliseconds)
- Upstash key prefix bumped to `"ai-user-20-1h"` (was `"ai-ip-10-1h"` or similar) — this invalidates any existing IP-keyed buckets so we don't accidentally carry stale counters

### 6.2 Dev fallback unchanged

If `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` are unset, the limiter returns `{ ok: true }` unconditionally. Existing README/DATA_SOURCES warnings about "never deploy without Upstash" still apply.

### 6.3 Test delta

**File:** `__tests__/rateLimit.test.ts`

- Existing tests still pass as-is (the argument is a string; name doesn't matter to the test)
- Add one assertion: return value includes `resetAt` on denial

No changes needed to other test files.

## 7. Environment setup

### 7.1 New env vars

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Both are `NEXT_PUBLIC_` because the anon key is intentionally public (all security is enforced in Supabase's backend). We do not need `SUPABASE_SERVICE_ROLE_KEY` because we never bypass RLS.

### 7.2 `.env.local.example` update

Append:

```
# Supabase Auth credentials for sign-in gate
# https://supabase.com → Settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### 7.3 Supabase dashboard setup

One-time manual steps (not automated; documented so future maintainers can re-do it):

1. **Create project** at https://supabase.com → region near Vercel's deploy region
2. **Copy API credentials** from Settings → API → paste into `.env.local` (dev) and Vercel env vars (prod)
3. **Auth → URL Configuration:**
   - Site URL: `https://boston-neighborhood-finder.vercel.app`
   - Redirect URLs:
     - `https://boston-neighborhood-finder.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback`
4. **Auth → Providers → Google:** enable, paste Client ID + Secret (from Google setup below)
5. **Auth → Providers → GitHub:** enable, paste Client ID + Secret (from GitHub setup below)
6. **SQL Editor → New query → paste and run** (creates the public user-count RPC used by the sign-in page counter):

```sql
create or replace function public.get_total_users()
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int from auth.users;
$$;

grant execute on function public.get_total_users() to anon, authenticated;
```

The `security definer` flag means the function runs with the privileges of its creator (Postgres superuser), so it can read `auth.users` even when called by the `anon` role. Only the total count is exposed — no user rows, emails, or IDs leak. This is the standard Supabase pattern for "public stats" queries.

### 7.4 Google OAuth console setup

1. https://console.cloud.google.com/apis/credentials (reuse existing Maps project)
2. Create credentials → OAuth client ID → Web application
3. **Authorized JavaScript origins:**
   - `https://boston-neighborhood-finder.vercel.app`
   - `http://localhost:3000`
4. **Authorized redirect URIs:** `https://<supabase-project-ref>.supabase.co/auth/v1/callback` (Google redirects to Supabase, not to our app directly)
5. Copy Client ID and Client secret → paste into Supabase → Auth → Providers → Google

### 7.5 GitHub OAuth app setup

1. https://github.com/settings/developers → OAuth Apps → New OAuth App
2. **Application name:** `Boston Neighborhood Finder`
3. **Homepage URL:** `https://boston-neighborhood-finder.vercel.app`
4. **Authorization callback URL:** `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
5. Copy Client ID, generate Client secret → paste into Supabase → Auth → Providers → GitHub

### 7.6 Vercel env var setup

Add to Vercel project → Settings → Environment Variables, scoped to Production + Preview + Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Trigger a new deploy (push any commit, or use the "Redeploy" button) to pick up the new vars.

## 8. File-by-file change summary

### New files

| Path | Purpose |
|---|---|
| `middleware.ts` | Next.js middleware — session refresh + redirect logic |
| `lib/supabase/server.ts` | Server-side Supabase client factory + `getUser()` helper |
| `lib/supabase/client.ts` | Browser-side Supabase client factory |
| `lib/auth.ts` | `requireUser()` helper for API routes |
| `lib/userCount.ts` | `getTotalUserCount()` helper calling the `get_total_users` RPC |
| `app/sign-in/page.tsx` | Sign-in page Server Component (reads user count for the counter) |
| `app/sign-in/SignInButtons.tsx` | Client Component with OAuth trigger buttons |
| `app/sign-in/UserCount.tsx` | Small presentational component applying the 0/1/2+ rendering rules from Section 3.4 |
| `app/auth/callback/route.ts` | OAuth code exchange and safe redirect |
| `components/UserMenu.tsx` | Top-right avatar/sign-out dropdown |
| `__tests__/auth.test.ts` | Unit tests for `requireUser()` with mocked Supabase client |
| `__tests__/userCount.test.ts` | Unit tests for `getTotalUserCount()` fallback behavior and rendering helper |
| `.github/workflows/ci.yml` | GitHub Actions CI workflow (see Section 11) |
| `supabase/migrations/001_get_total_users.sql` | Checked-in SQL for the user-count RPC, matching Section 7.3 step 6 |

### Modified files

| Path | Change |
|---|---|
| `app/layout.tsx` | Read user server-side, conditionally mount `UserMenu` |
| `app/api/commute/route.ts` | Prepend `requireUser()` guard |
| `app/api/news/route.ts` | Prepend `requireUser()` guard |
| `app/api/mbta-alerts/route.ts` | Prepend `requireUser()` guard |
| `app/api/ai-summary/route.ts` | Guard + rate limit on `user.id`, delete IP extraction |
| `app/api/ai-overview/route.ts` | Guard + rate limit on `user.id`, delete IP extraction |
| `app/api/chat/route.ts` | Guard + rate limit on `user.id`, delete IP extraction |
| `lib/rateLimit.ts` | Rename param, bump limit to 20, add `resetAt` to return, change key prefix |
| `components/results/ChatPanel.tsx` | Handle 401 / 429 responses with inline banner |
| `components/results/RecommendationOverview.tsx` | Same 401 / 429 handling |
| `components/results/NeighborhoodProfile.tsx` | Same 401 / 429 handling |
| `__tests__/rateLimit.test.ts` | Add `resetAt` assertion |
| `.env.local.example` | Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` placeholders |
| `ARCHITECTURE.md` | Add "Authentication" section + update API routes table |
| `DATA_SOURCES.md` | Add Supabase Auth entry under live sources |
| `README.md` | Add Supabase to env vars table; update rate-limit copy (10→20 per user) |
| `package.json` | Add `@supabase/ssr` and `@supabase/supabase-js` dependencies |

### New dependencies

- `@supabase/ssr` — Next.js SSR cookie adapter
- `@supabase/supabase-js` — peer dep of `@supabase/ssr`, used for type imports

No devDependency additions.

## 9. Testing strategy

**Unit tests (new):**
- `__tests__/auth.test.ts` — mocks `@/lib/supabase/server` and asserts `requireUser()` returns `{ user, response: null }` on valid session and `{ user: null, response: NextResponse(401) }` on null session
- `__tests__/rateLimit.test.ts` — existing + one new assertion that denial response includes `resetAt`

**Unit tests (unchanged):**
- `scoring.test.ts`, `weights.test.ts`, `budget.test.ts`, `news.test.ts`, `mbtaAlerts.test.ts`, `chatPrompt.test.ts` — no auth concerns, no changes needed

**Route-level integration tests:** existing tests do not cover full HTTP request/response cycles for the API routes. Rather than retrofit with auth mocks across six routes, we rely on:
1. `requireUser()` being unit-tested in isolation
2. Pure logic helpers (`chatPrompt`, `scoring`, etc.) staying under coverage
3. Manual smoke test against a deployed preview

**Manual smoke test checklist after deploy:**
- [ ] Cold visit to `/` → redirects to `/sign-in`
- [ ] Cold visit to `/results` → redirects to `/sign-in?next=/results`
- [ ] `/sign-in` shows the user count line (or no counter if count < 2 — verify grammar branches match Section 3.4)
- [ ] Sign in with Google → lands on `/` or `/results` per `next`
- [ ] Sign in with GitHub → same
- [ ] Avatar menu shows email and sign-out
- [ ] Sign out → redirects to `/sign-in`, user counter increments on next refresh if this was a new signup
- [ ] Signed-in user on `/sign-in` → redirects to `/`
- [ ] Chat/summary/overview features work end-to-end
- [ ] 21st AI request in an hour → 429 with human-readable reset time
- [ ] Manually expire session (clear cookies) → next AI fetch returns 401 → inline banner + re-sign-in works
- [ ] GitHub Actions `verify` workflow runs green on the merge commit
- [ ] Intentionally push a commit with a lint error → CI fails → revert → CI passes

## 10. Risks and tradeoffs

**Accepted:**

- **Session expiration mid-chat is abrupt.** A user mid-conversation whose session expires gets a 401 on their next message. Graceful recovery is left to the client's 401 banner — they re-auth and land back on `/results`, but the chat history is lost (we don't persist). This is consistent with the "no profile data stored" position.

- **No preview deploy URL pre-registered.** Vercel preview deploys get randomized URLs and will not work with OAuth unless each one is added to Supabase Redirect URLs. We skip this with a wildcard (`vercel.app/**`) or document it as a known limitation. Recommendation: wildcard for convenience, and document that preview deploys may fail OAuth if Supabase doesn't accept the wildcard (not all providers do).

- **Google/GitHub outages disable the whole app.** Because there's no email/password fallback, if both OAuth providers are down, no one can sign in. This is acceptable for a portfolio app; a production app would add email magic links as a fallback.

- **`getUser()` called on every request in middleware** has a small latency cost (one Supabase round trip per page load). Supabase's SSR guide explicitly recommends this over `getSession()` because `getSession()` reads from the cookie without verifying, which is a security hole. We accept the latency.

**Rejected alternatives:**

- **Progressive gate (public wizard, gated AI only)** — rejected by user; full gate is simpler and provides stronger cost protection.
- **Per-route rate limits** (e.g., 5/hr chat, 10/hr summary, 10/hr overview) — rejected in favor of one shared 20/hr bucket. Simpler mental model, easier to tune.
- **Email/password sign-in** — rejected; OAuth-only removes password management overhead.
- **Retrofit all route tests with auth mocks** — rejected; high test churn for low marginal confidence. `requireUser()` unit test is sufficient.

## 11. Continuous Integration (GitHub Actions)

**File:** `.github/workflows/ci.yml`

A single workflow that runs on every push to `master` and every pull request. Fails the commit/PR status check if any step fails. Vercel's auto-deploy on push is independent of this workflow — CI is the gate, Vercel is the delivery.

**Triggers:**
- Push to `master`
- Pull request targeting `master`

**Job: `verify`**

Runs on `ubuntu-latest`, Node 20, single job, no matrix. Steps:

1. **Checkout** — `actions/checkout@v4`
2. **Setup Node** — `actions/setup-node@v4` with `node-version: 20` and `cache: "npm"` (caches `~/.npm` keyed on `package-lock.json`)
3. **Install** — `npm ci` (strict lockfile install, faster and more reproducible than `npm install`)
4. **Lint** — `npm run lint`
5. **Type check** — `npx tsc --noEmit`
6. **Test** — `npm test`
7. **Build** — `npm run build`

**Environment variables for CI:**

The build step needs the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` variables at build time (Next.js inlines them into the client bundle). We expose them as GitHub Actions secrets:

```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
  ANTHROPIC_API_KEY: dummy-for-build
  GOOGLE_MAPS_API_KEY: dummy-for-build
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: dummy-for-build
```

Dummy values for the other keys are fine — none of them are read at build time (only at request time inside route handlers). Supabase URL/anon key are the only ones that must be real, because `@supabase/ssr` reads them during module load for the sign-in page's Server Component data fetch.

**Repository setup (one-time):**

1. GitHub repo → Settings → Secrets and variables → Actions → New repository secret
2. Add `NEXT_PUBLIC_SUPABASE_URL` with the project URL
3. Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the anon key
4. (Optional) Settings → Branches → Add rule for `master` → require the `verify` status check to pass before merging

**Why not matrix Node versions?** This is a single-deployment-target portfolio app — we ship on Vercel with a known Node version. Matrix testing would just slow CI down without catching real bugs.

**Why not deploy from CI?** Vercel's native GitHub integration already auto-deploys on push to `master` and creates preview deploys for PRs. Running `vercel deploy` from the workflow would duplicate that and require extra secrets.

## 12. Out-of-band prerequisites (the human must do these)

**Blocking for local dev (must happen before `npm run dev` works with the new code):**

1. **Create Supabase project** and get the project URL + anon key
2. **Run the `get_total_users` SQL** from Section 7.3 step 6 in the Supabase SQL Editor (enables the sign-in page counter)
3. **Add the two env vars** to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Blocking for actually signing in locally or in production:**

4. **Create Google OAuth client** in Google Cloud Console with Supabase's callback as the redirect URI
5. **Create GitHub OAuth app** with Supabase's callback as the authorization callback URL
6. **Paste both Client ID/secrets into Supabase** under Auth → Providers
7. **Set Supabase Site URL and Redirect URLs** to include both prod and localhost

**Blocking for production deploy and CI:**

8. **Add the two env vars to Vercel** (Settings → Environment Variables, scoped to Production + Preview + Development) and trigger a redeploy
9. **Add the two env vars as GitHub Actions secrets** (GitHub repo → Settings → Secrets and variables → Actions) so the CI build can succeed

The implementation plan will assume steps 1–3 are done before any code runs, and will validate steps 4–9 via the manual smoke test after deployment.
