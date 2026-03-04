import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchWithRetry, TemporarilyUnavailableError } from "./fetchWithRetry";

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("retries on 5xx up to 3 times", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("no", { status: 500 }))
      .mockResolvedValueOnce(new Response("no", { status: 502 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const p = fetchWithRetry("/api/test", { circuitKey: "GET:/api/test" });
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws AbortError when aborted", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await expect(
      fetchWithRetry("/api/test", { signal: controller.signal, circuitKey: "GET:/api/test" }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("opens circuit after repeated failures and short-circuits", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response("no", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    // trip circuit: 4 calls (each call retries internally) - use a unique key to isolate
    const key = "GET:/api/flaky";
    const p1 = fetchWithRetry("/api/flaky", { circuitKey: key }).catch(() => {});
    await vi.runAllTimersAsync();
    await p1;
    const p2 = fetchWithRetry("/api/flaky", { circuitKey: key }).catch(() => {});
    await vi.runAllTimersAsync();
    await p2;
    const p3 = fetchWithRetry("/api/flaky", { circuitKey: key }).catch(() => {});
    await vi.runAllTimersAsync();
    await p3;

    await expect(fetchWithRetry("/api/flaky", { circuitKey: key })).rejects.toBeInstanceOf(
      TemporarilyUnavailableError,
    );
  });
});

