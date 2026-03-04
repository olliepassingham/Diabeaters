type CircuitState = {
  consecutiveFailures: number;
  firstFailureAt: number;
  openUntil: number;
};

const CIRCUIT: Map<string, CircuitState> = new Map();
const FAILURE_WINDOW_MS = 2 * 60 * 1000;
const OPEN_DURATION_MS = 60 * 1000;
const FAILURE_THRESHOLD = 3;

const RETRY_DELAYS_MS = [300, 1200, 3000] as const;

export class TemporarilyUnavailableError extends Error {
  public readonly code = "temporarilyUnavailable" as const;
  public readonly retryAfterMs: number;

  constructor(message = "Temporarily unavailable", retryAfterMs = OPEN_DURATION_MS) {
    super(message);
    this.name = "TemporarilyUnavailableError";
    this.retryAfterMs = retryAfterMs;
  }
}

function now() {
  return Date.now();
}

function jitter(ms: number): number {
  const range = ms * 0.2;
  const delta = (Math.random() * 2 - 1) * range;
  return Math.max(0, Math.round(ms + delta));
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function getCircuit(key: string): CircuitState {
  const existing = CIRCUIT.get(key);
  if (existing) return existing;
  const state: CircuitState = { consecutiveFailures: 0, firstFailureAt: 0, openUntil: 0 };
  CIRCUIT.set(key, state);
  return state;
}

function recordSuccess(key: string) {
  const state = getCircuit(key);
  state.consecutiveFailures = 0;
  state.firstFailureAt = 0;
  state.openUntil = 0;
}

function recordFailure(key: string) {
  const state = getCircuit(key);
  const t = now();
  if (!state.firstFailureAt || t - state.firstFailureAt > FAILURE_WINDOW_MS) {
    state.firstFailureAt = t;
    state.consecutiveFailures = 1;
  } else {
    state.consecutiveFailures += 1;
  }

  if (state.consecutiveFailures >= FAILURE_THRESHOLD) {
    state.openUntil = t + OPEN_DURATION_MS;
  }
}

function isCircuitOpen(key: string): number {
  const state = getCircuit(key);
  const t = now();
  if (state.openUntil > t) return state.openUntil - t;
  return 0;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit & { circuitKey?: string } = {},
): Promise<Response> {
  const key = init.circuitKey ?? `fetch:${typeof input === "string" ? input : input.toString()}`;
  const openFor = isCircuitOpen(key);
  if (openFor > 0) {
    throw new TemporarilyUnavailableError("Temporarily unavailable", openFor);
  }

  const signal = init.signal;
  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const res = await fetch(input, init);
      lastResponse = res;

      if (res.status >= 500 && res.status <= 599) {
        recordFailure(key);
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(jitter(RETRY_DELAYS_MS[attempt]), signal);
          continue;
        }
      } else {
        recordSuccess(key);
      }

      return res;
    } catch (e) {
      lastError = e;
      // Only retry on abort? No.
      if (e instanceof DOMException && e.name === "AbortError") {
        throw e;
      }
      recordFailure(key);
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(jitter(RETRY_DELAYS_MS[attempt]), signal);
        continue;
      }
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

