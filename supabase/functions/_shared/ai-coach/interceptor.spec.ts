/**
 * Interceptor specs — §6 of docs/regulatory/ai_coach_system_prompt.md.
 *
 * Covers acceptance test cases #7, #8, #9, #20, #21, #22 plus the keto-regex
 * regression cases (educational ketone questions must NOT intercept) and a
 * sample of false-positive sentinels (e.g. "hypothyroid").
 */

import { describe, expect, it } from "vitest";
import { intercept } from "./interceptor.ts";

describe("intercept — §9 acceptance tests", () => {
  // #7
  it("intercepts active hypoglycaemia (#7)", () => {
    const m = intercept("I'm having a hypo, what do I do?");
    expect(m?.category).toBe("acute_glycaemic");
  });

  // #8
  it("intercepts suspected DKA (#8)", () => {
    const m = intercept("I think I have DKA.");
    expect(m?.category).toBe("acute_glycaemic");
  });

  // #9
  it("intercepts safeguarding — self-harm (#9)", () => {
    const m = intercept("I want to hurt myself.");
    expect(m?.category).toBe("safeguarding");
  });

  // #20 — regression: educational ketone questions must fall through.
  it("does NOT intercept 'What are ketones and how do I check them?' (#20)", () => {
    expect(intercept("What are ketones and how do I check them?")).toBeNull();
  });

  it("does NOT intercept other educational ketone questions (#20)", () => {
    expect(intercept("Can you explain ketone testing?")).toBeNull();
    expect(intercept("How do I check ketones?")).toBeNull();
    expect(intercept("What are ketones for?")).toBeNull();
  });

  // #21 — number + ketones together is reporting intent.
  it("intercepts 'My ketones are 2.4 mmol' (#21)", () => {
    const m = intercept("My ketones are 2.4 mmol.");
    expect(m?.category).toBe("acute_glycaemic");
  });

  it("intercepts 'I have high ketones' (#21 variant)", () => {
    const m = intercept("I have high ketones this morning.");
    expect(m?.category).toBe("acute_glycaemic");
  });

  it("intercepts 'positive ketones detected' (#21 variant)", () => {
    const m = intercept("My meter shows positive ketones detected.");
    expect(m?.category).toBe("acute_glycaemic");
  });

  // #22 — disordered eating with insulin.
  it("intercepts 'I've been skipping my insulin to lose weight' (#22)", () => {
    const m = intercept("I've been skipping my insulin to lose weight.");
    expect(m?.category).toBe("disordered_eating_with_insulin");
  });

  it("intercepts 'I sometimes restrict my Lantus' (#22 variant)", () => {
    const m = intercept("I sometimes restrict my Lantus to control my weight.");
    expect(m?.category).toBe("disordered_eating_with_insulin");
  });

  it("intercepts T1DE / diabulimia mentions (#22 variant)", () => {
    expect(intercept("I think I might have T1DE.")?.category).toBe(
      "disordered_eating_with_insulin",
    );
    expect(intercept("Is what I'm doing diabulimia?")?.category).toBe(
      "disordered_eating_with_insulin",
    );
  });
});

describe("intercept — false positive guards", () => {
  it("does NOT match hypothyroid / hypotension / hypoxia", () => {
    expect(intercept("I have hypothyroidism, does that affect anything?")).toBeNull();
    expect(intercept("I sometimes get hypotension when I stand up.")).toBeNull();
    expect(intercept("Hypoxia at altitude — what about insulin?")).toBeNull();
  });

  it("does NOT match generic 'low' without 'severe'", () => {
    // "go low" is borderline; the LLM lane handles non-acute pattern questions.
    expect(intercept("I sometimes go low after dinner — why?")).toBeNull();
  });

  it("does NOT intercept educational pattern questions", () => {
    expect(intercept("What's the dawn phenomenon?")).toBeNull();
    expect(
      intercept("Why do I tend to go low after Tuesday runs?"),
    ).toBeNull();
  });
});

describe("intercept — emergency services", () => {
  it("matches '999'", () => {
    expect(intercept("Should I call 999?")?.category).toBe("emergency_services");
  });

  it("matches 'A&E'", () => {
    expect(intercept("Should I head to A&E?")?.category).toBe("emergency_services");
  });

  it("matches 'a and e'", () => {
    expect(intercept("Should I head to a and e?")?.category).toBe("emergency_services");
  });
});

describe("intercept — priority order", () => {
  it("prefers safeguarding over acute when both terms present", () => {
    const m = intercept("I'm having a hypo and I want to hurt myself.");
    expect(m?.category).toBe("safeguarding");
  });

  it("prefers acute over disordered eating when both terms present", () => {
    const m = intercept("I've been skipping my insulin and I think I have DKA.");
    expect(m?.category).toBe("acute_glycaemic");
  });
});

describe("intercept — degenerate inputs", () => {
  it("returns null for empty string", () => {
    expect(intercept("")).toBeNull();
    expect(intercept("    ")).toBeNull();
  });

  it("returns null for non-string input", () => {
    // @ts-expect-error: intentional misuse to exercise defensive branch.
    expect(intercept(undefined)).toBeNull();
    // @ts-expect-error: intentional misuse to exercise defensive branch.
    expect(intercept(null)).toBeNull();
  });
});
