import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  getSupabaseUrlAndAnonKey: () => ({
    url: "https://abcdefg.supabase.co",
    anonKey: "test-anon",
  }),
}));

import {
  isRetryableAuthNetworkError,
  readPersistedAuthSession,
  recoverAuthSessionAfterNull,
  supabaseAuthStorageKey,
} from "./persisted-auth-session";

describe("persisted-auth-session", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("builds the supabase-js default storage key from the project URL", () => {
    expect(supabaseAuthStorageKey()).toBe("sb-abcdefg-auth-token");
  });

  it("reads a session object written under the auth storage key", () => {
    localStorage.setItem(
      "sb-abcdefg-auth-token",
      JSON.stringify({
        access_token: "a",
        refresh_token: "r",
        user: { id: "user-1", email: "a@b.com" },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
      }),
    );
    expect(readPersistedAuthSession()?.user?.id).toBe("user-1");
    expect(readPersistedAuthSession()?.refresh_token).toBe("r");
  });

  it("returns null when storage has no refresh token", () => {
    localStorage.setItem("sb-abcdefg-auth-token", JSON.stringify({ user: { id: "x" } }));
    expect(readPersistedAuthSession()).toBeNull();
  });

  it("treats network-ish auth errors as retryable and invalid refresh as not", () => {
    expect(isRetryableAuthNetworkError({ message: "Failed to fetch" })).toBe(true);
    expect(isRetryableAuthNetworkError({ message: "Network request failed" })).toBe(true);
    expect(isRetryableAuthNetworkError({ message: "Invalid Refresh Token: Refresh Token Not Found" })).toBe(
      false,
    );
  });

  it("recovers via refreshSession when the network works", async () => {
    localStorage.setItem(
      "sb-abcdefg-auth-token",
      JSON.stringify({
        access_token: "old",
        refresh_token: "r",
        user: { id: "user-1" },
      }),
    );
    const refreshed = {
      access_token: "new",
      refresh_token: "r2",
      user: { id: "user-1" },
    };
    const supabase = {
      auth: {
        refreshSession: vi.fn(async () => ({ data: { session: refreshed }, error: null })),
        setSession: vi.fn(),
      },
    };
    const session = await recoverAuthSessionAfterNull(supabase as never);
    expect(session?.access_token).toBe("new");
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });

  it("falls back to the persisted session when refresh fails with a network error", async () => {
    localStorage.setItem(
      "sb-abcdefg-auth-token",
      JSON.stringify({
        access_token: "old",
        refresh_token: "r",
        user: { id: "user-1" },
      }),
    );
    const supabase = {
      auth: {
        refreshSession: vi.fn(async () => ({
          data: { session: null },
          error: { message: "Failed to fetch", status: 0 },
        })),
        setSession: vi.fn(async () => ({ data: { session: null }, error: { message: "Failed to fetch" } })),
      },
    };
    const session = await recoverAuthSessionAfterNull(supabase as never);
    expect(session?.user?.id).toBe("user-1");
    expect(session?.refresh_token).toBe("r");
  });
});
