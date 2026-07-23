import { describe, expect, it } from "vitest";
import {
  decideLiveGlucoseAlert,
  LIVE_GLUCOSE_ALERT_RECOVERY_MS,
  LIVE_GLUCOSE_ALERT_SUSTAIN_MS,
  type LiveGlucoseAlertState,
} from "./live-glucose-alert-policy";

const T0 = Date.parse("2026-07-23T10:00:00.000Z");

function state(partial: Partial<LiveGlucoseAlertState> = {}): LiveGlucoseAlertState {
  return {
    lastAlertedStatus: "ok",
    pendingStatus: null,
    extremeSinceMs: null,
    okSinceMs: null,
    ...partial,
  };
}

describe("decideLiveGlucoseAlert", () => {
  it("does not notify on the first extreme reading — starts the sustain timer", () => {
    const decision = decideLiveGlucoseAlert({ status: "extreme_high", state: null, nowMs: T0 });
    expect(decision.action).toBe("persist");
    if (decision.action !== "persist") return;
    expect(decision.next.lastAlertedStatus).toBe("ok");
    expect(decision.next.pendingStatus).toBe("extreme_high");
    expect(decision.next.extremeSinceMs).toBe(T0);
  });

  it("still does not notify before the sustain window has elapsed", () => {
    const decision = decideLiveGlucoseAlert({
      status: "extreme_high",
      state: state({ pendingStatus: "extreme_high", extremeSinceMs: T0 }),
      nowMs: T0 + LIVE_GLUCOSE_ALERT_SUSTAIN_MS - 1,
    });
    expect(["noop", "persist"]).toContain(decision.action);
    expect(decision.next.lastAlertedStatus).toBe("ok");
    expect(decision.action === "notify").toBe(false);
  });

  it("notifies once after the extreme has sustained long enough", () => {
    const decision = decideLiveGlucoseAlert({
      status: "extreme_high",
      state: state({ pendingStatus: "extreme_high", extremeSinceMs: T0 }),
      nowMs: T0 + LIVE_GLUCOSE_ALERT_SUSTAIN_MS,
    });
    expect(decision.action).toBe("notify");
    if (decision.action !== "notify") return;
    expect(decision.status).toBe("extreme_high");
    expect(decision.claimFrom).toBe("ok");
    expect(decision.next.lastAlertedStatus).toBe("extreme_high");
    expect(decision.next.pendingStatus).toBeNull();
  });

  it("does not re-notify while still extreme after already alerting", () => {
    const decision = decideLiveGlucoseAlert({
      status: "extreme_high",
      state: state({ lastAlertedStatus: "extreme_high" }),
      nowMs: T0 + LIVE_GLUCOSE_ALERT_SUSTAIN_MS * 3,
    });
    expect(decision.action === "notify").toBe(false);
    expect(decision.next.lastAlertedStatus).toBe("extreme_high");
  });

  it("resets the sustain timer if levels briefly return to range before an alert", () => {
    const mid = decideLiveGlucoseAlert({
      status: "ok",
      state: state({ pendingStatus: "extreme_high", extremeSinceMs: T0 }),
      nowMs: T0 + 5 * 60_000,
    });
    expect(mid.action).toBe("persist");
    if (mid.action !== "persist") return;
    expect(mid.next.extremeSinceMs).toBeNull();
    expect(mid.next.pendingStatus).toBeNull();
    expect(mid.next.lastAlertedStatus).toBe("ok");

    const again = decideLiveGlucoseAlert({
      status: "extreme_high",
      state: mid.next,
      nowMs: T0 + 5 * 60_000 + 1,
    });
    expect(again.action).toBe("persist");
    if (again.action !== "persist") return;
    expect(again.next.extremeSinceMs).toBe(T0 + 5 * 60_000 + 1);
    expect(again.next.pendingStatus).toBe("extreme_high");
  });

  it("keeps lastAlerted during recovery so threshold chatter cannot re-fire", () => {
    const afterAlert = state({ lastAlertedStatus: "extreme_high" });
    const backOk = decideLiveGlucoseAlert({
      status: "ok",
      state: afterAlert,
      nowMs: T0 + 20 * 60_000,
    });
    expect(backOk.action).toBe("persist");
    if (backOk.action !== "persist") return;
    expect(backOk.next.lastAlertedStatus).toBe("extreme_high");
    expect(backOk.next.okSinceMs).toBe(T0 + 20 * 60_000);
    expect(backOk.next.extremeSinceMs).toBeNull();

    // Tip back over the line during recovery — still silenced (already alerted this excursion).
    const chatter = decideLiveGlucoseAlert({
      status: "extreme_high",
      state: backOk.next,
      nowMs: T0 + 20 * 60_000 + 60_000,
    });
    expect(chatter.action === "notify").toBe(false);
    expect(chatter.next.lastAlertedStatus).toBe("extreme_high");
    expect(chatter.next.okSinceMs).toBeNull();
  });

  it("allows a new excursion only after sustained recovery in range", () => {
    const recovering = state({
      lastAlertedStatus: "extreme_high",
      okSinceMs: T0,
    });

    const tooSoon = decideLiveGlucoseAlert({
      status: "ok",
      state: recovering,
      nowMs: T0 + LIVE_GLUCOSE_ALERT_RECOVERY_MS - 1,
    });
    expect(tooSoon.action === "notify").toBe(false);
    expect(tooSoon.next.lastAlertedStatus).toBe("extreme_high");

    const recovered = decideLiveGlucoseAlert({
      status: "ok",
      state: recovering,
      nowMs: T0 + LIVE_GLUCOSE_ALERT_RECOVERY_MS,
    });
    expect(recovered.action).toBe("persist");
    if (recovered.action !== "persist") return;
    expect(recovered.next.lastAlertedStatus).toBe("ok");
    expect(recovered.next.okSinceMs).toBeNull();

    // New extreme after full recovery starts a fresh sustain window (no instant re-alert).
    const nextExcursion = decideLiveGlucoseAlert({
      status: "extreme_high",
      state: recovered.next,
      nowMs: T0 + LIVE_GLUCOSE_ALERT_RECOVERY_MS + 1,
    });
    expect(nextExcursion.action).toBe("persist");
    if (nextExcursion.action !== "persist") return;
    expect(nextExcursion.next.extremeSinceMs).toBe(T0 + LIVE_GLUCOSE_ALERT_RECOVERY_MS + 1);
  });

  it("treats low and high as separate excursions (restarts sustain when flipping)", () => {
    const afterLowAlert = state({ lastAlertedStatus: "extreme_low" });
    const flip = decideLiveGlucoseAlert({
      status: "extreme_high",
      state: afterLowAlert,
      nowMs: T0 + 60_000,
    });
    expect(flip.action).toBe("persist");
    if (flip.action !== "persist") return;
    expect(flip.next.lastAlertedStatus).toBe("extreme_low");
    expect(flip.next.pendingStatus).toBe("extreme_high");
    expect(flip.next.extremeSinceMs).toBe(T0 + 60_000);

    // Mid-wait polls must NOT restart the timer.
    const midWait = decideLiveGlucoseAlert({
      status: "extreme_high",
      state: flip.next,
      nowMs: T0 + 60_000 + 5 * 60_000,
    });
    expect(midWait.action === "notify").toBe(false);
    expect(midWait.next.extremeSinceMs).toBe(T0 + 60_000);

    const afterSustain = decideLiveGlucoseAlert({
      status: "extreme_high",
      state: midWait.next,
      nowMs: T0 + 60_000 + LIVE_GLUCOSE_ALERT_SUSTAIN_MS,
    });
    expect(afterSustain.action).toBe("notify");
    if (afterSustain.action !== "notify") return;
    expect(afterSustain.status).toBe("extreme_high");
    expect(afterSustain.claimFrom).toBe("extreme_low");
  });

  it("restarts sustain if pending high flips to pending low before alerting", () => {
    const pendingHigh = state({ pendingStatus: "extreme_high", extremeSinceMs: T0 });
    const flip = decideLiveGlucoseAlert({
      status: "extreme_low",
      state: pendingHigh,
      nowMs: T0 + 10 * 60_000,
    });
    expect(flip.action).toBe("persist");
    if (flip.action !== "persist") return;
    expect(flip.next.pendingStatus).toBe("extreme_low");
    expect(flip.next.extremeSinceMs).toBe(T0 + 10 * 60_000);
  });

  it("works the same for extreme_low", () => {
    const start = decideLiveGlucoseAlert({ status: "extreme_low", state: null, nowMs: T0 });
    expect(start.action).toBe("persist");
    const notify = decideLiveGlucoseAlert({
      status: "extreme_low",
      state: state({ pendingStatus: "extreme_low", extremeSinceMs: T0 }),
      nowMs: T0 + LIVE_GLUCOSE_ALERT_SUSTAIN_MS,
    });
    expect(notify.action).toBe("notify");
    if (notify.action !== "notify") return;
    expect(notify.status).toBe("extreme_low");
  });

  it("respects custom sustain / recovery overrides", () => {
    const decision = decideLiveGlucoseAlert({
      status: "extreme_high",
      state: state({ pendingStatus: "extreme_high", extremeSinceMs: T0 }),
      nowMs: T0 + 60_000,
      sustainMs: 60_000,
    });
    expect(decision.action).toBe("notify");
  });
});
