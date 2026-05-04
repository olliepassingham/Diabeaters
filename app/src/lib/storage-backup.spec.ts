import { beforeEach, describe, expect, it } from "vitest";
import {
  ALL_BACKUP_SCOPES,
  backupDeclaredScopesMismatchFile,
  computeUserIdHash,
  peekDiabeatersBackup,
  storage,
} from "./storage";

const LS_PROFILE = "diabeater_profile";
const LS_COMMUNITY = "diabeater_community_posts";
const LS_DM = "diabeater_direct_messages";

function minimalProfile(overrides: Partial<{ name: string; email: string }> = {}) {
  return {
    name: "Test",
    email: "test@example.com",
    dateOfBirth: "",
    bgUnits: "mmol/L",
    carbUnits: "g",
    diabetesType: "1",
    insulinDeliveryMethod: "pump",
    usingInsulin: true,
    hasAcceptedDisclaimer: true,
    ...overrides,
  };
}

describe("peekDiabeatersBackup", () => {
  it("rejects empty object", () => {
    const r = peekDiabeatersBackup("{}");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });

  it("rejects random JSON array", () => {
    const r = peekDiabeatersBackup("[1,2,3]");
    expect(r.ok).toBe(false);
  });

  it("accepts export-shaped backup with marker", () => {
    const j = JSON.stringify({
      _exportedAt: new Date().toISOString(),
      _version: "1.0",
      _appVersion: "9.9.9",
      PROFILE: { id: "x", full_name: "Test" },
    });
    const r = peekDiabeatersBackup(j);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.keysRestored).toBe(1);
      expect(r.backupFormatVersion).toBe("1.0");
      expect(r.appVersion).toBe("9.9.9");
      expect(r.declaredScopes).toBeNull();
      expect(r.detectedScopes).toContain("clinical");
      expect(r.userIdHash).toBeNull();
    }
  });

  it("accepts two sections without export marker", () => {
    const j = JSON.stringify({
      PROFILE: { id: "a" },
      SETTINGS: { tdd: 40 },
    });
    const r = peekDiabeatersBackup(j);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.keysRestored).toBe(2);
  });

  it("accepts profile-only legacy export without marker", () => {
    const j = JSON.stringify({ PROFILE: { id: "a" } });
    const r = peekDiabeatersBackup(j);
    expect(r.ok).toBe(true);
  });

  it("rejects single non-core section without marker", () => {
    const j = JSON.stringify({ TRAVEL_PLAN: {} });
    const r = peekDiabeatersBackup(j);
    expect(r.ok).toBe(false);
  });

  it("reads declared scopes and user hash from metadata", () => {
    const j = JSON.stringify({
      _exportedAt: new Date().toISOString(),
      _version: "1.1",
      _scope: ["clinical", "app_settings"],
      _user_id_hash: "deadbeefcafebabe",
      PROFILE: { name: "A" },
      NOTIFICATION_SETTINGS: { pushNotifications: true },
    });
    const r = peekDiabeatersBackup(j);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.declaredScopes).toEqual(["clinical", "app_settings"]);
      expect(r.userIdHash).toBe("deadbeefcafebabe");
      expect(r.detectedScopes).toContain("clinical");
      expect(r.detectedScopes).toContain("app_settings");
    }
  });
});

describe("backupDeclaredScopesMismatchFile", () => {
  it("returns false when declared scopes is null", () => {
    const rec = { PROFILE: {}, COMMUNITY_POSTS: [] };
    expect(backupDeclaredScopesMismatchFile(null, rec)).toBe(false);
  });

  it("returns true when file contains keys outside declared scopes", () => {
    const rec = {
      _scope: ["clinical"],
      PROFILE: {},
      COMMUNITY_POSTS: [{ id: "1" }],
    };
    const peek = peekDiabeatersBackup(JSON.stringify(rec));
    expect(peek.ok).toBe(true);
    if (peek.ok) {
      expect(backupDeclaredScopesMismatchFile(peek.declaredScopes, rec)).toBe(true);
    }
  });
});

