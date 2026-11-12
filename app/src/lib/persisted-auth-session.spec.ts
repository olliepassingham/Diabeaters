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

vi.mock("@/observability/sentry", () => ({
  captureAuthSessionLoss: vi.fn(),
}));

vi.mock("@/lib/native-auth-storage", () => ({
  AUTH_SESSION_BACKUP_KEY: "diabeater_auth_session_backup",
  mirrorAuthBackupToNative: vi.fn(async () => {}),
}));

import { isOnline } from "@/lib/offline";
import { mirrorAuthBackupToNative } from "@/lib/native-auth-storage";
import { captureAuthSessionLoss } from "@/observability/sentry";
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
  reportIfSessionStorageMissing,
  resetAuthSessionLossReportsForTests,
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
    resetAuthSessionLossReportsForTests();
    vi.mocked(isOnline).mockReturnValue(true);
    vi.mocked(captureAuthSessionLoss).mockClear();
    vi.mocked(mirrorAuthBackupToNative).mockClear();
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

  it("shares one refresh between simultaneous recovery calls", async () => {
    seedGoTrueSession();
    let resolveRefresh: (v: unknown) => void = () => {};
    const supabase = {
      auth: {
        refreshSession: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveRefresh = resolve;
            }),
        ),
        setSession: vi.fn(),
      },
    };
    const a = recoverAuthSessionAfterNull(supabase as never);
    const b = recoverAuthSessionAfterNull(supabase as never);
    const c = recoverAuthSessionAfterNull(supabase as never);
    resolveRefresh({
      data: { session: { access_token: "new", refresh_token: "r2", user: { id: "user-1" } } },
      error: null,
    });
    const results = await Promise.all([a, b, c]);
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(results.map((s) => s?.refresh_token)).toEqual(["r2", "r2", "r2"]);
  });

  it("starts a fresh refresh once the previous one has finished, using the newest token", async () => {
    seedGoTrueSession();
    const supabase = {
      auth: {
        refreshSession: vi.fn(async ({ refresh_token }: { refresh_token: string }) => ({
          data: { session: { access_token: "a", refresh_token: `${refresh_token}+`, user: { id: "user-1" } } },
          error: null,
        })),
        setSession: vi.fn(),
      },
    };
    await recoverAuthSessionAfterNull(supabase as never);
    localStorage.removeItem("sb-abcdefg-auth-token");
    await recoverAuthSessionAfterNull(supabase as never);
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(2);
    expect(supabase.auth.refreshSession.mock.calls[1]?.[0]).toEqual({ refresh_token: "r+" });
  });

  it("reports a rejected refresh with its error code, once per launch", async () => {
    const reject = {
      auth: {
        refreshSession: vi.fn(async () => ({
          data: { session: null },
          error: { message: "Invalid Refresh Token: Already Used", status: 400, code: "refresh_token_already_used" },
        })),
        setSession: vi.fn(),
      },
    };
    seedGoTrueSession();
    await recoverAuthSessionAfterNull(reject as never);
    seedGoTrueSession();
    await recoverAuthSessionAfterNull(reject as never);
    expect(captureAuthSessionLoss).toHaveBeenCalledTimes(1);
    expect(captureAuthSessionLoss).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "refresh_rejected", code: "refresh_token_already_used", status: 400 }),
    );
  });

  it("does not report a network failure as a lost session", async () => {
    seedGoTrueSession();
    const supabase = {
      auth: {
        refreshSession: vi.fn(async () => ({ data: { session: null }, error: { message: "Failed to fetch", status: 0 } })),
        setSession: vi.fn(),
      },
    };
    await recoverAuthSessionAfterNull(supabase as never);
    expect(captureAuthSessionLoss).not.toHaveBeenCalled();
  });

  it("reports storage_missing when a previous user never signed out", () => {
    localStorage.setItem("diabeater_last_local_user_id", "user-1");
    reportIfSessionStorageMissing();
    expect(captureAuthSessionLoss).toHaveBeenCalledWith(expect.objectContaining({ reason: "storage_missing" }));
  });

  it("does not report storage_missing after an intentional sign-out or on a fresh install", () => {
    reportIfSessionStorageMissing();
    localStorage.setItem("diabeater_last_local_user_id", "user-1");
    markUserInitiatedSignOut();
    reportIfSessionStorageMissing();
    expect(captureAuthSessionLoss).not.toHaveBeenCalled();
  });

  it("signing in again clears the intentional sign-out marker", () => {
    localStorage.setItem("diabeater_last_local_user_id", "user-1");
    markUserInitiatedSignOut();
    writeAuthSessionBackup({ access_token: "a", refresh_token: "r", user: { id: "user-1" } } as never);
    localStorage.removeItem(AUTH_SESSION_BACKUP_KEY);
    reportIfSessionStorageMissing();
    expect(captureAuthSessionLoss).toHaveBeenCalledTimes(1);
  });

  it("mirrors backup writes and clears to native storage", () => {
    const session = { access_token: "a", refresh_token: "r", user: { id: "user-1" } };
    writeAuthSessionBackup(session as never);
    expect(mirrorAuthBackupToNative).toHaveBeenLastCalledWith(JSON.stringify(session));
    clearAuthSessionBackup();
    expect(mirrorAuthBackupToNative).toHaveBeenLastCalledWith(null);
    writeAuthSessionBackup(session as never);
    markUserInitiatedSignOut();
    expect(mirrorAuthBackupToNative).toHaveBeenLastCalledWith(null);
  });
});
