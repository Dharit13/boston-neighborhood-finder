# Supabase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the entire Boston Neighborhood Finder behind Supabase Auth (Google + GitHub OAuth), with per-user rate limiting on AI routes, a public user counter on `/sign-in`, and GitHub Actions CI — implementing the design in [docs/superpowers/specs/2026-04-10-supabase-auth-design.md](../specs/2026-04-10-supabase-auth-design.md).

**Architecture:** Next.js middleware enforces auth for every request; `@supabase/ssr` manages cookie-based sessions. API routes check `requireUser()` and return 401 JSON on failure. The three AI routes additionally rate-limit on `user.id` (20/hr shared). The sign-in page reads a total user count via a `SECURITY DEFINER` Postgres function. CI runs lint + typecheck + test + build on every push.

**Tech Stack:** `@supabase/ssr`, `@supabase/supabase-js`, Next.js 16 App Router middleware, Jest for unit tests, GitHub Actions for CI.

---

## Prerequisites (the human does these before Task 1)

These are blocking for any task after Task 1. Confirm they're done:

1. **Supabase project created** at https://supabase.com
2. **SQL migration run** (copy the SQL from Section 7.3 step 6 of the spec into Supabase SQL Editor and execute — creates `public.get_total_users()`)
3. **`.env.local` has** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` filled in with real values from Settings → API

Google/GitHub OAuth + Vercel/GitHub Actions secrets can wait until closer to deploy (Tasks 11–12).

---

## Task 1: Install Supabase, create client factories, update env example

**Files:**
- Modify: `package.json` (new deps)
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.ts`
- Modify: `.env.local.example`

- [ ] **Step 1: Install Supabase packages**

Run: `npm install @supabase/ssr @supabase/supabase-js`

Expected: two new entries in `package.json` dependencies, `package-lock.json` updated, `found 0 vulnerabilities`.

- [ ] **Step 2: Create the server-side client factory**

Create `lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

/**
 * Server-side Supabase client factory. Works in Server Components, Route
 * Handlers, and Middleware. Writing cookies is only legal in Route Handlers
 * and Server Actions — when called from a Server Component, the setAll
 * call will throw and we silently no-op (middleware will refresh on the
 * next request).
 */
export async function createClient() {
  // Next.js 16: cookies() returns a Promise<ReadonlyRequestCookies>.
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component cannot set cookies — ignore.
          }
        },
      },
    }
  );
}

/**
 * Convenience wrapper: returns the authenticated user or null.
 * Use getUser() (not getSession()) because getUser() verifies the JWT
 * with the Supabase auth server — getSession() reads the cookie without
 * verifying, which is a security hole.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
```

- [ ] **Step 3: Create the browser-side client factory**

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client factory. Use in Client Components that
 * need to call auth methods (signInWithOAuth, signOut). Session cookie
 * is httpOnly and set by the server; the browser client reads session
 * state via the Supabase endpoint, not via direct cookie access.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Update `.env.local.example`**

Append to `.env.local.example`:

```
# Supabase Auth credentials for the sign-in gate and user-count RPC.
# https://supabase.com → your project → Settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/supabase/server.ts lib/supabase/client.ts .env.local.example
git commit -m "feat(auth): add Supabase client factories and env placeholders"
```

---

## Task 2: Update rate limiter for per-user keying

**Files:**
- Modify: `lib/rateLimit.ts`
- Modify: `__tests__/rateLimit.test.ts`

Do this before touching the API routes — once the signature changes, the AI routes will need the new shape.

- [ ] **Step 1: Read current rate limiter and existing test**

Read `lib/rateLimit.ts` and `__tests__/rateLimit.test.ts` to confirm current shape. Note the current parameter name, return type, and limit/window configuration.

- [ ] **Step 2: Write the failing test for `resetAt` in denial response**

Edit `__tests__/rateLimit.test.ts` — add a new test (keep existing tests intact):

