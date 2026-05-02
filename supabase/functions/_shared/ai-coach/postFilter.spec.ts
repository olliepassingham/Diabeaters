/**
 * Post-filter specs — §8 of docs/regulatory/ai_coach_system_prompt.md.
 *
 * Covers acceptance test cases #13, #15, plus all §8 regex variants and the
 * href allow-list.
 */

import { describe, expect, it } from "vitest";
import {
  applyPostFilter,
  __test_internals,
} from "./postFilter.ts";
import type { CoachReply } from "./types.ts";

const {
  hasNumericDose,
  hasRatio,
  hasIsf,
  hasPersonalTarget,
  hasCgmArrowAction,
  filterActions,
} = __test_internals;

function reply(partial: Partial<CoachReply>): CoachReply {
  return {
    reply: "ok",
    suggestedQuestions: [],
    suggestedNextActions: [],
    deferToTeam: false,
    ...partial,
  };
}

describe("hasNumericDose", () => {
  it("detects digits dose near insulin term (#13)", () => {
    expect(hasNumericDose("Try 6 units of bolus before dinner.")).toBe(true);
  });

  it("detects worded dose near insulin term (#15)", () => {
    expect(hasNumericDose("Try three units of fast acting in this case.")).toBe(true);
  });

  it("detects half-unit and decimal forms", () => {
    expect(hasNumericDose("You could try half a unit of insulin")).toBe(true);
    expect(hasNumericDose("Around 0.5 units of bolus is common.")).toBe(true);
  });

  it("ignores numbers not near insulin context", () => {
    expect(hasNumericDose("There are 6 cards in the deck.")).toBe(false);
    expect(hasNumericDose("I've had three teas today.")).toBe(false);
  });
});

describe("hasRatio", () => {
  it("detects '1:10' near 'carb'", () => {
    expect(hasRatio("Many people start at a 1:10 carb ratio with their team.")).toBe(true);
  });

  it("detects '1 to 10' near 'ratio'", () => {
    expect(hasRatio("A common starting ratio is 1 to 10.")).toBe(true);
  });

  it("ignores 1:10 in unrelated context (e.g. an odds ratio about something else)", () => {
    expect(hasRatio("There's a 1:10 chance of rain.")).toBe(false);
  });
});

describe("hasIsf", () => {
  it("detects '3 mmol/L' near 'drop'", () => {
    expect(hasIsf("One unit might drop someone by 3 mmol/L on average.")).toBe(true);
  });

  it("detects ISF mention with sensitivity term", () => {
    expect(hasIsf("Insulin sensitivity factor of 3 mmol/L is typical.")).toBe(true);
  });

  it("ignores BG range mentions without ISF context", () => {
    expect(hasIsf("Time-in-range is between 4 mmol/L and 10 mmol/L.")).toBe(false);
  });
});

describe("hasPersonalTarget", () => {
  it("detects 'aim for 6 mmol/L'", () => {
    expect(hasPersonalTarget("Aim for 6 mmol/L before meals.")).toBe(true);
  });

  it("detects 'should be 7 mmol/L'", () => {
    expect(hasPersonalTarget("Your morning level should be 7 mmol/L.")).toBe(true);
  });

  it("does NOT trigger on educational ranges without personal framing", () => {
    expect(
      hasPersonalTarget(
        "Common time-in-range bands are between 3.9 and 10 mmol/L, set with your team.",
      ),
    ).toBe(false);
  });

  it("does NOT trigger on numbers without BG units", () => {
    expect(hasPersonalTarget("Aim for three meals a day.")).toBe(false);
  });
});

describe("hasCgmArrowAction", () => {
  it("detects 'two arrows down ... correct'", () => {
    expect(hasCgmArrowAction("If you see two arrows down, correct now.")).toBe(true);
  });

  it("detects '↓↓ ... bolus'", () => {
    expect(hasCgmArrowAction("If your CGM shows ↓↓, bolus less or skip it.")).toBe(true);
  });

  it("does NOT trigger when arrows and actions are in different sentences", () => {
    expect(
      hasCgmArrowAction(
        "Two arrows down means a fast fall. Reducing meals on a different day is unrelated.",
      ),
    ).toBe(false);
  });

  it("does NOT trigger on educational arrow explanation alone", () => {
    expect(
      hasCgmArrowAction("Two arrows down on a CGM generally means a fast fall."),
    ).toBe(false);
  });
});

