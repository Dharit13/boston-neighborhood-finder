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

  it("forwards the identifier unchanged to the limiter", async () => {
    // Guards the per-user keying contract: API routes pass user.id here,
    // and a silent change to prefix/mangle the key would hide cross-user
    // bleed-over during a refactor.
    mockLimit.mockResolvedValueOnce({ success: true, remaining: 19, reset: 0 });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { checkRateLimit } = require("@/lib/rateLimit");
    await checkRateLimit("user-abc-123");
    expect(mockLimit).toHaveBeenCalledWith("user-abc-123");
  });
});
