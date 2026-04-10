/**
 * @jest-environment node
 */
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
