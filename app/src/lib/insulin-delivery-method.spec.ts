import { describe, expect, it } from "vitest";
import { isPenDeliveryMethod, isPumpDeliveryMethod } from "./insulin-delivery-method";

describe("insulin-delivery-method", () => {
  it("detects pump with casing and whitespace", () => {
    expect(isPumpDeliveryMethod("pump")).toBe(true);
    expect(isPumpDeliveryMethod("PUMP")).toBe(true);
    expect(isPumpDeliveryMethod(" pump ")).toBe(true);
  });

  it("detects pen and rejects unknown", () => {
    expect(isPenDeliveryMethod("pen")).toBe(true);
    expect(isPenDeliveryMethod("Pen")).toBe(true);
    expect(isPumpDeliveryMethod("pen")).toBe(false);
    expect(isPumpDeliveryMethod("")).toBe(false);
    expect(isPumpDeliveryMethod(undefined)).toBe(false);
  });
});