```ts
it("returns resetAt in the denial response when the bucket is exhausted", async () => {
  // Mock @upstash/ratelimit to return a denial with a known reset time
  jest.resetModules();
  const mockReset = Date.now() + 3_600_000;
  jest.doMock("@upstash/ratelimit", () => ({
    Ratelimit: class {
      static slidingWindow() {
        return {};
      }
      async limit() {
        return { success: false, limit: 20, remaining: 0, reset: mockReset };
      }
    },
  }));
  jest.doMock("@upstash/redis", () => ({
    Redis: class {
      static fromEnv() {
        return {};
      }
    },
  }));
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

  const { checkRateLimit } = await import("@/lib/rateLimit");
  const result = await checkRateLimit("user-abc");

  expect(result.ok).toBe(false);
  expect(result.resetAt).toBe(mockReset);
});
```

- [ ] **Step 3: Run the test — expect it to fail**

Run: `npm test -- rateLimit`
Expected: the new test fails because the current code either doesn't return `resetAt` or uses a different return shape. Existing tests still pass.

- [ ] **Step 4: Update `lib/rateLimit.ts`**

Read the file first to get the current exact shape. Then apply these changes:

- Rename the parameter `ip` → `identifier` in the exported function signature
- Bump the sliding window from 10 → 20 requests per 1 hour
- Update the Upstash prefix string from whatever it currently is to `"ai-user-20-1h"`
- Change the return type to include `resetAt?: number`
- Populate `resetAt` from the Upstash `reset` field in the denial branch

Resulting `checkRateLimit` shape:

```ts
export interface RateLimitResult {
  ok: boolean;
  remaining?: number;
  resetAt?: number;
}

export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  if (!ratelimit) {
    return { ok: true };
  }
  const { success, remaining, reset } = await ratelimit.limit(identifier);
  if (!success) {
    return { ok: false, remaining, resetAt: reset };
  }
  return { ok: true, remaining };
}
```

Keep the dev-fallback branch (`!ratelimit` → `{ ok: true }`) unchanged. Keep the `Ratelimit.slidingWindow(20, "1 h")` configuration with `prefix: "ai-user-20-1h"`.

- [ ] **Step 5: Run the new test — expect it to pass**

Run: `npm test -- rateLimit`
Expected: all rateLimit tests pass (new + existing).

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: 79 passed (or whatever the new total is — 1 new test added to the existing 78). No regressions.

- [ ] **Step 7: Commit**

```bash
git add lib/rateLimit.ts __tests__/rateLimit.test.ts
git commit -m "feat(rate-limit): key on identifier, bump to 20/hr, expose resetAt"
```

---

## Task 3: Create `requireUser()` helper with unit tests

**Files:**
- Create: `lib/auth.ts`
- Create: `__tests__/auth.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `__tests__/auth.test.ts`:

```ts
import { NextResponse } from "next/server";

jest.mock("@/lib/supabase/server", () => ({
  getUser: jest.fn(),
}));

import { getUser } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;