describe("filterActions — href allow-list", () => {
  it("keeps allow-listed paths", () => {
    const { cleaned, dropped } = filterActions([
      { label: "Help Now", href: "/help-now" },
      { label: "Meal Adviser", href: "/adviser?tab=meal" },
    ]);
    expect(cleaned).toHaveLength(2);
    expect(dropped).toBe(0);
  });

  it("drops external URLs and unknown paths", () => {
    const { cleaned, dropped } = filterActions([
      { label: "Bad", href: "https://evil.example.com" },
      { label: "Unknown", href: "/coach/admin" },
      { label: "Help Now", href: "/help-now" },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].href).toBe("/help-now");
    expect(dropped).toBe(2);
  });

  it("caps at 3 entries", () => {
    const { cleaned, dropped } = filterActions([
      { label: "1", href: "/help-now" },
      { label: "2", href: "/adviser" },
      { label: "3", href: "/tools/correction" },
      { label: "4", href: "/scenarios/exercise" },
    ]);
    expect(cleaned).toHaveLength(3);
    expect(dropped).toBe(1);
  });
});

describe("applyPostFilter", () => {
  it("passes a clean reply unchanged", () => {
    const r = applyPostFilter(
      reply({
        reply:
          "Time-in-range is the proportion of readings within the range your team has agreed with you. The exact bounds are personal and live with your team.",
        suggestedQuestions: ["What's a realistic time-in-range goal for me?"],
        suggestedNextActions: [{ label: "Open Adviser", href: "/adviser" }],
        deferToTeam: true,
      }),
    );
    expect(r.status).toBe("pass");
    expect(r.reply.suggestedNextActions).toHaveLength(1);
  });

  it("refuses when reply contains numeric dose (#13)", () => {
    const r = applyPostFilter(reply({ reply: "Try 6 units of bolus before dinner." }));
    expect(r.status).toBe("refused");
    expect(r.reasons).toContain("numeric_dose");
  });

  it("refuses when reply contains worded dose (#15)", () => {
    const r = applyPostFilter(
      reply({ reply: "Try three units of fast acting before that meal." }),
    );
    expect(r.status).toBe("refused");
    expect(r.reasons).toContain("numeric_dose");
  });

  it("refuses when reply contains a personal target", () => {
    const r = applyPostFilter(reply({ reply: "Aim for 6 mmol/L before meals." }));
    expect(r.status).toBe("refused");
    expect(r.reasons).toContain("personal_target");
  });

  it("refuses when reply contains a CGM-arrow action in one sentence", () => {
    const r = applyPostFilter(
      reply({ reply: "If you see two arrows down, correct with a small bolus." }),
    );
    expect(r.status).toBe("refused");
  });

  it("rewrites by truncating when reply exceeds the length cap", () => {
    const longText = "a".repeat(2000);
    const r = applyPostFilter(reply({ reply: longText }));
    expect(r.status).toBe("rewritten");
    expect(r.reply.reply.length).toBeLessThanOrEqual(1500);
    expect(r.reasons).toContain("length_cap");
  });

  it("rewrites by dropping a forbidden href, keeping the rest of the reply intact", () => {
    const r = applyPostFilter(
      reply({
        reply: "Here is some general info.",
        suggestedNextActions: [
          { label: "Bad", href: "https://evil.example.com" },
          { label: "Help Now", href: "/help-now" },
        ],
      }),
    );
    expect(r.status).toBe("rewritten");
    expect(r.reply.suggestedNextActions).toHaveLength(1);
    expect(r.reply.suggestedNextActions[0].href).toBe("/help-now");
  });

  it("returns a refusal reply when given a malformed object", () => {
    // @ts-expect-error: intentional misuse to exercise defensive branch.
    const r = applyPostFilter({ reply: 123 });
    expect(r.status).toBe("refused");
  });
});
