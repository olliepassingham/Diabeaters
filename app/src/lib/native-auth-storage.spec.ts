import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prefs = new Map<string, string>();

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      prefs.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      prefs.delete(key);
    }),
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isPluginAvailable: vi.fn(() => true) },
}));

vi.mock("@/lib/native-platform", () => ({
  isCapacitorNativeShell: vi.fn(() => true),
}));

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { isCapacitorNativeShell } from "@/lib/native-platform";
import {
  AUTH_SESSION_BACKUP_KEY,
  clearNativeAuthBackup,
  hydrateAuthBackupFromNative,
  mirrorAuthBackupToNative,
  resetNativeAuthMirrorForTests,
} from "./native-auth-storage";

const sessionJson = JSON.stringify({ access_token: "a", refresh_token: "r", user: { id: "user-1" } });

describe("native-auth-storage", () => {
  beforeEach(() => {
    prefs.clear();
    localStorage.clear();
    resetNativeAuthMirrorForTests();
    vi.mocked(Capacitor.isPluginAvailable).mockReturnValue(true);
    vi.mocked(isCapacitorNativeShell).mockReturnValue(true);
  });

  afterEach(() => {
    vi.mocked(Preferences.get).mockClear();
    vi.mocked(Preferences.set).mockClear();
    vi.mocked(Preferences.remove).mockClear();
  });

  it("restores the session backup when web storage lost it", async () => {
    prefs.set(AUTH_SESSION_BACKUP_KEY, sessionJson);
    expect(await hydrateAuthBackupFromNative()).toBe(true);
    expect(localStorage.getItem(AUTH_SESSION_BACKUP_KEY)).toBe(sessionJson);
  });

  it("never overwrites a backup already in web storage", async () => {
    prefs.set(AUTH_SESSION_BACKUP_KEY, "stale");
    localStorage.setItem(AUTH_SESSION_BACKUP_KEY, sessionJson);
    expect(await hydrateAuthBackupFromNative()).toBe(false);
    expect(localStorage.getItem(AUTH_SESSION_BACKUP_KEY)).toBe(sessionJson);
    expect(Preferences.get).not.toHaveBeenCalled();
  });

  it("returns false when there is no native copy", async () => {
    expect(await hydrateAuthBackupFromNative()).toBe(false);
    expect(localStorage.getItem(AUTH_SESSION_BACKUP_KEY)).toBeNull();
  });

  it("gives up after the timeout instead of blocking start-up", async () => {
    vi.mocked(Preferences.get).mockImplementationOnce(() => new Promise(() => {}));
    expect(await hydrateAuthBackupFromNative(20)).toBe(false);
  });

  it("does nothing when the Preferences plugin is missing (older app builds)", async () => {
    vi.mocked(Capacitor.isPluginAvailable).mockReturnValue(false);
    prefs.set(AUTH_SESSION_BACKUP_KEY, sessionJson);
    expect(await hydrateAuthBackupFromNative()).toBe(false);
    await mirrorAuthBackupToNative("x");
    expect(Preferences.set).not.toHaveBeenCalled();
    expect(localStorage.getItem(AUTH_SESSION_BACKUP_KEY)).toBeNull();
  });

  it("does nothing on the web", async () => {
    vi.mocked(isCapacitorNativeShell).mockReturnValue(false);
    await mirrorAuthBackupToNative(sessionJson);
    expect(Preferences.set).not.toHaveBeenCalled();
  });

  it("mirrors writes and skips unchanged ones", async () => {
    await mirrorAuthBackupToNative(sessionJson);
    await mirrorAuthBackupToNative(sessionJson);
    expect(Preferences.set).toHaveBeenCalledTimes(1);
    expect(prefs.get(AUTH_SESSION_BACKUP_KEY)).toBe(sessionJson);
  });

  it("clears the native copy on sign-out, even if a clear is already in flight", async () => {
    await mirrorAuthBackupToNative(sessionJson);
    void mirrorAuthBackupToNative(null);
    await clearNativeAuthBackup();
    expect(prefs.has(AUTH_SESSION_BACKUP_KEY)).toBe(false);
    expect(await hydrateAuthBackupFromNative()).toBe(false);
  });
});
