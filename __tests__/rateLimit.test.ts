/**
 * Mock @upstash/ratelimit and @upstash/redis BEFORE importing the module
 * under test — rateLimit.ts reads the env vars at module load and constructs
 * the limiter eagerly.
 */

const mockLimit = jest.fn();

jest.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    jest.fn().mockImplementation(() => ({ limit: mockLimit })),
    { slidingWindow: jest.fn(() => "sliding-window-stub") }
  ),
}));

jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({})),
}));

describe("ipFromRequest", () => {
  // Import lazily so each describe can reset mocks if needed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ipFromRequest } = require("@/lib/rateLimit");

  it("uses the first x-forwarded-for entry", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(ipFromRequest(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = new Request("http://x", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(ipFromRequest(req)).toBe("9.9.9.9");
  });

  it("returns 'unknown' when no forwarding headers are present", () => {
    const req = new Request("http://x");
    expect(ipFromRequest(req)).toBe("unknown");
  });
});

describe("checkRateLimit — env vars missing", () => {
  const ORIGINAL_ENV = process.env;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    warnSpy.mockRestore();
  });

  it("returns ok:true and warns exactly once across multiple calls", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { checkRateLimit } = require("@/lib/rateLimit");
    const a = await checkRateLimit("1.2.3.4");
    const b = await checkRateLimit("1.2.3.4");
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("checkRateLimit — env vars set", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    mockLimit.mockReset();
    process.env = {
      ...ORIGINAL_ENV,
      UPSTASH_REDIS_REST_URL: "https://fake.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "fake-token",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns ok:true with remaining on allow", async () => {
    const resetAt = Date.now() + 60_000;
    mockLimit.mockResolvedValueOnce({ success: true, remaining: 5, reset: resetAt });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { checkRateLimit } = require("@/lib/rateLimit");
    const result = await checkRateLimit("1.2.3.4");
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(5);
  });

  it("returns ok:false with remaining and resetAt on deny", async () => {
    const resetAt = Date.now() + 1_800_000;
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0, reset: resetAt });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { checkRateLimit } = require("@/lib/rateLimit");
    const result = await checkRateLimit("1.2.3.4");
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBe(resetAt);
  });
});

describe("checkRateLimit — resetAt in denial response", () => {
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
});