describe("scoped export / import", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("export with clinical scope omits community and messages keys", () => {
    localStorage.setItem(LS_PROFILE, JSON.stringify(minimalProfile()));
    localStorage.setItem(LS_COMMUNITY, JSON.stringify([{ id: "p1", body: "x" }]));
    localStorage.setItem(LS_DM, JSON.stringify([{ id: "d1" }]));

    const json = storage.exportAllData({ scopes: ["clinical"] });
    const rec = JSON.parse(json) as Record<string, unknown>;
    expect(rec.PROFILE).toBeDefined();
    expect(rec.COMMUNITY_POSTS).toBeUndefined();
    expect(rec.DIRECT_MESSAGES).toBeUndefined();
    expect(rec._scope).toEqual(["clinical"]);
    expect(rec._user_id_hash).toBe(computeUserIdHash(minimalProfile()));
  });

  it("import with importScopes skips sections not selected", () => {
    localStorage.setItem(LS_PROFILE, JSON.stringify(minimalProfile({ email: "test@example.com" })));
    localStorage.setItem(LS_COMMUNITY, JSON.stringify([{ id: "local-post" }]));

    const backup = storage.exportAllData({ scopes: ALL_BACKUP_SCOPES });
    localStorage.setItem(LS_PROFILE, JSON.stringify(minimalProfile({ email: "other@example.com" })));
    localStorage.setItem(LS_COMMUNITY, JSON.stringify([{ id: "keep-me" }]));

    const r = storage.importAllData(backup, {
      mode: "merge",
      importScopes: ["clinical"],
      skipUserHashCheck: true,
    });
    expect(r.success).toBe(true);
    expect(r.skippedOutOfScopeKeys).toBeGreaterThan(0);

    const profile = JSON.parse(localStorage.getItem(LS_PROFILE) || "{}") as { email: string };
    expect(profile.email).toBe("test@example.com");
    const posts = JSON.parse(localStorage.getItem(LS_COMMUNITY) || "[]") as { id: string }[];
    expect(posts[0]?.id).toBe("keep-me");
  });

  it("replace with importScopes only clears selected scopes", () => {
    localStorage.setItem(LS_PROFILE, JSON.stringify(minimalProfile()));
    localStorage.setItem(LS_COMMUNITY, JSON.stringify([{ id: "old" }]));
    localStorage.setItem(LS_DM, JSON.stringify([{ id: "dm-old" }]));

    const clinicalOnly = storage.exportAllData({ scopes: ["clinical"] });

    localStorage.setItem(LS_PROFILE, JSON.stringify(minimalProfile({ name: "ReplacedName" })));
    localStorage.setItem(LS_COMMUNITY, JSON.stringify([{ id: "new-community" }]));
    localStorage.setItem(LS_DM, JSON.stringify([{ id: "dm-persist" }]));

    const r = storage.importAllData(clinicalOnly, {
      mode: "replace",
      importScopes: ["clinical"],
      skipUserHashCheck: true,
    });
    expect(r.success).toBe(true);

    const profile = JSON.parse(localStorage.getItem(LS_PROFILE) || "{}") as { name: string };
    expect(profile.name).toBe("Test");
    const posts = JSON.parse(localStorage.getItem(LS_COMMUNITY) || "[]") as { id: string }[];
    expect(posts[0]?.id).toBe("new-community");
    const dms = JSON.parse(localStorage.getItem(LS_DM) || "[]") as { id: string }[];
    expect(dms[0]?.id).toBe("dm-persist");
  });

  it("refuses import when user hash does not match", () => {
    localStorage.setItem(LS_PROFILE, JSON.stringify(minimalProfile({ email: "a@example.com" })));
    const backup = storage.exportAllData({ scopes: ["clinical"] });

    localStorage.setItem(LS_PROFILE, JSON.stringify(minimalProfile({ email: "b@example.com" })));

    const r = storage.importAllData(backup, { mode: "merge", importScopes: ["clinical"] });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/different signed-in profile/i);
  });
});
