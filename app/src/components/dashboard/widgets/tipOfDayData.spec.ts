import { describe, expect, it } from "vitest";

import { tipsForDelivery } from "./tipOfDayData";

describe("tipsForDelivery", () => {
  it("hides injection and long-acting tips from pump users", () => {
    const text = tipsForDelivery("pump").map((tip) => tip.text).join("\n");
    expect(text).not.toMatch(/when injecting|injection sites|long-acting insulin timing/);
    expect(text).toMatch(/infusion sites/);
    expect(text).toMatch(/pump clock/);
    expect(text).toMatch(/backup pen/);
  });

  it("hides pump-only tips from pen users", () => {
    const text = tipsForDelivery("pen").map((tip) => tip.text).join("\n");
    expect(text).not.toMatch(/infusion sites|backup pen|pump clock/);
    expect(text).toMatch(/injection sites/);
    expect(text).toMatch(/long-acting insulin timing/);
  });
});