describe("requireUser", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  it("returns the user and null response when a session exists", async () => {
    const fakeUser = { id: "user-abc", email: "t@example.com" } as Awaited<
      ReturnType<typeof getUser>
    >;
    mockGetUser.mockResolvedValue(fakeUser);

    const result = await requireUser();

    expect(result.user).toEqual(fakeUser);
    expect(result.response).toBeNull();
  });

  it("returns null user and a 401 NextResponse when no session exists", async () => {
    mockGetUser.mockResolvedValue(null);

    const result = await requireUser();

    expect(result.user).toBeNull();
    expect(result.response).toBeInstanceOf(NextResponse);
    expect(result.response?.status).toBe(401);

    const body = await result.response?.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

Run: `npm test -- auth`
Expected: fails because `lib/auth.ts` doesn't exist yet. Error message mentions "Cannot find module '@/lib/auth'".

- [ ] **Step 3: Create `lib/auth.ts`**

```ts
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getUser } from "@/lib/supabase/server";

export type RequireUserResult =
  | { user: User; response: null }
  | { user: null; response: NextResponse };

/**
 * API-route guard. Returns the authenticated user or a ready-to-return
 * 401 NextResponse. Usage:
 *
 *   const { user, response } = await requireUser();
 *   if (!user) return response;
 */
export async function requireUser(): Promise<RequireUserResult> {
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

- [ ] **Step 4: Run the test — expect it to pass**

Run: `npm test -- auth`
Expected: both tests pass.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass (old + new `auth.test.ts`).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/auth.ts __tests__/auth.test.ts
git commit -m "feat(auth): add requireUser guard helper with unit tests"
```

---

## Task 4: Create the middleware enforcement layer

**Files:**
- Create: `middleware.ts` (project root)

Middleware is hard to unit test in Jest (it runs in the Next.js edge runtime). We rely on the per-pathname decision logic being simple and test it via manual smoke testing.

- [ ] **Step 1: Create `middleware.ts` at the project root**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js middleware — enforces the auth gate on every request.
 *
 * Decision tree (order matters):
 *   1. Path starts with /api/         → refresh cookie, pass through (route handles 401)
 *   2. Path is /auth/callback          → always allow
 *   3. Path is /sign-in                → redirect to / if authed, else allow
 *   4. Any other path                  → redirect to /sign-in?next=<path> if unauthed, else allow
 *
 * We must call supabase.auth.getUser() on every request to refresh the
 * session cookie; without it, sessions expire silently.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create a mutable response we can attach cookie updates to.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. API routes: never redirect — return response with cookie refresh only.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  // 2. OAuth callback: always allow.
  if (pathname === "/auth/callback") {
    return response;
  }

  // 3. Sign-in page: redirect authenticated users to /.
  if (pathname === "/sign-in") {
    if (user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  // 4. Everything else: require auth.
  if (!user) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Run middleware on everything except Next.js internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): add Next.js middleware with full-gate redirect logic"
```

---

## Task 5: Create `/auth/callback` route handler

**Files:**
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Create the callback route**

Create `app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth return URL. Supabase redirects here after Google/GitHub consent
 * with ?code=<authorization_code>&next=<optional_return_path>.
 *
 * We exchange the code for a session (Supabase sets the cookie) and
 * redirect to `next` — validated to be a same-origin relative path to
 * prevent open-redirect attacks.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Open-redirect protection: only allow relative same-origin paths.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(
      new URL("/sign-in?error=missing_code", origin)
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/sign-in?error=oauth_failed", origin)
    );
  }

  return NextResponse.redirect(new URL(safeNext, origin));
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat(auth): add /auth/callback route for OAuth code exchange"
```

---

## Task 6: Create the user-count migration and helper

**Files:**
- Create: `supabase/migrations/001_get_total_users.sql`
- Create: `lib/userCount.ts`
- Create: `__tests__/userCount.test.ts`

- [ ] **Step 1: Create the SQL migration file**

Create `supabase/migrations/001_get_total_users.sql`:

```sql
-- Enables the public user-count display on the sign-in page.
--
-- SECURITY DEFINER lets the function read auth.users (which the anon role
-- cannot access directly). Only the scalar count is returned — no rows,
-- emails, or IDs leak. This is the standard Supabase pattern for exposing
-- safe aggregate stats to unauthenticated clients.

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

Note: this file is for reference + committing to the repo; the SQL must be run manually in Supabase SQL Editor (the prerequisite step).

- [ ] **Step 2: Write failing tests for the helper**

Create `__tests__/userCount.test.ts`:

```ts
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getTotalUserCount, renderUserCountLabel } from "@/lib/userCount";

type MockClient = {
  rpc: jest.Mock;
};

const mockCreateClient = createClient as unknown as jest.Mock;

function buildClient(rpcImpl: () => Promise<{ data: number | null; error: unknown }>): MockClient {
  return { rpc: jest.fn(rpcImpl) };
}

describe("getTotalUserCount", () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });

  it("returns the count when RPC succeeds", async () => {
    mockCreateClient.mockReturnValue(
      buildClient(() => Promise.resolve({ data: 42, error: null }))
    );
    expect(await getTotalUserCount()).toBe(42);
  });

  it("returns null when RPC errors", async () => {
    mockCreateClient.mockReturnValue(
      buildClient(() =>
        Promise.resolve({ data: null, error: new Error("boom") })
      )
    );
    expect(await getTotalUserCount()).toBeNull();
  });

  it("returns null when RPC throws", async () => {
    mockCreateClient.mockReturnValue(
      buildClient(() => Promise.reject(new Error("network")))
    );
    expect(await getTotalUserCount()).toBeNull();
  });
});

describe("renderUserCountLabel", () => {
  it("returns null for null, 0, and negative counts", () => {
    expect(renderUserCountLabel(null)).toBeNull();
    expect(renderUserCountLabel(0)).toBeNull();
    expect(renderUserCountLabel(-1)).toBeNull();
  });

  it("uses singular wording for exactly 1 user", () => {
    expect(renderUserCountLabel(1)).toBe(
      "Be the second to find your neighborhood"
    );
  });

  it("uses plural wording for 2+ users", () => {
    expect(renderUserCountLabel(2)).toBe(
      "Join 2 others finding their neighborhood"
    );
    expect(renderUserCountLabel(42)).toBe(
      "Join 42 others finding their neighborhood"
    );
  });
});
```

- [ ] **Step 3: Run tests — expect failure**

Run: `npm test -- userCount`
Expected: fails because `lib/userCount.ts` doesn't exist.

- [ ] **Step 4: Create `lib/userCount.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

/**
 * Fetch the total number of registered users via the `get_total_users`
 * SECURITY DEFINER function. Returns null on any error (RPC failure,
 * network failure, or missing migration) so the caller can degrade
 * gracefully — we never surface auth errors to the user.
 */
export async function getTotalUserCount(): Promise<number | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_total_users");
    if (error || typeof data !== "number") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Apply the 0/1/2+ rendering rules from the spec. Returns the rendered
 * string, or null if the counter should be hidden entirely.
 */
export function renderUserCountLabel(count: number | null): string | null {
  if (count === null || count <= 0) return null;
  if (count === 1) return "Be the second to find your neighborhood";
  return `Join ${count} others finding their neighborhood`;
}
```

- [ ] **Step 5: Run tests — expect pass**

Run: `npm test -- userCount`
Expected: all 6 assertions pass.

- [ ] **Step 6: Run the full suite**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/001_get_total_users.sql lib/userCount.ts __tests__/userCount.test.ts
git commit -m "feat(auth): add get_total_users RPC migration and Next.js helper"
```

---

## Task 7: Build the `/sign-in` page with buttons and counter

**Files:**
- Create: `app/sign-in/page.tsx`
- Create: `app/sign-in/SignInButtons.tsx`
- Create: `app/sign-in/UserCount.tsx`

- [ ] **Step 1: Create the `UserCount` presentational component**

Create `app/sign-in/UserCount.tsx`:

```tsx
import { renderUserCountLabel } from "@/lib/userCount";

export default function UserCount({ count }: { count: number | null }) {
  const label = renderUserCountLabel(count);
  if (!label) return null;
  return (
    <p className="text-xs text-white/50 text-center mt-6">{label}</p>
  );
}
```

- [ ] **Step 2: Create the `SignInButtons` Client Component**

Create `app/sign-in/SignInButtons.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "github";

export default function SignInButtons() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [loading, setLoading] = useState<Provider | null>(null);

  const signIn = async (provider: Provider) => {
    setLoading(provider);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setLoading(null);
      window.location.href = "/sign-in?error=oauth_failed";
    }
    // On success, the browser is redirecting — no need to clear loading.
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => signIn("google")}
        disabled={loading !== null}
        className="w-full px-5 py-3 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {loading === "google" ? "Redirecting…" : "Continue with Google"}
      </button>
      <button
        onClick={() => signIn("github")}
        disabled={loading !== null}
        className="w-full px-5 py-3 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-white/15 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create the sign-in page Server Component**

Create `app/sign-in/page.tsx`:

```tsx
import { Suspense } from "react";
import SignInButtons from "./SignInButtons";
import UserCount from "./UserCount";
import { getTotalUserCount } from "@/lib/userCount";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Sign-in cancelled.",
  oauth_failed: "Couldn't complete sign-in. Please try again.",
  missing_code: "Sign-in link was invalid. Please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? null : null;
  const count = await getTotalUserCount();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.aiscribbles.com/34fe5695dbc942628e3cad9744e8ae13.png?v=60d084"
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-70"
      />

      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Boston Neighbourhood Finder
            </h1>
            <p className="text-white/70 text-sm mt-2">Sign in to get started</p>
          </div>

          {errorMessage && (
            <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs text-center">
              {errorMessage}
            </div>
          )}

          <Suspense fallback={<div className="h-24" />}>
            <SignInButtons />
          </Suspense>

          <UserCount count={count} />

          <p className="text-[11px] text-white/40 text-center mt-6 leading-relaxed">
            We use your account only to prevent abuse of AI features.
            No profile data is stored.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/sign-in/page.tsx app/sign-in/SignInButtons.tsx app/sign-in/UserCount.tsx
git commit -m "feat(auth): add /sign-in page with OAuth buttons and user counter"
```

---

## Task 8: Build `UserMenu` and wire it into the root layout

**Files:**
- Create: `components/UserMenu.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create the `UserMenu` Client Component**

Create `components/UserMenu.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  email: string;
  avatarUrl: string | null;
}

export default function UserMenu({ email, avatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  const initial = email.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm text-white text-xs font-semibold overflow-hidden hover:bg-white/20 transition-all"
        aria-label="User menu"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-[11px] text-white/50">Signed in as</p>
            <p className="text-sm text-white truncate">{email}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Read current `app/layout.tsx`**

Read the file to understand its current shape (fonts, metadata, body structure) so the modification is minimal.

- [ ] **Step 3: Modify `app/layout.tsx` to mount `UserMenu`**

Add imports at the top:

```ts
import { headers } from "next/headers";
import { getUser } from "@/lib/supabase/server";
import UserMenu from "@/components/UserMenu";
```

Convert the default export to `async` (if it isn't already) and inside the function body, before the JSX return:

```ts
const user = await getUser();
const headerList = await headers();
const pathname = headerList.get("x-pathname") ?? "";
const hideMenu = pathname === "/sign-in" || pathname === "/auth/callback";
```

Inside the `<body>` JSX, conditionally render the menu:

```tsx
{user && !hideMenu && (
  <UserMenu
    email={user.email ?? ""}
    avatarUrl={(user.user_metadata?.avatar_url as string | undefined) ?? null}
  />
)}
```

Note: the `x-pathname` header trick requires the proxy to set it, since Next.js layouts don't receive pathname directly. Add this to `proxy.ts` inside the response creation, right before each `return response`:

```ts
response.headers.set("x-pathname", pathname);
```

Go back to `proxy.ts` (Next.js 16 renamed middleware to proxy — file is at project root) and add the header set. Simplest place: set it on `response` once right after it's created/re-created, before returning. Update the proxy file to set `response.headers.set("x-pathname", pathname)` on every return path that returns `response` (not the redirect branches — those don't render the layout anyway). Also set it on the `NextResponse.next({ request: { headers } })` call so Server Components can read it via `headers()`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If any — fix by adjusting the `user_metadata` access or the `headers()` await.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/UserMenu.tsx app/layout.tsx proxy.ts
git commit -m "feat(auth): add UserMenu dropdown and mount in root layout"
```

---

## Task 9: Protect all six API routes

**Files:**
- Modify: `app/api/commute/route.ts`
- Modify: `app/api/news/route.ts`
- Modify: `app/api/mbta-alerts/route.ts`
- Modify: `app/api/ai-summary/route.ts`
- Modify: `app/api/ai-overview/route.ts`
- Modify: `app/api/chat/route.ts`

For each route, prepend the `requireUser()` guard. For the three AI routes, additionally swap IP-based rate limiting for user-id-based rate limiting.

- [ ] **Step 1: Modify `/api/commute/route.ts`**

Read the file first. At the top of the handler (POST or GET), right after the function signature, add:

```ts
const { user, response } = await requireUser();
if (!user) return response;
```

Add the import at the top:

```ts
import { requireUser } from "@/lib/auth";
```

- [ ] **Step 2: Modify `/api/news/route.ts`**

Same pattern as Step 1.

- [ ] **Step 3: Modify `/api/mbta-alerts/route.ts`**

Same pattern as Step 1.

- [ ] **Step 4: Modify `/api/ai-summary/route.ts`**

Read the file first. Add the `requireUser` guard, AND replace the existing IP-based rate-limit call with:

```ts
const rl = await checkRateLimit(user.id);
if (!rl.ok) {
  return NextResponse.json(
    { error: "Rate limit exceeded", resetAt: rl.resetAt },
    { status: 429 }
  );
}
```

Delete the old IP extraction lines (the ones that read `x-forwarded-for` / `x-real-ip`).

Imports needed:

```ts
import { requireUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
```

- [ ] **Step 5: Modify `/api/ai-overview/route.ts`**

Same pattern as Step 4.

- [ ] **Step 6: Modify `/api/chat/route.ts`**

Same pattern as Step 4 — with the note that the 401/429 return a JSON response (not an SSE envelope) because they happen before the stream starts. The current `ChatPanel` fetch code already handles both HTTP 200 (SSE body) and HTTP 4xx (JSON body), so no change is needed there.

- [ ] **Step 7: Run tests and type-check**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass. The existing tests don't exercise HTTP handlers directly, so they continue to pass as-is.

- [ ] **Step 8: Commit**

```bash
git add app/api/commute/route.ts app/api/news/route.ts app/api/mbta-alerts/route.ts app/api/ai-summary/route.ts app/api/ai-overview/route.ts app/api/chat/route.ts
git commit -m "feat(auth): gate all API routes with requireUser; rate-limit AI routes on user.id"
```

---

## Task 10: Client-side 401 / 429 handling

**Files:**
- Modify: `components/results/ChatPanel.tsx`
- Modify: `components/results/RecommendationOverview.tsx`
- Modify: `components/results/NeighborhoodProfile.tsx`

- [ ] **Step 1: Create a shared helper**

Create `components/results/useAiErrorState.ts`:

```ts
"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";

export type AiErrorState =
  | { kind: "unauthorized" }
  | { kind: "rateLimited"; resetAt: number | null }
  | { kind: "other"; message: string }
  | null;

/**
 * Shared helper for the three AI-consuming client components. Call
 * handleResponse(res) with a fetch Response — returns true if OK and
 * the caller should continue, false if an error state was set.
 */
export function useAiErrorState() {
  const router = useRouter();
  const [error, setError] = useState<AiErrorState>(null);

  const handleResponse = useCallback(async (res: Response): Promise<boolean> => {
    if (res.ok) {
      setError(null);
      return true;
    }
    if (res.status === 401) {
      setError({ kind: "unauthorized" });
      return false;
    }
    if (res.status === 429) {
      try {
        const body = await res.clone().json();
        setError({
          kind: "rateLimited",
          resetAt: typeof body?.resetAt === "number" ? body.resetAt : null,
        });
      } catch {
        setError({ kind: "rateLimited", resetAt: null });
      }
      return false;
    }
    setError({ kind: "other", message: `Error ${res.status}` });
    return false;
  }, []);

  const reauth = useCallback(() => {
    const currentPath = window.location.pathname + window.location.search;
    router.push(`/sign-in?next=${encodeURIComponent(currentPath)}`);
  }, [router]);

  return { error, setError, handleResponse, reauth };
}

/**
 * Render a short human message for a given rate-limit reset timestamp.
 */
export function formatResetAt(resetAt: number | null): string {
  if (resetAt === null) return "Try again later.";
  const minutes = Math.max(1, Math.ceil((resetAt - Date.now()) / 60_000));
  return `Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
```

- [ ] **Step 2: Wire the helper into `ChatPanel.tsx`**

Read the file first. Find the fetch call to `/api/chat`. Replace the existing error handling with:

```tsx
const { error, handleResponse, reauth } = useAiErrorState();

// Inside the submit handler, after fetching:
const ok = await handleResponse(res);
if (!ok) return;
// …existing SSE consumer code continues…
```

Near the chat input, before the `<form>`, render the error banner:

```tsx
{error?.kind === "unauthorized" && (
  <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-200 text-xs rounded-lg mb-2">
    Your session expired.{" "}
    <button onClick={reauth} className="underline">Sign in again</button>
  </div>
)}
{error?.kind === "rateLimited" && (
  <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs rounded-lg mb-2">
    You&apos;ve used all 20 of your hourly AI requests. {formatResetAt(error.resetAt)}
  </div>
)}
```

Import at the top:

```ts
import { useAiErrorState, formatResetAt } from "./useAiErrorState";
```

- [ ] **Step 3: Wire the helper into `RecommendationOverview.tsx`**

Same pattern: import the helper, call `handleResponse` after the fetch to `/api/ai-overview`, render the same two banner variants where the card body would go (replace the card contents with the banner when `error` is set).

- [ ] **Step 4: Wire the helper into `NeighborhoodProfile.tsx`**

Same pattern for the `/api/ai-summary` fetch call. Banners render below the "Generate AI summary" button.

- [ ] **Step 5: Type-check, lint, test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add components/results/useAiErrorState.ts components/results/ChatPanel.tsx components/results/RecommendationOverview.tsx components/results/NeighborhoodProfile.tsx
git commit -m "feat(auth): handle 401/429 responses with inline banners and re-auth"
```

---

## Task 11: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npm test

      - name: Build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          ANTHROPIC_API_KEY: dummy-for-build
          GOOGLE_MAPS_API_KEY: dummy-for-build
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: dummy-for-build
        run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow (lint, typecheck, test, build)"
```

- [ ] **Step 3: Human action — set up GitHub secrets**

This is a manual step, not a code step. Tell the user:

> Before this commit lands on the remote, go to GitHub → repo → Settings → Secrets and variables → Actions → New repository secret, and add:
> - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
> - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
>
> Without these, the `Build` step will fail the first CI run.

---

## Task 12: Update documentation

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `DATA_SOURCES.md`
- Modify: `README.md`

- [ ] **Step 1: Update `ARCHITECTURE.md`**

Read the file. Add a new section titled "## Authentication" after the existing "Rate limiting" section. Content:

```markdown
## Authentication

All pages and API routes are gated behind Supabase Auth (Google + GitHub OAuth). Enforcement is a single [proxy.ts](./proxy.ts) at the project root (Next.js 16 renamed middleware to proxy):

- Unauth'd visits to any page → redirect to `/sign-in?next=<path>`
- Auth'd visits to `/sign-in` → redirect to `/`
- `/api/*` routes → never redirected; each route calls `requireUser()` from [lib/auth.ts](./lib/auth.ts) and returns 401 JSON on failure
- Every request refreshes the Supabase session cookie via `supabase.auth.getUser()`

The sign-in page at [app/sign-in/page.tsx](./app/sign-in/page.tsx) also renders a public user count by calling the `get_total_users` Postgres function (defined with `SECURITY DEFINER` so the anon role can read `auth.users` without the service role key).

The root layout at [app/layout.tsx](./app/layout.tsx) reads the current user server-side and mounts a [UserMenu](./components/UserMenu.tsx) dropdown in the top-right corner of every authenticated page.

See [DATA_SOURCES.md](./DATA_SOURCES.md) for the Supabase Auth entry and the spec at [docs/superpowers/specs/2026-04-10-supabase-auth-design.md](./docs/superpowers/specs/2026-04-10-supabase-auth-design.md) for the full design.
```

Also update the "API routes" table — add a "Auth required?" column and set every row to "Yes".

Also update the rate-limiting section to say "20 requests per hour per authenticated user" (was "10 per hour per IP").

- [ ] **Step 2: Update `DATA_SOURCES.md`**

Read the file. Add a new entry under "Live sources" section:

```markdown
### Supabase Auth

- **Endpoint:** `https://<project-ref>.supabase.co/auth/v1`
- **Used by:** [proxy.ts](./proxy.ts), [lib/supabase/server.ts](./lib/supabase/server.ts), [lib/supabase/client.ts](./lib/supabase/client.ts), [app/sign-in/page.tsx](./app/sign-in/page.tsx), [app/auth/callback/route.ts](./app/auth/callback/route.ts)
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Providers:** Google, GitHub (OAuth 2.0)
- **Attribution:** Not required (service)
- **Notes:** The app is fully gated behind sign-in. Rate limiting on AI routes is keyed on `user.id` (20 req/hour). Also provides a public user-count RPC (`get_total_users`) used for social proof on `/sign-in` — see the SQL migration at [supabase/migrations/001_get_total_users.sql](./supabase/migrations/001_get_total_users.sql).
```

Update the Quick Reference table at the top with a Supabase Auth row.

- [ ] **Step 3: Update `README.md`**

Add to the env vars table:

```
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase](https://supabase.com) | Project URL for auth gate | Free tier covers this |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same | Anon public key | — |
```

Update the rate-limiting copy anywhere it mentions "10 per IP" to "20 per user".

Update the Features list to mention:
- Full sign-in gate (Google / GitHub OAuth via Supabase)
- Per-user rate limiting on AI routes (20/hr)
- Public user counter on sign-in page

- [ ] **Step 4: Lint the markdown (sanity only)**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass (docs shouldn't affect any of these, but confirm nothing regressed).

- [ ] **Step 5: Commit**

```bash
git add ARCHITECTURE.md DATA_SOURCES.md README.md
git commit -m "docs: document Supabase auth, user counter, and CI pipeline"
```

---

## Final verification

After all 12 tasks are committed:

- [ ] **Full local verification**

Run:
```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
```

All five must succeed.

- [ ] **Push and watch CI**

```bash
git push origin master
```

Open https://github.com/Dharit13/boston-neighborhood-finder/actions and confirm the `CI / verify` workflow goes green.

- [ ] **Manual smoke test (deploy smoke test in the spec, Section 9)**

After Vercel auto-deploys the push, walk through the full checklist in Section 9 of the spec:

1. Cold visit to `/` → redirects to `/sign-in`
2. Cold visit to `/results` → redirects to `/sign-in?next=/results`
3. `/sign-in` shows the counter (or no counter if count < 2)
4. Sign in with Google → lands on wizard or results per `next`
5. Sign in with GitHub → same
6. Avatar menu shows email and sign-out
7. Sign out → redirects to `/sign-in`
8. Signed-in user on `/sign-in` → redirects to `/`
9. Chat/summary/overview features work end-to-end
10. 21st AI request in an hour → 429 with human-readable reset time
11. Manually expire session (clear cookies) → next AI fetch returns 401 → inline banner + re-sign-in works
12. GitHub Actions `verify` workflow runs green

---

## Out-of-band prereqs for production deploy

These are not code tasks but must be done before the deployed app actually works end-to-end:

1. **Create Google OAuth client** (Google Cloud Console → Credentials) with:
   - Authorized JavaScript origins: `https://boston-neighborhood-finder.vercel.app`, `http://localhost:3000`
   - Authorized redirect URI: `https://<supabase-project>.supabase.co/auth/v1/callback`
2. **Create GitHub OAuth App** (GitHub Settings → Developer settings → OAuth Apps) with:
   - Homepage URL: `https://boston-neighborhood-finder.vercel.app`
   - Authorization callback URL: `https://<supabase-project>.supabase.co/auth/v1/callback`
3. **Paste Client IDs and secrets** into Supabase → Auth → Providers
4. **Set Supabase Site URL and Redirect URLs**:
   - Site URL: `https://boston-neighborhood-finder.vercel.app`
   - Redirect URLs: `https://boston-neighborhood-finder.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`
5. **Add env vars to Vercel** (Project → Settings → Environment Variables) for both the Supabase URL and anon key
6. **Add env vars to GitHub Actions secrets** (repo → Settings → Secrets and variables → Actions)

See Section 12 of the spec for the exact step-by-step.
