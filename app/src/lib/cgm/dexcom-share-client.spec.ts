import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDexcomShareSessionCache,
  dexcomAccountPortalUrl,
  extractDexcomAccountIdFromInput,
  fetchDexcomShareHistory,
  fetchLatestDexcomShareReading,
  mapDexcomShareTrend,
  normalizeDexcomAccountId,
  parseDexcomShareEntry,
  testDexcomShareConnection,
} from "@/lib/cgm/dexcom-share-client";

const creds = { username: "user@example.com", password: "secret", server: "eu" as const };

describe("dexcom-share-client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearDexcomShareSessionCache();
  });

  it("maps dexcom trend strings", () => {
    expect(mapDexcomShareTrend("SingleUp")).toBe("rising");
    expect(mapDexcomShareTrend("FortyFiveDown")).toBe("falling");
    expect(mapDexcomShareTrend("Flat")).toBe("flat");
  });

  it("parses glucose entries", () => {
    const entry = parseDexcomShareEntry({
      Value: 120,
      WT: "/Date(1700000000000)/",
      Trend: "Flat",
    });
    expect(entry?.valueMgDl).toBe(120);
    expect(entry?.recordedAt).toBe(new Date(1700000000000).toISOString());
  });

  it("accepts hyphenated account ids", () => {
    expect(normalizeDexcomAccountId("12345678-90ab-cdef-1234-567890abcdef")).toBe(
      "12345678-90ab-cdef-1234-567890abcdef",
    );
  });

  it("extracts account id from portal url", () => {
    expect(
      extractDexcomAccountIdFromInput(
        "https://uam2.dexcom.com/accounts/8487fb99-fbc4-404d-b8a1-9348f6ce0e12/settings",
      ),
    ).toBe("8487fb99-fbc4-404d-b8a1-9348f6ce0e12");
  });

  it("maps dexcom account portal by region", () => {
    expect(dexcomAccountPortalUrl("eu")).toBe("https://uam2.dexcom.com");
    expect(dexcomAccountPortalUrl("us")).toBe("https://uam1.dexcom.com");
    expect(dexcomAccountPortalUrl("jp")).toBe("https://uam.dexcom.jp");
  });

  it("logs in directly with account id", async () => {
    const accountId = "12345678-90ab-cdef-1234-567890abcdef";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => `"session-456"`,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ Value: 108, WT: "/Date(1700000000000)/", Trend: "Flat" }]),
      });
    vi.stubGlobal("fetch", fetchMock);

    const reading = await fetchLatestDexcomShareReading({
      username: accountId,
      password: "secret",
      server: "eu",
    });
    expect(reading?.valueMgDl).toBe(108);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const loginBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(loginBody.accountId).toBe(accountId);
  });

  it("fetches latest reading via share api", async () => {
    const accountId = "12345678-90ab-cdef-1234-567890abcdef";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => `"${accountId}"`,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '"session-456"',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ Value: 108, WT: "/Date(1700000000000)/", Trend: "Flat" }]),
      });
    vi.stubGlobal("fetch", fetchMock);

    const reading = await fetchLatestDexcomShareReading(creds);
    expect(reading?.valueMgDl).toBe(108);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toContain("AuthenticatePublisherAccount");
    const authBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(authBody.applicationId).toBe("d89443d2-327c-4a6f-89e5-496bbb0317db");
    expect(authBody.accountName).toBe("user@example.com");
  });

  it("fetches history sorted oldest-first", async () => {
    const accountId = "12345678-90ab-cdef-1234-567890abcdef";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => `"${accountId}"`,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '"session-456"',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            { Value: 120, WT: "/Date(1700003600000)/", Trend: "Flat" },
            { Value: 108, WT: "/Date(1700000000000)/", Trend: "Flat" },
          ]),
      });
    vi.stubGlobal("fetch", fetchMock);

    const history = await fetchDexcomShareHistory(creds, { minutes: 180, maxCount: 48 });
    expect(history).toHaveLength(2);
    expect(history[0]?.valueMgDl).toBe(108);
    expect(history[1]?.valueMgDl).toBe(120);
  });

  it("returns resolved account id after email connect test", async () => {
    const accountId = "12345678-90ab-cdef-1234-567890abcdef";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => `"${accountId}"`,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '"session-456"',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ Value: 108, WT: "/Date(1700000000000)/", Trend: "Flat" }]),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await testDexcomShareConnection(creds);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolvedAccountId).toBe(accountId);
    }
  });
});
