import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  getSupabaseUrlAndAnonKey: () => ({
    url: "https://abcdefg.supabase.co",
    anonKey: "test-anon",
  }),
}));

vi.mock("@/lib/offline", () => ({
  isOnline: vi.fn(() => true),
}));

import { isOnline } from "@/lib/offline";
import {
  AUTH_SESSION_BACKUP_KEY,
  clearAuthSessionBackup,
  clearUserInitiatedSignOut,
  isRetryableAuthNetworkError,
  markUserInitiatedSignOut,
  readAuthSessionBackup,
  readBestEffortAuthSession,
  readPersistedAuthSession,
  recoverAuthSessionAfterNull,
  supabaseAuthStorageKey,
  writeAuthSessionBackup,
} from "./persisted-auth-session";

function seedGoTrueSession(userId = "user-1") {
  localStorage.setItem(
    "sb-abcdefg-auth-token",
    JSON.stringify({
      access_token: "old",
      refresh_token: "r",
      user: { id: userId },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
    }),
  );
}

describe("persisted-auth-session", () => {
  afterEach(() => {
    localStorage.clear();
    clearUserInitiatedSignOut();
    vi.mocked(isOnline).mockReturnValue(true);
  });

  it("builds the supabase-js default storage key from the project URL", () => {
    expect(supabaseAuthStorageKey()).toBe("sb-abcdefg-auth-token");
  });

  it("reads a session object written under the auth storage key", () => {
    seedGoTrueSession();
    expect(readPersistedAuthSession()?.user?.id).toBe("user-1");
    expect(readPersistedAuthSession()?.refresh_token).toBe("r");
  });

  it("returns null when storage has no refresh token", () => {
    localStorage.setItem("sb-abcdefg-auth-token", JSON.stringify({ user: { id: "x" } }));
    expect(readPersistedAuthSession()).toBeNull();
  });

  it("falls back to the app backup when GoTrue storage was wiped", () => {
    writeAuthSessionBackup({
      access_token: "a",
      refresh_token: "backup-r",
      user: { id: "user-1" },
    } as never);
    expect(readPersistedAuthSession()).toBeNull();
    expect(readAuthSessionBackup()?.refresh_token).toBe("backup-r");
    expect(readBestEffortAuthSession()?.refresh_token).toBe("backup-r");
  });

  it("clears the backup on intentional logout", () => {
    writeAuthSessionBackup({
      access_token: "a",
      refresh_token: "r",
      user: { id: "user-1" },
    } as never);
    markUserInitiatedSignOut();
    expect(localStorage.getItem(AUTH_SESSION_BACKUP_KEY)).toBeNull();
  });

  it("treats network-ish auth errors as retryable and invalid refresh as not", () => {
    expect(isRetryableAuthNetworkError({ message: "Failed to fetch" })).toBe(true);
    expect(isRetryableAuthNetworkError({ message: "Network request failed" })).toBe(true);
    expect(isRetryableAuthNetworkError({ message: "Invalid Refresh Token: Refresh Token Not Found" })).toBe(
      false,
    );
  });

  it("recovers via refreshSession when the network works", async () => {
    seedGoTrueSession();
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
    expect(readAuthSessionBackup()?.access_token).toBe("new");
  });

  it("falls back to the persisted session when refresh fails with a network error (no setSession)", async () => {
    seedGoTrueSession();
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
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });

  it("returns the disk session immediately when offline without refreshing", async () => {
    vi.mocked(isOnline).mockReturnValue(false);
    seedGoTrueSession();
    const supabase = {
      auth: {
        refreshSession: vi.fn(),
        setSession: vi.fn(),
      },
    };
    const session = await recoverAuthSessionAfterNull(supabase as never);
    expect(session?.user?.id).toBe("user-1");
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
  });

  it("returns the disk session when refresh hangs past the recovery timeout", async () => {
    seedGoTrueSession();
    const supabase = {
      auth: {
        refreshSession: vi.fn(() => new Promise(() => {})),
        setSession: vi.fn(() => new Promise(() => {})),
      },
    };
    const session = await recoverAuthSessionAfterNull(supabase as never);
    expect(session?.user?.id).toBe("user-1");
  }, 10_000);

  it("does not revive a session after an intentional logout", async () => {
    seedGoTrueSession();
    markUserInitiatedSignOut();
    const supabase = {
      auth: {
        refreshSession: vi.fn(async () => ({
          data: {
            session: {
              access_token: "new",
              refresh_token: "r2",
              user: { id: "user-1" },
            },
          },
          error: null,
        })),
        setSession: vi.fn(),
      },
    };
    expect(await recoverAuthSessionAfterNull(supabase as never)).toBeNull();
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
  });

  it("clears backup when the refresh token is truly invalid", async () => {
    seedGoTrueSession();
    writeAuthSessionBackup({
      access_token: "old",
      refresh_token: "r",
      user: { id: "user-1" },
    } as never);
    const supabase = {
      auth: {
        refreshSession: vi.fn(async () => ({
          data: { session: null },
          error: { message: "Invalid Refresh Token: Refresh Token Not Found", status: 400 },
        })),
        setSession: vi.fn(),
      },
    };
    expect(await recoverAuthSessionAfterNull(supabase as never)).toBeNull();
    expect(readAuthSessionBackup()).toBeNull();
  });
});
