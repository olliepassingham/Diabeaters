/**
 * Supporter live-glucose check-in alert policy.
 *
 * Product model: one alert per extreme excursion, and only after the extreme
 * has *sustained* for a while — so a brief spike does not panic a supporter,
 * and the notification means "please check they're OK" rather than "first tip
 * over the line".
 *
 * Used by `notify_carers_on_live_glucose`. Pure / side-effect free so it can
 * be unit-tested without Deno or Supabase.
 */

export type LiveGlucoseAlertStatus = "ok" | "extreme_low" | "extreme_high";
export type LiveGlucoseExtremeStatus = "extreme_low" | "extreme_high";

/** How long glucose must stay extreme before the first check-in alert. */
export const LIVE_GLUCOSE_ALERT_SUSTAIN_MS = 15 * 60_000;

/**
 * How long glucose must stay back in range before a *new* excursion can alert.
 * Stops threshold chatter (14.0 ↔ 14.1) from re-firing the same mental event.
 */
export const LIVE_GLUCOSE_ALERT_RECOVERY_MS = 10 * 60_000;

export type LiveGlucoseAlertState = {
  lastAlertedStatus: LiveGlucoseAlertStatus;
  /** Extreme currently being timed for sustain (null when in range / already alerted). */
  pendingStatus: LiveGlucoseExtremeStatus | null;
  /** When `pendingStatus` streak started. */
  extremeSinceMs: number | null;
  /** When the current continuous in-range streak started after an alert (null otherwise). */
  okSinceMs: number | null;
};

export type LiveGlucoseAlertDecision =
  | {
      action: "noop";
      next: LiveGlucoseAlertState;
    }
  | {
      action: "persist";
      next: LiveGlucoseAlertState;
    }
  | {
      action: "notify";
      status: LiveGlucoseExtremeStatus;
      /** Atomic claim: only notify if DB still has this last_alerted_status. */
      claimFrom: LiveGlucoseAlertStatus;
      next: LiveGlucoseAlertState;
    };

function sameState(a: LiveGlucoseAlertState, b: LiveGlucoseAlertState): boolean {
  return (
    a.lastAlertedStatus === b.lastAlertedStatus &&
    a.pendingStatus === b.pendingStatus &&
    a.extremeSinceMs === b.extremeSinceMs &&
    a.okSinceMs === b.okSinceMs
  );
}

function defaultState(): LiveGlucoseAlertState {
  return {
    lastAlertedStatus: "ok",
    pendingStatus: null,
    extremeSinceMs: null,
    okSinceMs: null,
  };
}

function isExtreme(status: LiveGlucoseAlertStatus): status is LiveGlucoseExtremeStatus {
  return status === "extreme_low" || status === "extreme_high";
}

/**
 * Decide whether to notify / update alert state for one carer–patient pair
 * given the latest reading's extreme status.
 */
export function decideLiveGlucoseAlert(input: {
  status: LiveGlucoseAlertStatus;
  state: LiveGlucoseAlertState | null | undefined;
  nowMs: number;
  sustainMs?: number;
  recoveryMs?: number;
}): LiveGlucoseAlertDecision {
  const sustainMs = input.sustainMs ?? LIVE_GLUCOSE_ALERT_SUSTAIN_MS;
  const recoveryMs = input.recoveryMs ?? LIVE_GLUCOSE_ALERT_RECOVERY_MS;
  const nowMs = input.nowMs;
  const prev = input.state ?? defaultState();
  const status = input.status;

  if (status === "ok") {
    // Always clear any pending extreme streak — brief returns to range reset the sustain timer.
    if (prev.lastAlertedStatus === "ok") {
      const next = defaultState();
      return sameState(prev, next) ? { action: "noop", next } : { action: "persist", next };
    }

    // Still recovering from a prior alert — only clear lastAlerted after sustained OK.
    const okSinceMs = prev.okSinceMs ?? nowMs;
    if (nowMs - okSinceMs >= recoveryMs) {
      return { action: "persist", next: defaultState() };
    }
    const next: LiveGlucoseAlertState = {
      lastAlertedStatus: prev.lastAlertedStatus,
      pendingStatus: null,
      extremeSinceMs: null,
      okSinceMs,
    };
    return sameState(prev, next) ? { action: "noop", next } : { action: "persist", next };
  }

  if (!isExtreme(status)) {
    return { action: "noop", next: prev };
  }

  const extremeStatus = status;

  // Already alerted for this same extreme — stay quiet until recovered.
  if (prev.lastAlertedStatus === extremeStatus) {
    const next: LiveGlucoseAlertState = {
      lastAlertedStatus: extremeStatus,
      pendingStatus: null,
      extremeSinceMs: null,
      okSinceMs: null,
    };
    return sameState(prev, next) ? { action: "noop", next } : { action: "persist", next };
  }

  // Pending a (possibly different) extreme: start or continue the sustain timer.
  const pendingMatches = prev.pendingStatus === extremeStatus && prev.extremeSinceMs != null;
  const extremeSinceMs = pendingMatches ? prev.extremeSinceMs! : nowMs;

  const waiting: LiveGlucoseAlertState = {
    lastAlertedStatus: prev.lastAlertedStatus,
    pendingStatus: extremeStatus,
    extremeSinceMs,
    okSinceMs: null,
  };

  if (nowMs - extremeSinceMs < sustainMs) {
    return sameState(prev, waiting) ? { action: "noop", next: waiting } : { action: "persist", next: waiting };
  }

  return {
    action: "notify",
    status: extremeStatus,
    claimFrom: prev.lastAlertedStatus,
    next: {
      lastAlertedStatus: extremeStatus,
      pendingStatus: null,
      extremeSinceMs: null,
      okSinceMs: null,
    },
  };
}
