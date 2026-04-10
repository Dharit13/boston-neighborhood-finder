/** @jest-environment node */

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
    mockCreateClient.mockResolvedValue(
      buildClient(() => Promise.resolve({ data: 42, error: null }))
    );
    expect(await getTotalUserCount()).toBe(42);
  });

  it("returns null when RPC errors", async () => {
    mockCreateClient.mockResolvedValue(
      buildClient(() =>
        Promise.resolve({ data: null, error: new Error("boom") })
      )
    );
    expect(await getTotalUserCount()).toBeNull();
  });

  it("returns null when RPC throws", async () => {
    mockCreateClient.mockResolvedValue(
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
